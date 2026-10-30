package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/valyala/fasthttp"

	"montara-mail-agent/server/internal/lib/constant"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/mailagent"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
)

// agentHandler serves the mail copilot: conversations, the streaming chat,
// the approvals its proposals wait for, and the automation's draft queue.
type agentHandler struct {
	app  *app.Application
	sync *mailsync.Syncer
	runs runLimiter
}

// maxRunsPerUser bounds one user's agent answers in flight: each can make
// several paid model calls and minute-long tool calls, and the per-address
// rate limit alone would let them pile up.
const maxRunsPerUser = 2

// runLimiter counts each user's agent answers in flight.
//
// ponytail: counted per replica, so a user behind a load balancer gets that
// many per replica; count in shared storage once that matters.
type runLimiter struct {
	mu     sync.Mutex
	active map[uuid.UUID]int
}

func (l *runLimiter) acquire(uid uuid.UUID) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.active == nil {
		l.active = map[uuid.UUID]int{}
	}
	if l.active[uid] >= maxRunsPerUser {
		return false
	}
	l.active[uid]++
	return true
}

func (l *runLimiter) release(uid uuid.UUID) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.active[uid]--; l.active[uid] <= 0 {
		delete(l.active, uid)
	}
}

// conversationOf loads one conversation the caller owns, in an organization
// they belong to.
func (h *agentHandler) conversationOf(c fiber.Ctx, id uuid.UUID) (models.AgentConversation, error) {
	conv, err := h.app.Repositories.Agent.Conversation(c.Context(), id)
	if err != nil {
		return conv, err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return conv, apperr.ErrUnauthorized
	}
	if conv.UserID != uid {
		if _, err := member(c, h.app, conv.OrganizationID); err != nil {
			return conv, err
		}
		return conv, apperr.New(apperr.KindForbidden, "this conversation belongs to another user")
	}
	return conv, nil
}

// Conversations lists the caller's conversations in an organization.
func (h *agentHandler) Conversations(c fiber.Ctx) error {
	var q dtos.AgentConversationsQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	orgID, err := uuid.Parse(q.OrganizationID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "invalid organization id")
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	conversations, err := h.app.Repositories.Agent.Conversations(c.Context(), orgID, uid, 50)
	if err != nil {
		return err
	}
	return dtos.List(c, conversations, dtos.ListMeta(len(conversations), 0, len(conversations)))
}

// CreateConversation opens one, optionally bound to a mailbox.
func (h *agentHandler) CreateConversation(c fiber.Ctx) error {
	var body dtos.AgentConversationBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	conv := models.AgentConversation{UserID: uid, Title: "New conversation"}
	if body.EmailAccountID != "" {
		accountID, err := uuid.Parse(body.EmailAccountID)
		if err != nil {
			return apperr.New(apperr.KindBadRequest, "invalid email account id")
		}
		account, err := h.app.Repositories.EmailAccount.Get(c.Context(), accountID)
		if err != nil {
			return err
		}
		if _, err := member(c, h.app, account.OrganizationID); err != nil {
			return err
		}
		conv.OrganizationID = account.OrganizationID
		conv.EmailAccountID = &account.ID
	} else {
		return apperr.New(apperr.KindBadRequest, "a conversation needs a mailbox to work on")
	}

	if err := h.app.Repositories.Agent.CreateConversation(c.Context(), &conv); err != nil {
		return err
	}
	return dtos.Created(c, conv, "conversation created")
}

// Conversation returns one conversation with its messages and its actions, so
// the client can redraw the whole panel from one answer.
func (h *agentHandler) Conversation(c fiber.Ctx) error {
	id, err := pathID(c, "conversation")
	if err != nil {
		return err
	}
	conv, err := h.conversationOf(c, id)
	if err != nil {
		return err
	}
	messages, err := h.app.Repositories.Agent.Messages(c.Context(), conv.ID, 200)
	if err != nil {
		return err
	}
	actions, err := h.app.Repositories.Agent.ActionsOf(c.Context(), conv.ID, 50)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"conversation": conv, "messages": messages, "actions": actions})
}

// DeleteConversation forgets one conversation and its rows.
func (h *agentHandler) DeleteConversation(c fiber.Ctx) error {
	id, err := pathID(c, "conversation")
	if err != nil {
		return err
	}
	conv, err := h.conversationOf(c, id)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.Agent.DeleteConversation(c.Context(), conv.ID); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "conversation deleted")
}

// AgentChatStreamLimit bounds one streamed run, wider than the HTTP write
// timeout because tools legitimately take minutes. AgentChatPath is the SSE
// route's full path, so the server can drop its fixed write deadline for it.
const (
	AgentChatPath        = "/api/v1/agent/chat"
	AgentChatStreamLimit = 10 * time.Minute
)

// Chat answers one prompt over server-sent events: the run's tool progress,
// the final answer, and the proposals that wait for approval. Everything
// before the stream starts answers JSON as usual; once it starts, failures
// ride error events.
func (h *agentHandler) Chat(c fiber.Ctx) error {
	var body dtos.AgentChatBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	// The conversation: the named one, or a new one titled from the prompt.
	var conv models.AgentConversation
	if body.ConversationID != "" {
		id, err := uuid.Parse(body.ConversationID)
		if err != nil {
			return apperr.New(apperr.KindBadRequest, "invalid conversation id")
		}
		if conv, err = h.conversationOf(c, id); err != nil {
			return err
		}
	} else {
		title := strings.TrimSpace(body.Message)
		if len([]rune(title)) > 60 {
			title = string([]rune(title)[:60])
		}
		conv = models.AgentConversation{UserID: uid, Title: title, OrganizationID: uuid.Nil}
		if body.EmailAccountID != "" {
			accountID, err := uuid.Parse(body.EmailAccountID)
			if err != nil {
				return apperr.New(apperr.KindBadRequest, "invalid email account id")
			}
			account, err := h.app.Repositories.EmailAccount.Get(c.Context(), accountID)
			if err != nil {
				return err
			}
			if _, err := member(c, h.app, account.OrganizationID); err != nil {
				return err
			}
			conv.OrganizationID = account.OrganizationID
			conv.EmailAccountID = &account.ID
		}
	}
	if conv.OrganizationID == uuid.Nil {
		return apperr.New(apperr.KindBadRequest, "a conversation needs a mailbox to work on")
	}
	if _, err := member(c, h.app, conv.OrganizationID); err != nil {
		return err
	}
	if conv.ID == uuid.Nil {
		if err := h.app.Repositories.Agent.CreateConversation(c.Context(), &conv); err != nil {
			return err
		}
	}

	// The mailbox the turn works on: the conversation's binding, refreshed.
	if conv.EmailAccountID == nil {
		return apperr.New(apperr.KindBadRequest, "this conversation has no mailbox bound to it")
	}
	account, err := h.app.Repositories.EmailAccount.Get(c.Context(), *conv.EmailAccountID)
	if err != nil {
		return err
	}

	// The skill the user invoked with a /command, if any, and the persona the
	// turn speaks as: the skill's bot, else the one the caller picked, else
	// the built-in assistant. Either from another organization is a 404.
	var skill *models.AgentSkill
	var bot *models.AgentBot
	if body.Skill != "" {
		s, err := orgSkill(c, h.app, conv.OrganizationID, body.Skill)
		if err != nil {
			return err
		}
		if !s.IsEnabled {
			return apperr.New(apperr.KindConflict, "the skill %s is turned off", s.Name)
		}
		s.OrganizationID = conv.OrganizationID
		skill = &s
	}
	if skill != nil {
		bot, err = skillBot(c, h.app, *skill, body.AgentBotID)
	} else {
		bot, err = orgBot(c, h.app, conv.OrganizationID, body.AgentBotID)
	}
	if err != nil {
		return err
	}

	session := mailagent.Session{Conversation: conv, Account: account, MailID: body.MailID, Bot: bot, Skill: skill}

	// Server-sent events: fiber buffers its answer, so the run writes through
	// a stream writer and flushes event by event.
	if !h.runs.acquire(uid) {
		return apperr.New(apperr.KindTooManyRequests, "%d answers are already running: wait for one to finish", maxRunsPerUser)
	}
	c.Set(fiber.HeaderContentType, "text/event-stream")
	c.Set(fiber.HeaderCacheControl, "no-cache")
	c.Set("X-Accel-Buffering", "no")

	c.RequestCtx().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		defer h.runs.release(uid)
		emit := func(ev mailagent.Event) error {
			raw, err := json.Marshal(ev)
			if err != nil {
				return err
			}
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, raw); err != nil {
				return err
			}
			return w.Flush()
		}

		// The comment flushes the headers, so the client's EventSource-style
		// reader opens before the first real event.
		if _, err := w.WriteString(": open\n\n"); err != nil {
			return
		}
		if err := w.Flush(); err != nil {
			return
		}
		// Name the conversation first: the client that opened a fresh one
		// needs its id to keep talking into the same thread.
		if raw, err := json.Marshal(fiber.Map{"id": session.Conversation.ID}); err == nil {
			_ = emit(mailagent.Event{Type: mailagent.EventConversation, Payload: raw})
		}

		ctx, cancel := context.WithTimeout(context.Background(), AgentChatStreamLimit)
		defer cancel()
		if _, err := mailagent.Run(ctx, h.app, h.sync, session, body.Message, emit); err != nil {
			emit(mailagent.Event{Type: mailagent.EventError, Text: agentErrorText(err)})
		}
	}))
	return nil
}

// agentErrorText turns a run failure into the one line the user sees.
func agentErrorText(err error) string {
	if apperr.IsNotFound(err) {
		return "Something this turn needed is gone; try again."
	}
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return ae.Message
	}
	return "The agent could not finish this turn, try again."
}

// ApproveAction green-lights a proposed outbound mail and sends it.
func (h *agentHandler) ApproveAction(c fiber.Ctx) error {
	return h.decideAction(c, true)
}

// DenyAction refuses a proposed outbound mail.
func (h *agentHandler) DenyAction(c fiber.Ctx) error {
	return h.decideAction(c, false)
}

func (h *agentHandler) decideAction(c fiber.Ctx, approve bool) error {
	id, err := pathID(c, "action")
	if err != nil {
		return err
	}

	action, err := h.app.Repositories.Agent.Action(c.Context(), id)
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, action.OrganizationID); err != nil {
		return err
	}
	// A proposal is its conversation's owner's to decide, like the
	// conversation itself; another member reads it as missing.
	if uid, err := lib.ContextGetUID(c); err != nil || action.UserID != uid {
		return apperr.New(apperr.KindNotFound, "record not found in agent actions")
	}
	if action.Status != models.AgentActionPending {
		return apperr.New(apperr.KindConflict, "this proposal was already %s", action.Status)
	}

	if !approve {
		if err := h.app.Repositories.Agent.ClaimAction(c.Context(), action.ID, models.AgentActionDenied); err != nil {
			return err
		}
		action.Status = models.AgentActionDenied
		return dtos.OK(c, action)
	}

	// Execute after marking approved, so a crash mid-send reads as approved,
	// not as silently dropped.
	if err := h.app.Repositories.Agent.ClaimAction(c.Context(), action.ID, models.AgentActionApproved); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Minute)
	defer cancel()
	if err := h.executeAction(ctx, action); err != nil {
		if err := h.app.Repositories.Agent.SetActionStatus(c.Context(), action.ID, models.AgentActionFailed, err.Error()); err != nil {
			return err
		}
		return apperr.New(apperr.KindBadGateway, "the mail server refused the approved mail: %v", err)
	}
	if err := h.app.Repositories.Agent.SetActionStatus(c.Context(), action.ID, models.AgentActionDone, ""); err != nil {
		return err
	}
	action.Status = models.AgentActionDone
	h.logAction(action)
	return dtos.OK(c, action)
}

// executeAction sends one approved proposal through the same syncer the app's
// own send routes use.
func (h *agentHandler) executeAction(ctx context.Context, action models.AgentAction) error {
	var payload struct {
		MailID  *uuid.UUID `json:"mail_id"`
		To      []string   `json:"to"`
		Cc      []string   `json:"cc"`
		Subject string     `json:"subject"`
		Text    string     `json:"text"`
		Note    string     `json:"note"`
	}
	if err := json.Unmarshal(action.Payload, &payload); err != nil {
		return fmt.Errorf("the proposal's payload is malformed: %w", err)
	}

	conv, err := h.app.Repositories.Agent.Conversation(ctx, action.ConversationID)
	if err != nil {
		return err
	}
	if conv.EmailAccountID == nil {
		return fmt.Errorf("the conversation has no mailbox to send from")
	}
	account, err := h.app.Repositories.EmailAccount.Get(ctx, *conv.EmailAccountID)
	if err != nil {
		return err
	}

	// The plain text stands in as the HTML, like the app's own send route.
	htmlBody := `<div style="white-space:pre-wrap">` + html.EscapeString(payload.Text) + "</div>"

	switch action.Kind {
	case models.AgentActionReply:
		if payload.MailID == nil {
			return fmt.Errorf("the proposal names no email to reply to")
		}
		mail, err := h.app.Repositories.Mail.Get(ctx, *payload.MailID)
		if err != nil {
			return err
		}
		return h.sync.Reply(ctx, account, mail, payload.To, payload.Cc, payload.Text, htmlBody, nil)
	case models.AgentActionSend:
		return h.sync.Compose(ctx, account, payload.To, payload.Cc, payload.Subject, payload.Text, htmlBody, nil)
	case models.AgentActionFwd:
		if payload.MailID == nil {
			return fmt.Errorf("the proposal names no email to forward")
		}
		mail, err := h.app.Repositories.Mail.Get(ctx, *payload.MailID)
		if err != nil {
			return err
		}
		return h.sync.Forward(ctx, account, mail, payload.To, payload.Note)
	}
	return fmt.Errorf("unknown action kind %q", action.Kind)
}

// logAction records an agent-sent mail in the activity log.
func (h *agentHandler) logAction(action models.AgentAction) {
	var payload struct {
		To      []string `json:"to"`
		Subject string   `json:"subject"`
	}
	_ = json.Unmarshal(action.Payload, &payload)

	entry := models.ActivityLog{
		UserID:         &action.UserID,
		OrganizationID: &action.OrganizationID,
		Action:         constant.ActivityMailSent,
		Description:    fmt.Sprintf("Sent the mail the AI agent proposed, to %s", strings.Join(payload.To, ", ")),
		UserAgent:      "montara-agent",
	}
	h.app.Repositories.ActivityLog.Record(context.Background(), entry)
}

// Drafts lists the automation's draft queue for one organization.
func (h *agentHandler) Drafts(c fiber.Ctx) error {
	var q dtos.AgentDraftsQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	orgID, err := uuid.Parse(q.OrganizationID)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "invalid organization id")
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}

	drafts, err := h.app.Repositories.Agent.Drafts(c.Context(), orgID, q.Status, 50)
	if err != nil {
		return err
	}
	return dtos.List(c, drafts, dtos.ListMeta(len(drafts), 0, len(drafts)))
}

// ApproveDraft sends a queued draft as a reply.
func (h *agentHandler) ApproveDraft(c fiber.Ctx) error {
	draft, err := h.decideDraft(c, models.AgentDraftSent)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Minute)
	defer cancel()
	if err := h.sendDraft(ctx, draft); err != nil {
		return apperr.New(apperr.KindBadGateway, "the mail server refused the draft: %v", err)
	}
	h.app.Repositories.ActivityLog.Record(context.Background(), models.ActivityLog{
		UserID:         draft.DecidedBy,
		OrganizationID: &draft.OrganizationID,
		Action:         constant.ActivityMailSent,
		Description:    fmt.Sprintf("Sent the AI agent's queued reply, to %s", strings.Join(draft.To, ", ")),
		UserAgent:      "montara-agent",
	})
	return dtos.OK(c, draft)
}

// DiscardDraft drops a queued draft.
func (h *agentHandler) DiscardDraft(c fiber.Ctx) error {
	draft, err := h.decideDraft(c, models.AgentDraftDiscarded)
	if err != nil {
		return err
	}
	return dtos.OK(c, draft)
}

// decideDraft loads a pending draft, checks the caller, and sets its new
// status with the decider recorded.
func (h *agentHandler) decideDraft(c fiber.Ctx, status string) (models.AgentDraft, error) {
	id, err := pathID(c, "draft")
	if err != nil {
		return models.AgentDraft{}, err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return models.AgentDraft{}, apperr.ErrUnauthorized
	}

	draft, err := h.app.Repositories.Agent.Draft(c.Context(), id)
	if err != nil {
		return draft, err
	}
	if _, err := member(c, h.app, draft.OrganizationID); err != nil {
		return draft, err
	}
	if draft.Status != models.AgentDraftPending {
		return draft, apperr.New(apperr.KindConflict, "this draft was already %s", draft.Status)
	}
	if err := h.app.Repositories.Agent.SetDraftStatus(c.Context(), draft.ID, status, uid); err != nil {
		return draft, err
	}
	draft.Status = status
	draft.DecidedBy = &uid
	return draft, nil
}

// sendDraft sends an approved draft as a reply to the mail it came from.
func (h *agentHandler) sendDraft(ctx context.Context, draft models.AgentDraft) error {
	if draft.MailID == nil {
		return fmt.Errorf("the draft names no email to reply to")
	}
	mail, err := h.app.Repositories.Mail.Get(ctx, *draft.MailID)
	if err != nil {
		return err
	}
	account, err := h.app.Repositories.EmailAccount.Get(ctx, draft.EmailAccountID)
	if err != nil {
		return err
	}
	htmlBody := `<div style="white-space:pre-wrap">` + html.EscapeString(draft.Text) + "</div>"
	return h.sync.Reply(ctx, account, mail, draft.To, draft.Cc, draft.Text, htmlBody, nil)
}
