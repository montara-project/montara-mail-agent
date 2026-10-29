package handlers

import (
	"context"
	"errors"
	"net/url"
	"slices"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/mailoauth"
	"montara-mail-agent/server/internal/lib/mcpclient"
	"montara-mail-agent/server/internal/mcptools"
	"montara-mail-agent/server/internal/models"
)

// mcpServerHandler manages the MCP servers whose tools an organization's
// agent may call. An organization's owner manages its hosted and http
// servers; a command server runs a process on this machine, so only a super
// user (who runs the server) may add or change one.
type mcpServerHandler struct {
	app *app.Application
}

// mcpStatePrefix marks an OAuth state as an MCP server's sign-in; the mail
// account callback refuses it, since its provider never matches.
const mcpStatePrefix = "mcp:"

// mcpServerView is a server as the API shows it: header and environment
// names, never their values.
type mcpServerView struct {
	models.MCPServer
	Headers []mcpPairView `json:"headers"`
	Env     []mcpPairView `json:"env"`
}

type mcpPairView struct {
	Name string `json:"name"`
}

func (h *mcpServerHandler) view(s models.MCPServer) mcpServerView {
	v := mcpServerView{MCPServer: s, Headers: []mcpPairView{}, Env: []mcpPairView{}}
	sec, err := mcptools.OpenSecrets(h.app, s)
	if err != nil {
		return v
	}
	for _, name := range sortedKeys(sec.Headers) {
		v.Headers = append(v.Headers, mcpPairView{name})
	}
	for _, name := range sortedKeys(sec.Env) {
		v.Env = append(v.Env, mcpPairView{name})
	}
	return v
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

// List returns an organization's servers. The metadata says whether the
// user may add a command server.
func (h *mcpServerHandler) List(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}
	servers, err := h.app.Repositories.MCPServer.List(c.Context(), orgID)
	if err != nil {
		return err
	}
	views := make([]mcpServerView, len(servers))
	for i, s := range servers {
		views[i] = h.view(s)
	}
	super, err := h.superUser(c)
	if err != nil {
		return err
	}
	meta := dtos.ListMeta(len(views), 0, len(views))
	meta["command_allowed"] = super
	return dtos.List(c, views, meta)
}

func (h *mcpServerHandler) superUser(c fiber.Ctx) (bool, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return false, apperr.ErrUnauthorized
	}
	return isSuperUser(c.Context(), h.app, uid)
}

// manage checks that the user may change a server of kind in orgID: the
// owner, and for a command server a super user.
func (h *mcpServerHandler) manage(c fiber.Ctx, orgID uuid.UUID, kind string) error {
	if err := owner(c, h.app, orgID); err != nil {
		return err
	}
	if kind != models.MCPKindCommand {
		return nil
	}
	super, err := h.superUser(c)
	if err != nil {
		return err
	}
	if !super {
		return apperr.New(apperr.KindForbidden, "only a super user can add or change a command server: it runs a program on the server")
	}
	return nil
}

// build turns a body into a server and its secrets. On an update (saved not
// nil) a blank environment value keeps the saved one; a blank header value
// and a hosted server's sign-in are kept only while the URL stays the same,
// so a saved secret never goes to a host it wasn't given for.
func (h *mcpServerHandler) build(body dtos.MCPServerBody, saved *models.MCPServer) (models.MCPServer, mcptools.Secrets, error) {
	var old mcptools.Secrets
	if saved != nil {
		var err error
		if old, err = mcptools.OpenSecrets(h.app, *saved); err != nil {
			old = mcptools.Secrets{}
		}
	}

	s := models.MCPServer{Name: body.Name, Kind: body.Kind, Args: []string{}, IsEnabled: true}
	if saved != nil {
		s = *saved
		s.Name = body.Name
	}
	if body.IsEnabled != nil {
		s.IsEnabled = *body.IsEnabled
	}
	var sec mcptools.Secrets
	var err error
	switch body.Kind {
	case models.MCPKindHosted, models.MCPKindHTTP:
		if err := h.checkURL(body.URL); err != nil {
			return s, sec, err
		}
		s.URL, s.Command, s.Args = body.URL, "", []string{}
		if body.Kind == models.MCPKindHTTP {
			var savedHeaders map[string]string
			if saved != nil && saved.URL == body.URL {
				savedHeaders = old.Headers
			}
			if sec.Headers, err = mergePairs("header", body.Headers, savedHeaders); err != nil {
				return s, sec, err
			}
		} else if saved != nil && saved.URL == body.URL {
			sec.OAuth = old.OAuth
		}
	case models.MCPKindCommand:
		s.URL, s.Command, s.Args = "", strings.TrimSpace(body.Command), body.Args
		if s.Args == nil {
			s.Args = []string{}
		}
		if sec.Env, err = mergePairs("environment variable", body.Env, old.Env); err != nil {
			return s, sec, err
		}
	}
	s.Secrets = mcptools.SealSecrets(h.app, sec)
	return s, sec, nil
}

// checkURL keeps credentials off plain http, as for LLM providers: only a
// server on the server's own network (ALLOW_PRIVATE_HOSTS) may use it.
func (h *mcpServerHandler) checkURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return apperr.New(apperr.KindBadRequest, "url is not a valid URL")
	}
	if u.Scheme != "https" && !h.app.Config.App.AllowPrivateHosts {
		return apperr.New(apperr.KindBadRequest, "url must be an https URL")
	}
	return nil
}

// mergePairs builds the name to value map, taking a blank value from the
// saved pair of the same name.
func mergePairs(what string, pairs []dtos.MCPPair, saved map[string]string) (map[string]string, error) {
	out := map[string]string{}
	for _, p := range pairs {
		value := p.Value
		if value == "" {
			var ok bool
			if value, ok = saved[p.Name]; !ok {
				return nil, apperr.New(apperr.KindBadRequest, "the %s %s needs a value", what, p.Name)
			}
		}
		out[p.Name] = value
	}
	return out, nil
}

func (h *mcpServerHandler) parseBody(c fiber.Ctx) (dtos.MCPServerBody, error) {
	var body dtos.MCPServerBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return body, err
	}
	return body, body.Check()
}

// Create adds a server and, for an http or command one, syncs its tools
// right away; a hosted one waits for the user to connect it.
func (h *mcpServerHandler) Create(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	body, err := h.parseBody(c)
	if err != nil {
		return err
	}
	if err := h.manage(c, orgID, body.Kind); err != nil {
		return err
	}
	s, _, err := h.build(body, nil)
	if err != nil {
		return err
	}
	s.OrganizationID = orgID
	repo := &h.app.Repositories.MCPServer
	if err := repo.Create(c.Context(), &s); err != nil {
		return err
	}
	recordActivity(c, h.app, orgID, constant.ActivityMCPServerAdded, "Added the MCP server "+s.Name, nil)

	if s.Kind == models.MCPKindHosted {
		_ = repo.SetStatus(c.Context(), s.ID, models.MCPStatusNeedsAuth, "Connect the server to sign in", nil)
	} else {
		// The outcome lands in the status either way.
		_, _ = mcptools.Sync(c.Context(), h.app, s, true)
	}
	if s, err = repo.Get(c.Context(), s.ID); err != nil {
		return err
	}
	return dtos.Created(c, h.view(s), "MCP server added")
}

// server loads the :id server after checking the user may see it.
func (h *mcpServerHandler) server(c fiber.Ctx) (models.MCPServer, error) {
	id, err := pathID(c, "MCP server")
	if err != nil {
		return models.MCPServer{}, err
	}
	s, err := h.app.Repositories.MCPServer.Get(c.Context(), id)
	if err != nil {
		return s, err
	}
	if _, err := member(c, h.app, s.OrganizationID); err != nil {
		return s, err
	}
	return s, nil
}

// Update changes a server; its kind stays. A new endpoint, command or
// credentials puts it back to pending and syncs it again.
func (h *mcpServerHandler) Update(c fiber.Ctx) error {
	saved, err := h.server(c)
	if err != nil {
		return err
	}
	body, err := h.parseBody(c)
	if err != nil {
		return err
	}
	if body.Kind != saved.Kind {
		return apperr.New(apperr.KindBadRequest, "a server's kind can't change; add a new server instead")
	}
	if err := h.manage(c, saved.OrganizationID, saved.Kind); err != nil {
		return err
	}
	s, _, err := h.build(body, &saved)
	if err != nil {
		return err
	}
	oldSec, _ := mcptools.OpenSecrets(h.app, saved)
	newSec, _ := mcptools.OpenSecrets(h.app, s)
	reset := s.URL != saved.URL || s.Command != saved.Command || !slices.Equal(s.Args, saved.Args) ||
		!sameMap(oldSec.Headers, newSec.Headers) || !sameMap(oldSec.Env, newSec.Env)

	repo := &h.app.Repositories.MCPServer
	if err := repo.Update(c.Context(), s, reset); err != nil {
		return err
	}
	recordActivity(c, h.app, s.OrganizationID, constant.ActivityMCPServerUpdated, "Updated the MCP server "+s.Name, nil)
	if reset {
		if s.Kind == models.MCPKindHosted && newSec.OAuth == nil {
			_ = repo.SetStatus(c.Context(), s.ID, models.MCPStatusNeedsAuth, "Connect the server to sign in", nil)
		} else {
			_, _ = mcptools.Sync(c.Context(), h.app, s, true)
		}
	}
	if s, err = repo.Get(c.Context(), s.ID); err != nil {
		return err
	}
	return dtos.OK(c, h.view(s))
}

func sameMap(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for key, value := range a {
		if other, ok := b[key]; !ok || other != value {
			return false
		}
	}
	return true
}

// Delete removes a server; the owner may remove any kind.
func (h *mcpServerHandler) Delete(c fiber.Ctx) error {
	s, err := h.server(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, s.OrganizationID); err != nil {
		return err
	}
	if err := h.app.Repositories.MCPServer.Delete(c.Context(), s.ID); err != nil {
		return err
	}
	recordActivity(c, h.app, s.OrganizationID, constant.ActivityMCPServerRemoved, "Removed the MCP server "+s.Name, nil)
	return dtos.Message(c, fiber.StatusOK, "MCP server removed")
}

// Sync lists the server's tools again and keeps them.
func (h *mcpServerHandler) Sync(c fiber.Ctx) error {
	return h.contact(c, true)
}

// Test connects and lists the tools without keeping them; the status still
// records how it went.
func (h *mcpServerHandler) Test(c fiber.Ctx) error {
	return h.contact(c, false)
}

func (h *mcpServerHandler) contact(c fiber.Ctx, keep bool) error {
	s, err := h.server(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, s.OrganizationID); err != nil {
		return err
	}
	tools, err := mcptools.Sync(c.Context(), h.app, s, keep)
	if err != nil {
		return apperr.New(apperr.KindBadGateway, "%s", err.Error())
	}
	if s, err = h.app.Repositories.MCPServer.Get(c.Context(), s.ID); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"server": h.view(s), "tool_count": len(tools)})
}

// TestDraft tests the add or edit form's values before they are saved;
// while editing, the saved server fills in blank secret values. A hosted
// server is tested by connecting it.
func (h *mcpServerHandler) TestDraft(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	var body dtos.MCPServerTestBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if err := body.Check(); err != nil {
		return err
	}
	if err := h.manage(c, orgID, body.Kind); err != nil {
		return err
	}
	if body.Kind == models.MCPKindHosted {
		return apperr.New(apperr.KindBadRequest, "save a hosted server and connect it to test it")
	}

	var saved *models.MCPServer
	if body.ID != "" {
		s, err := h.app.Repositories.MCPServer.Get(c.Context(), uuid.MustParse(body.ID))
		if err != nil {
			return err
		}
		if s.OrganizationID != orgID || s.Kind != body.Kind {
			return apperr.New(apperr.KindNotFound, "MCP server not found")
		}
		saved = &s
	}
	s, sec, err := h.build(body.MCPServerBody, saved)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Context(), mcptools.Timeout)
	defer cancel()
	tools, err := mcpclient.ListTools(ctx, mcpclient.Config{
		Kind: s.Kind, URL: s.URL, Headers: sec.Headers, Command: s.Command, Args: s.Args, Env: sec.Env,
		HTTPClient: h.app.HTTPClient,
	})
	if err != nil {
		_, message := mcptools.Failure(s.Kind, err)
		return apperr.New(apperr.KindBadGateway, "%s", message)
	}
	names := make([]string, len(tools))
	for i, t := range tools {
		names[i] = t.Name
	}
	return dtos.OK(c, fiber.Map{"tool_count": len(tools), "tools": names})
}

// OAuthStart begins a hosted server's sign-in: it discovers the server's
// authorization server and registers this app with it (once per URL), then
// answers the consent URL the browser goes to.
func (h *mcpServerHandler) OAuthStart(c fiber.Ctx) error {
	s, err := h.server(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, s.OrganizationID); err != nil {
		return err
	}
	if s.Kind != models.MCPKindHosted {
		return apperr.New(apperr.KindBadRequest, "only a hosted server signs in with OAuth")
	}
	origin, err := requestOrigin(c, h.app)
	if err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	sec, err := mcptools.OpenSecrets(h.app, s)
	if err != nil {
		sec = mcptools.Secrets{}
	}
	redirectURI := mcptools.RedirectURI(h.app.Config.Auth.BaseURL)
	if sec.OAuth == nil || sec.OAuth.ClientID == "" {
		ctx, cancel := context.WithTimeout(c.Context(), mcptools.Timeout)
		defer cancel()
		oauth, err := mcpclient.Discover(ctx, s.URL, redirectURI, h.app.HTTPClient)
		if err != nil {
			h.app.Logger.Warn("mcp oauth discovery", "server", s.ID, "error", err)
			return apperr.New(apperr.KindBadGateway, "couldn't start the server's sign-in: %s", err.Error())
		}
		sec.OAuth = &oauth
		if err := h.app.Repositories.MCPServer.SetSecrets(c.Context(), s.ID, mcptools.SealSecrets(h.app, sec)); err != nil {
			return err
		}
	}

	verifier := mailoauth.GenerateVerifier()
	state, err := mailoauth.SignState(h.app.Config.App.Secret, mailoauth.State{
		OrganizationID: s.OrganizationID.String(),
		Provider:       mcpStatePrefix + s.ID.String(),
		Origin:         origin,
		UserID:         uid.String(),
		Verifier:       verifier,
	})
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"auth_url": sec.OAuth.AuthCodeURL(redirectURI, state, verifier)})
}

// OAuthCallback is where a hosted server's sign-in returns the browser. It
// checks the state and hands the code back to the web app, which finishes
// with OAuthFinish as the user who started it; a callback with no caller of
// its own saves nothing, so a sign-in link someone else started can't put a
// victim's token on their server.
func (h *mcpServerHandler) OAuthCallback(c fiber.Ctx) error {
	back := func(origin, query string) error {
		return c.Redirect().To(origin + "/settings/mcp?" + query)
	}
	fail := func(origin string, err error) error {
		h.app.Logger.Warn("mcp oauth callback failed", "error", err)
		return back(origin, "error="+url.QueryEscape(err.Error()))
	}

	raw := c.Query("state")
	state, err := mailoauth.VerifyState(h.app.Config.App.Secret, raw)
	if err != nil {
		return fail(fallbackOrigin(h.app), err)
	}
	if !strings.HasPrefix(state.Provider, mcpStatePrefix) {
		return fail(state.Origin, errors.New("the sign-in state isn't an MCP server's"))
	}
	if c.Query("error") != "" {
		return fail(state.Origin, errors.New(c.Query("error_description", c.Query("error"))))
	}
	return back(state.Origin, "code="+url.QueryEscape(c.Query("code"))+"&state="+url.QueryEscape(raw))
}

// OAuthFinish trades the code the callback handed to the web app for the
// server's token, then syncs its tools. Only the user who started the
// sign-in may finish it, while they still own the organization.
func (h *mcpServerHandler) OAuthFinish(c fiber.Ctx) error {
	var body dtos.OAuthFinishBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	state, err := mailoauth.VerifyState(h.app.Config.App.Secret, body.State)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "%s", err.Error())
	}
	rawID, ok := strings.CutPrefix(state.Provider, mcpStatePrefix)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "the sign-in state isn't an MCP server's")
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	if state.UserID != uid.String() {
		return apperr.New(apperr.KindForbidden, "this sign-in was started by someone else: connect the server again")
	}
	id, err := uuid.Parse(rawID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "the server in the state is malformed")
	}
	s, err := h.app.Repositories.MCPServer.Get(c.Context(), id)
	if err != nil || s.OrganizationID.String() != state.OrganizationID {
		return apperr.New(apperr.KindNotFound, "the MCP server is gone")
	}
	if err := owner(c, h.app, s.OrganizationID); err != nil {
		return err
	}
	sec, err := mcptools.OpenSecrets(h.app, s)
	if err != nil || sec.OAuth == nil {
		return apperr.New(apperr.KindBadRequest, "start the sign-in again")
	}

	ctx, cancel := context.WithTimeout(c.Context(), mcptools.Timeout)
	defer cancel()
	token, err := sec.OAuth.Exchange(ctx, mcptools.RedirectURI(h.app.Config.Auth.BaseURL), body.Code, state.Verifier, h.app.HTTPClient)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "the sign-in wasn't accepted: %v", err)
	}
	sec.OAuth.Token = token
	s.Secrets = mcptools.SealSecrets(h.app, sec)
	if err := h.app.Repositories.MCPServer.SetSecrets(c.Context(), s.ID, s.Secrets); err != nil {
		return err
	}
	if _, err := mcptools.Sync(c.Context(), h.app, s, true); err != nil {
		return apperr.New(apperr.KindBadGateway, "%s", err.Error())
	}
	return dtos.OK(c, fiber.Map{"name": s.Name})
}
