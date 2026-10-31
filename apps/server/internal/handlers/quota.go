package handlers

import (
	"bytes"
	"context"
	"crypto/subtle"
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
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/period"
	"montara-mail-agent/server/internal/lib/validator"
	"montara-mail-agent/server/internal/models"
)

// The one top-up package: 10M tokens per Rp10,000, pay-as-you-go, no expiry.
const (
	topupAmountIDR = 10_000
	topupTokens    = 10_000_000
)

type quotaHandler struct{ app *app.Application }

// quotaStatus is GET /me/quota's answer: the plan, the week's usage against
// the plan's allowance, and the pay-as-you-go balance. limit_tokens is null
// when the plan is subscribed: the app shows that as Unlimited.
type quotaStatus struct {
	Plan        string `json:"plan"`
	UsedTokens  int64  `json:"used_tokens"`
	LimitTokens *int64 `json:"limit_tokens"`
	PaygTokens  int64  `json:"payg_balance_tokens"`
}

func (h *quotaHandler) Status(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	ctx := c.Context()

	role, err := h.app.Repositories.User.Role(ctx, uid)
	if err != nil {
		return err
	}
	plan, err := h.app.Repositories.User.Plan(ctx, uid)
	if err != nil {
		return err
	}

	weekStart := period.WeekStart(time.Now())
	used, err := h.app.Repositories.TokenUsage.SumSince(ctx, uid, weekStart)
	if err != nil {
		return err
	}
	limit := h.app.Config.Quota.FreeWeeklyTokens
	if plan == constant.PlanSubscribed {
		limit = h.app.Config.Quota.SubscribedWeeklyTokens
	}
	balance, err := h.app.Repositories.TokenBalance.Balance(ctx, uid, limit)
	if err != nil {
		return err
	}

	out := quotaStatus{Plan: plan, UsedTokens: used, PaygTokens: balance}
	if plan != constant.PlanSubscribed && role != constant.RoleSuperUser {
		out.LimitTokens = &limit
	}
	return dtos.OK(c, out)
}

// topupView is a created top-up: everything the app needs to take the user
// to BorderPay's checkout.
type topupView struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	AmountIDR int    `json:"amount_idr"`
	Tokens    int64  `json:"tokens"`
	PayURL    string `json:"pay_url"`
}

// CreateTopup starts one pay-as-you-go purchase: 10M tokens for Rp10,000
// through BorderPay's QRIS checkout.
func (h *quotaHandler) CreateTopup(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	if h.app.Config.BorderPay.APIKey == "" {
		return apperr.New(apperr.KindUnavailable, "Top up is not available on this server")
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	t := models.TokenTopup{ID: id, UserID: uid, AmountIDR: topupAmountIDR, Tokens: topupTokens, ReferenceID: id.String()}
	if err := h.app.Repositories.TokenTopup.Create(c.Context(), t); err != nil {
		return err
	}

	payURL, _, _, err := h.createBorderPayPayment(c.Context(), t)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.TokenTopup.SetPayment(c.Context(), id, payURL); err != nil {
		return err
	}
	return dtos.OK(c, topupView{ID: id.String(), Status: models.TopupStatusPending, AmountIDR: topupAmountIDR, Tokens: topupTokens, PayURL: payURL})
}

// createBorderPayPayment calls BorderPay's create-payment API: QRIS, the
// fixed package, our top-up id as the merchant reference.
func (h *quotaHandler) createBorderPayPayment(ctx context.Context, t models.TokenTopup) (payURL, qrString, expiresAt string, err error) {
	cfg := h.app.Config.BorderPay
	// The customer returns to this top-up's own invoice page.
	returnURL := strings.TrimSuffix(cfg.ReturnURL, "/") + "/invoice/" + t.ID.String()
	body, err := json.Marshal(map[string]any{
		"amount":       t.AmountIDR,
		"method":       "qris",
		"reference_id": t.ReferenceID,
		"return_url":   returnURL,
	})
	if err != nil {
		return "", "", "", err
	}
	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/api/v1/payments", bytes.NewReader(body))
	if reqErr != nil {
		return "", "", "", reqErr
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, respErr := h.app.HTTPClient.Do(req)
	if respErr != nil {
		return "", "", "", apperr.New(apperr.KindBadGateway, "couldn't reach BorderPay: try again")
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusCreated {
		h.app.Logger.Warn("borderpay create payment failed", "status", resp.StatusCode, "body", string(raw))
		return "", "", "", apperr.New(apperr.KindBadGateway, "BorderPay refused the payment: try again")
	}
	var out struct {
		PayURL    string `json:"pay_url"`
		QRString  string `json:"qr_string"`
		ExpiresAt string `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", "", apperr.New(apperr.KindBadGateway, "BorderPay answered something unexpected")
	}
	return out.PayURL, out.QRString, out.ExpiresAt, nil
}

// GetTopup returns one of the signed-in user's top-ups, for the invoice page.
func (h *quotaHandler) GetTopup(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return apperr.New(apperr.KindNotFound, "record not found in token_topups")
	}
	t, err := h.app.Repositories.TokenTopup.ByIDForUser(c.Context(), id, uid)
	if err != nil {
		return err
	}
	return dtos.OK(c, t)
}

// ListTopups returns the signed-in user's top-up history.
func (h *quotaHandler) ListTopups(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	topups, err := h.app.Repositories.TokenTopup.ListByUser(c.Context(), uid, 50)
	if err != nil {
		return err
	}
	return dtos.OK(c, topups)
}

// borderpayWebhook is BorderPay's push on a status change: verify the shared
// token, persist the paid state (idempotent), credit the balance, then
// answer 200 only after the data is saved.
type borderpayWebhookBody struct {
	Event string `json:"event"`
	Data  struct {
		ReferenceID string `json:"reference_id"`
		Status      string `json:"status"`
	} `json:"data"`
}

func (body borderpayWebhookBody) Validate(v *validator.MapValidator) {
	v.Field("event").String().MaxLen(100)
	v.Field("data").Required()
}

func (h *quotaHandler) BorderPayWebhook(c fiber.Ctx) error {
	// The shared token compares in constant time; an unconfigured token
	// refuses everything, so an unset endpoint can't be tricked open.
	if h.app.Config.BorderPay.WebhookToken == "" ||
		subtle.ConstantTimeCompare([]byte(c.Get("x-borderpay-token")), []byte(h.app.Config.BorderPay.WebhookToken)) != 1 {
		return apperr.ErrUnauthorized
	}
	var body borderpayWebhookBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if body.Event != "payment.paid" || body.Data.Status != "paid" {
		return dtos.Message(c, fiber.StatusOK, "ignored")
	}

	if _, transitioned, err := h.app.Repositories.TokenTopup.MarkPaidAndCredit(c.Context(), body.Data.ReferenceID); err != nil {
		return err
	} else if !transitioned {
		// A replay: the status flip and the credit committed together once.
		return dtos.Message(c, fiber.StatusOK, "already processed")
	}
	return dtos.Message(c, fiber.StatusOK, "credited")
}
