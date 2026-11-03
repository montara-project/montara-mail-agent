package handlers

import (
	"crypto/subtle"
	"errors"
	"math"
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
	"montara-mail-agent/server/internal/repositories"
)

// Pay-as-you-go tokens: a 10M floor in 1M steps, Rp1.000 per 1M, bought
// straight from the IDR wallet, never expiring.
const (
	topupTokens        = 10_000_000
	topupTokenStep     = 1_000_000
	topupIDRPerMillion = 1_000
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
	limit := h.app.WeeklyTokenLimit(plan)
	balance, err := h.app.Repositories.TokenBalance.Balance(ctx, uid, limit)
	if err != nil {
		return err
	}

	out := quotaStatus{Plan: plan, UsedTokens: used, PaygTokens: balance}
	// A super user is always unlimited, whatever their plan row says.
	if role != constant.RoleSuperUser {
		out.LimitTokens = h.app.WeeklyTokenLimit(plan)
	}
	return dtos.OK(c, out)
}

// topupView is a bought token package: the wallet purchase is instant, so a
// fresh row is already paid and pay_url stays empty.
type topupView struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	AmountIDR int    `json:"amount_idr"`
	Tokens    int64  `json:"tokens"`
	PayURL    string `json:"pay_url"`
}

// CreateTopup buys pay-as-you-go tokens at Rp1.000 per 1M tokens: the design's
// presets and its custom field both post a token count, the floor is 10M and
// the steps are 1M. The wallet pays at once; the gateway answers a pending
// top-up with its QRIS checkout, which the BorderPay webhook credits.
func (h *quotaHandler) CreateTopup(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var body dtos.QuotaTopupBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if body.Tokens < topupTokens {
		return apperr.New(apperr.KindBadRequest, "The smallest purchase is 10M tokens")
	}
	if body.Tokens%topupTokenStep != 0 {
		return apperr.New(apperr.KindBadRequest, "Tokens come in steps of 1M")
	}
	// token_topups.amount_idr is an INTEGER.
	amount := body.Tokens / topupTokenStep * topupIDRPerMillion
	if amount > math.MaxInt32 {
		return apperr.New(apperr.KindBadRequest, "This purchase is too large")
	}
	switch body.Method {
	case "", "wallet":
	case "gateway":
		return h.topupThroughGateway(c, uid, body.Tokens, int(amount))
	default:
		return apperr.New(apperr.KindBadRequest, "Pay with the wallet or the gateway")
	}
	t, err := h.app.Repositories.TokenTopup.BuyFromWallet(c.Context(), uid, body.Tokens, int(amount))
	if errors.Is(err, repositories.ErrInsufficientWalletBalance) {
		return apperr.New(apperr.KindPaymentRequired, "Not enough wallet balance. Top up your wallet first.")
	}
	if err != nil {
		return err
	}
	return dtos.OK(c, topupView{ID: t.ID.String(), Status: t.Status, AmountIDR: t.AmountIDR, Tokens: t.Tokens})
}

// topupThroughGateway records a pending top-up and opens its BorderPay QRIS
// checkout; the webhook marks it paid and credits the tokens.
func (h *quotaHandler) topupThroughGateway(c fiber.Ctx, uid uuid.UUID, tokens int64, amount int) error {
	if h.app.Config.BorderPay.APIKey == "" {
		return apperr.New(apperr.KindUnavailable, "Paying by QRIS is not available on this server")
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	t := models.TokenTopup{ID: id, UserID: uid, AmountIDR: amount, Tokens: tokens, ReferenceID: id.String()}
	if err := h.app.Repositories.TokenTopup.Create(c.Context(), t); err != nil {
		return err
	}
	returnURL := strings.TrimSuffix(h.app.Config.BorderPay.ReturnURL, "/")
	payURL, err := borderPayCheckout(c.Context(), h.app, int64(amount), t.ReferenceID, returnURL)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.TokenTopup.SetPayment(c.Context(), id, payURL); err != nil {
		return err
	}
	return dtos.OK(c, topupView{
		ID: id.String(), Status: models.TopupStatusPending, AmountIDR: amount, Tokens: tokens, PayURL: payURL,
	})
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

// ListTopups returns one page of the signed-in user's top-up history.
func (h *quotaHandler) ListTopups(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	topups, err := h.app.Repositories.TokenTopup.ListByUser(c.Context(), uid, q.Offset, q.Limit)
	if err != nil {
		return err
	}
	total, err := h.app.Repositories.TokenTopup.CountByUser(c.Context(), uid)
	if err != nil {
		return err
	}
	return dtos.List(c, topups, dtos.ListMeta(total, q.Offset, q.Limit))
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

	// Dispatch by reference: whichever pending row carries the reference_id
	// transitions; a reference in none of them is a replay or a stray.
	if _, transitioned, err := h.app.Repositories.TokenTopup.MarkPaidAndCredit(c.Context(), body.Data.ReferenceID); err != nil {
		return err
	} else if transitioned {
		return dtos.Message(c, fiber.StatusOK, "credited")
	}
	if _, transitioned, err := h.app.Repositories.Wallet.MarkTopupPaidAndCredit(c.Context(), body.Data.ReferenceID); err != nil {
		return err
	} else if transitioned {
		return dtos.Message(c, fiber.StatusOK, "credited")
	}
	if _, transitioned, err := h.app.Repositories.Subscription.MarkPaidAndActivate(c.Context(), body.Data.ReferenceID); err != nil {
		return err
	} else if transitioned {
		return dtos.Message(c, fiber.StatusOK, "activated")
	}
	return dtos.Message(c, fiber.StatusOK, "already processed")
}
