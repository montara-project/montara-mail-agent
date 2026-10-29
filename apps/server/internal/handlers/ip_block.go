package handlers

import (
	"net/netip"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/ipblock"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
)

// ipBlockHandler manages the addresses the whole server refuses: a super
// user's own blocks and the ones the server made after repeated failures.
type ipBlockHandler struct {
	app *app.Application
}

// superUser lets only a super user through: a block shuts an address out of
// every organization.
func (h *ipBlockHandler) superUser(c fiber.Ctx) (uuid.UUID, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return uuid.Nil, apperr.ErrUnauthorized
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return uuid.Nil, err
	}
	if !super {
		return uuid.Nil, apperr.New(apperr.KindForbidden, "only a super user manages IP blocks")
	}
	return uid, nil
}

// List returns the blocks in force, newest first; the metadata states the
// automatic rule, for the page to explain it.
func (h *ipBlockHandler) List(c fiber.Ctx) error {
	if _, err := h.superUser(c); err != nil {
		return err
	}
	blocks, err := h.app.Repositories.IPBlock.Active(c.Context())
	if err != nil {
		return err
	}
	meta := dtos.ListMeta(len(blocks), 0, len(blocks))
	meta["auto"] = fiber.Map{
		"failed_sign_ins": ipblock.FailedSignInLimit,
		"rate_limit_hits": ipblock.RateLimitLimit,
		"window_minutes":  int(ipblock.Window / time.Minute),
		"block_minutes":   int(ipblock.AutoBlockFor / time.Minute),
	}
	meta["your_ip"] = c.IP()
	return dtos.List(c, blocks, meta)
}

// Create blocks an address or a range. The caller's own address is refused,
// so a super user cannot lock themselves out from where they sit.
func (h *ipBlockHandler) Create(c fiber.Ctx) error {
	uid, err := h.superUser(c)
	if err != nil {
		return err
	}
	var body dtos.IPBlockBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	network, err := ipblock.ParseNetwork(body.Address)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "%s", err.Error())
	}
	if self, err := netip.ParseAddr(c.IP()); err == nil && network.Contains(self.Unmap()) {
		return apperr.New(apperr.KindBadRequest, "%s includes your own address (%s): you would be locked out", network, c.IP())
	}

	var expires *time.Time
	if body.ExpiresInHours > 0 {
		at := time.Now().UTC().Add(time.Duration(body.ExpiresInHours) * time.Hour)
		expires = &at
	}
	id, err := h.app.Repositories.IPBlock.BlockManual(c.Context(), network.String(), body.Reason, expires, uid)
	if err != nil {
		return err
	}
	if err := h.app.IPBlocks.Reload(c.Context()); err != nil {
		return err
	}
	block, err := h.app.Repositories.IPBlock.Get(c.Context(), id)
	if err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityIPBlockAdded, "Blocked "+network.String(), map[string]any{"network": network.String(), "reason": body.Reason})
	return dtos.Created(c, block, "address blocked")
}

// Delete lifts a block, manual or automatic, and lets the address start over.
func (h *ipBlockHandler) Delete(c fiber.Ctx) error {
	if _, err := h.superUser(c); err != nil {
		return err
	}
	id, err := pathID(c, "IP block")
	if err != nil {
		return err
	}
	block, err := h.app.Repositories.IPBlock.Get(c.Context(), id)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.IPBlock.Delete(c.Context(), id); err != nil {
		return err
	}
	if network, err := netip.ParsePrefix(block.Network); err == nil {
		h.app.IPBlocks.Forget(network)
	}
	if err := h.app.IPBlocks.Reload(c.Context()); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityIPBlockRemoved, "Unblocked "+block.Network, map[string]any{"network": block.Network, "source": block.Source})
	return dtos.Message(c, fiber.StatusOK, "address unblocked")
}
