package handlers

import (
	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// agentBotHandler manages the organizations' AI agent personas.
type agentBotHandler struct {
	app *app.Application
}

// agentBotView is a bot as the API shows it: its fields plus the system
// prompt they compose, so the form can preview what the model receives.
// (The runtime prompt adds the date and the mailbox on top of this.)
type agentBotView struct {
	models.AgentBot
	SystemPrompt string `json:"system_prompt"`
}

func newAgentBotView(b models.AgentBot) agentBotView {
	return agentBotView{AgentBot: b, SystemPrompt: b.Persona()}
}

// List returns an organization's live bots, the default first.
func (h *agentBotHandler) List(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}

	bots, err := h.app.Repositories.AgentBot.List(c.Context(), orgID)
	if err != nil {
		return err
	}
	views := make([]agentBotView, 0, len(bots))
	for _, b := range bots {
		views = append(views, newAgentBotView(b))
	}
	return dtos.List(c, views, dtos.ListMeta(len(views), 0, len(views)))
}

// Get returns one bot.
func (h *agentBotHandler) Get(c fiber.Ctx) error {
	bot, err := h.bot(c)
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, bot.OrganizationID); err != nil {
		return err
	}
	return dtos.Get(c, newAgentBotView(bot))
}

// Create adds a bot to an organization; owner only, like the other
// organization settings.
func (h *agentBotHandler) Create(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, orgID); err != nil {
		return err
	}

	var body dtos.AgentBotBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	bot := models.AgentBot{
		OrganizationID: orgID,
		Name:           body.Name,
		Description:    body.Description,
		Soul:           body.Soul,
		Memory:         body.Memory,
		Style:          body.Style,
		Instruction:    body.Instruction,
		IsDefault:      body.IsDefault,
	}
	if err := h.app.Repositories.AgentBot.Create(c.Context(), &bot); err != nil {
		return err
	}
	recordActivity(c, h.app, orgID, constant.ActivityAgentBotCreated, "Created the agent bot "+bot.Name, nil)
	return dtos.Created(c, newAgentBotView(bot), "agent bot created")
}

// Update rewrites a bot's fields.
func (h *agentBotHandler) Update(c fiber.Ctx) error {
	bot, err := h.bot(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, bot.OrganizationID); err != nil {
		return err
	}

	var body dtos.AgentBotBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	bot.Name = body.Name
	bot.Description = body.Description
	bot.Soul = body.Soul
	bot.Memory = body.Memory
	bot.Style = body.Style
	bot.Instruction = body.Instruction
	bot.IsDefault = body.IsDefault
	if err := h.app.Repositories.AgentBot.Update(c.Context(), bot); err != nil {
		return err
	}
	recordActivity(c, h.app, bot.OrganizationID, constant.ActivityAgentBotUpdated, "Updated the agent bot "+bot.Name, nil)

	updated, err := h.app.Repositories.AgentBot.Get(c.Context(), bot.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, newAgentBotView(updated))
}

// Delete removes a bot; drafts it drafted keep their text.
func (h *agentBotHandler) Delete(c fiber.Ctx) error {
	bot, err := h.bot(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, bot.OrganizationID); err != nil {
		return err
	}
	if err := h.app.Repositories.AgentBot.Delete(c.Context(), bot.ID); err != nil {
		return err
	}
	recordActivity(c, h.app, bot.OrganizationID, constant.ActivityAgentBotDeleted, "Deleted the agent bot "+bot.Name, nil)
	return dtos.Message(c, fiber.StatusOK, "agent bot deleted")
}

// bot loads the :id path parameter's bot; a missing or deleted one is a 404.
func (h *agentBotHandler) bot(c fiber.Ctx) (models.AgentBot, error) {
	id, err := pathID(c, "agent bot")
	if err != nil {
		return models.AgentBot{}, err
	}
	bot, err := h.app.Repositories.AgentBot.Get(c.Context(), id)
	if err != nil {
		if apperr.IsNotFound(err) {
			return bot, apperr.New(apperr.KindNotFound, "agent bot not found")
		}
		return bot, err
	}
	return bot, nil
}
