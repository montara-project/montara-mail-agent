package main

import (
	"context"
	"time"

	authula "github.com/Authula/authula"
	authulamodels "github.com/Authula/authula/models"
	accesscontrolplugin "github.com/Authula/authula/plugins/access-control"
	accesscontrolplugintypes "github.com/Authula/authula/plugins/access-control/types"
	apikeyplugin "github.com/Authula/authula/plugins/api-key"
	apikeyplugintypes "github.com/Authula/authula/plugins/api-key/types"

	"montara-mail-agent/server/internal/app"
)

// apiKeyPrefix starts every key, so a leaked one is recognisable in logs and
// secret scanners.
const apiKeyPrefix = "mm_"

// apiKeyPlugins adds the API keys that sign in to /mcp: the api-key plugin
// and the access-control plugin it depends on. Both keep their tables and
// services, and neither may add hooks or routes. The api-key hook would
// accept a key on every Authula route as a full sign-in, so a key leaked
// from an MCP client could mint a token pair at POST /token; and the
// access-control routes manage roles no one here should edit. Keys are
// created and checked through app.Application.APIKeys instead.
func apiKeyPlugins() []authulamodels.Plugin {
	return []authulamodels.Plugin{
		// Initialised first: the api-key plugin looks up its service.
		servicesOnlyAccessControl{accesscontrolplugin.New(accesscontrolplugintypes.AccessControlPluginConfig{Enabled: true})},
		servicesOnlyAPIKey{apikeyplugin.New(apikeyplugintypes.ApiKeyPluginConfig{
			DefaultPrefix:   apiKeyPrefix,
			AutoCleanup:     true,
			CleanupInterval: time.Hour,
		})},
	}
}

// apiKeyPluginsConfig switches the api-key plugin on: unlike the others, its
// config has no Enabled field, and Authula skips a plugin it can't see enabled.
var apiKeyPluginsConfig = authulamodels.PluginsConfig{
	authulamodels.PluginApiKey.String(): map[string]any{"enabled": true},
}

type servicesOnlyAccessControl struct {
	*accesscontrolplugin.AccessControlPlugin
}

func (servicesOnlyAccessControl) Hooks() []authulamodels.Hook   { return nil }
func (servicesOnlyAccessControl) Routes() []authulamodels.Route { return nil }

type servicesOnlyAPIKey struct {
	*apikeyplugin.ApiKeyPlugin
}

func (servicesOnlyAPIKey) Hooks() []authulamodels.Hook   { return nil }
func (servicesOnlyAPIKey) Routes() []authulamodels.Route { return nil }

// Init also publishes the plugin's API, which it keeps to itself otherwise.
func (p servicesOnlyAPIKey) Init(ctx *authulamodels.PluginContext) error {
	if err := p.ApiKeyPlugin.Init(ctx); err != nil {
		return err
	}
	ctx.ServiceRegistry.Register(app.APIKeyService, p.Api)
	return nil
}

// deleteAPIKeys revokes every API key of one user.
func deleteAPIKeys(ctx context.Context, auth *authula.Auth, userID string) error {
	keys, ok := auth.ServiceRegistry.Get(app.APIKeyService).(*apikeyplugin.API)
	if !ok {
		return nil
	}
	return keys.DeleteAllByOwner(ctx, &authulamodels.Actor{ID: userID, Type: authulamodels.ActorUser}, apikeyplugintypes.OwnerTypeUser, userID)
}
