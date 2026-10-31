package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/models"
)

type billingHandler struct{ app *app.Application }

// borderPayCheckout calls BorderPay's create-payment API: a QRIS payment for
// amount rupiah under referenceID, returning the user to returnURL. Shared by
// the token top-ups (quota.go) and the billing module's checkouts.
func borderPayCheckout(ctx context.Context, a *app.Application, amount int64, referenceID, returnURL string) (string, error) {
	cfg := a.Config.BorderPay
	body, err := json.Marshal(map[string]any{
		"amount":       amount,
		"method":       "qris",
		"reference_id": referenceID,
		"return_url":   returnURL,
	})
	if err != nil {
		return "", err
	}
	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/api/v1/payments", bytes.NewReader(body))
	if reqErr != nil {
		return "", reqErr
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, respErr := a.HTTPClient.Do(req)
	if respErr != nil {
		return "", apperr.New(apperr.KindBadGateway, "couldn't reach BorderPay: try again")
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusCreated {
		a.Logger.Warn("borderpay create payment failed", "status", resp.StatusCode, "body", string(raw))
		return "", apperr.New(apperr.KindBadGateway, "BorderPay refused the payment: try again")
	}
	var out struct {
		PayURL   string `json:"pay_url"`
		QRString string `json:"qr_string"`
		ExpireAt string `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", apperr.New(apperr.KindBadGateway, "BorderPay answered something unexpected")
	}
	return out.PayURL, nil
}

// Plans lists the active plans for the pricing UI.
func (h *billingHandler) Plans(c fiber.Ctx) error {
	plans, err := h.app.Repositories.Plan.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, plans, dtos.ListMeta(len(plans), 0, len(plans)))
}

// Subscription returns the signed-in user's live (pending or active)
// subscription, or null when they have none.
func (h *billingHandler) Subscription(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	sub, err := h.app.Repositories.Subscription.LiveByUser(c.Context(), uid)
	if apperr.IsNotFound(err) {
		return dtos.OK(c, nil)
	}
	if err != nil {
		return err
	}
	return dtos.OK(c, sub)
}

// Checkout starts a subscription: a pending subscription row plus a
// BorderPay QRIS checkout; the webhook activates it on payment.
func (h *billingHandler) Checkout(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	if h.app.Config.BorderPay.APIKey == "" {
		return apperr.New(apperr.KindUnavailable, "Billing is not available on this server")
	}
	var body dtos.BillingCheckoutBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	plan, err := h.app.Repositories.Plan.ByCode(c.Context(), body.PlanCode)
	if err != nil {
		return err
	}
	if !plan.Active || plan.BillingInterval == nil {
		return apperr.New(apperr.KindBadRequest, "This plan cannot be purchased")
	}
	_, liveErr := h.app.Repositories.Subscription.LiveByUser(c.Context(), uid)
	if liveErr == nil {
		return apperr.New(apperr.KindConflict, "You already have a subscription in progress")
	} else if !apperr.IsNotFound(liveErr) {
		return liveErr
	}

	amount := plan.EffectivePrice(time.Now())
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	sub := models.Subscription{
		ID: id, UserID: uid, PlanID: plan.ID,
		Amount: amount, Currency: plan.Currency, ReferenceID: id.String(),
		PlanCode: plan.Code, PlanName: plan.Name, BillingInterval: plan.BillingInterval,
	}
	if err := h.app.Repositories.Subscription.Create(c.Context(), sub); err != nil {
		return err
	}
	returnURL := strings.TrimSuffix(h.app.Config.BorderPay.ReturnURL, "/")
	payURL, err := borderPayCheckout(c.Context(), h.app, amount, sub.ReferenceID, returnURL)
	if err != nil {
		return err
	}
	sub.PayURL = payURL
	if err := h.app.Repositories.Subscription.SetPayment(c.Context(), id, payURL); err != nil {
		return err
	}
	return dtos.Created(c, sub, "subscription checkout created")
}

// Wallet returns the signed-in user's IDR balance.
func (h *billingHandler) Wallet(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	balance, err := h.app.Repositories.Wallet.Balance(c.Context(), uid)
	if err != nil {
		return err
	}
	return dtos.OK(c, models.WalletBalance{BalanceIDR: balance})
}

// WalletTransactions returns one page of the wallet ledger.
func (h *billingHandler) WalletTransactions(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	txns, err := h.app.Repositories.Wallet.ListTransactionsByUser(c.Context(), uid, q.Offset, q.Limit)
	if err != nil {
		return err
	}
	total, err := h.app.Repositories.Wallet.CountTransactionsByUser(c.Context(), uid)
	if err != nil {
		return err
	}
	return dtos.List(c, txns, dtos.ListMeta(total, q.Offset, q.Limit))
}

// WalletTopup starts an IDR top-up for the wallet: min Rp10.000, any amount,
// through BorderPay's QRIS checkout; the webhook credits the wallet.
func (h *billingHandler) WalletTopup(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	if h.app.Config.BorderPay.APIKey == "" {
		return apperr.New(apperr.KindUnavailable, "Top up is not available on this server")
	}
	var body dtos.BillingWalletTopupBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if body.AmountIDR < 10_000 {
		return apperr.New(apperr.KindBadRequest, "The smallest top-up is Rp10.000")
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	t := models.WalletTopup{ID: id, UserID: uid, AmountIDR: body.AmountIDR, ReferenceID: id.String()}
	if err := h.app.Repositories.Wallet.CreateTopup(c.Context(), t); err != nil {
		return err
	}
	returnURL := strings.TrimSuffix(h.app.Config.BorderPay.ReturnURL, "/")
	payURL, err := borderPayCheckout(c.Context(), h.app, body.AmountIDR, t.ReferenceID, returnURL)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.Wallet.SetTopupPayment(c.Context(), id, payURL); err != nil {
		return err
	}
	t.PayURL = payURL
	return dtos.Created(c, t, "wallet top-up created")
}

// WalletTopups returns one page of the wallet top-up history.
func (h *billingHandler) WalletTopups(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	topups, err := h.app.Repositories.Wallet.ListTopupsByUser(c.Context(), uid, q.Offset, q.Limit)
	if err != nil {
		return err
	}
	total, err := h.app.Repositories.Wallet.CountTopupsByUser(c.Context(), uid)
	if err != nil {
		return err
	}
	return dtos.List(c, topups, dtos.ListMeta(total, q.Offset, q.Limit))
}

// AutoRenew flips the subscription's renewal switch; the daily sweep honors
// it at period end. The user can switch it back on until the sweep expires
// the row.
func (h *billingHandler) AutoRenew(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var body dtos.BillingAutoRenewBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if err := h.app.Repositories.Subscription.SetAutoRenew(c.Context(), uid, body.Enabled); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "auto-renew updated")
}
