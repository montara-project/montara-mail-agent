package handlers

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// agentSkillHandler manages the organizations' skills: the built-in ones'
// switches and bots, and the custom ones.
type agentSkillHandler struct {
	app *app.Application
}

// skillView is a skill as the API shows it, keyed so the web app can run or
// change a built-in skill and a custom one the same way.
type skillView struct {
	Key         string     `json:"key"`
	Builtin     bool       `json:"builtin"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Instruction string     `json:"instruction"`
	AgentBotID  *uuid.UUID `json:"agent_bot_id"`
	IsEnabled   bool       `json:"is_enabled"`
}

func newSkillView(s models.AgentSkill) skillView {
	v := skillView{
		Key:         s.Key(),
		Builtin:     s.Builtin != nil,
		Name:        s.Name,
		Description: s.Description,
		Instruction: s.Instruction,
		AgentBotID:  s.AgentBotID,
		IsEnabled:   s.IsEnabled,
	}
	// A built-in skill's instruction is the server's, not a setting.
	if v.Builtin {
		v.Instruction = ""
	}
	return v
}

// orgSkills returns every skill of an organization: the built-in ones first,
// with its switch and bot laid over each, then its custom ones.
func orgSkills(ctx context.Context, app *app.Application, orgID uuid.UUID) ([]models.AgentSkill, error) {
	rows, err := app.Repositories.AgentSkill.List(ctx, orgID)
	if err != nil {
		return nil, err
	}
	skills := make([]models.AgentSkill, 0, len(models.BuiltinSkills)+len(rows))
	for _, def := range models.BuiltinSkills {
		for _, row := range rows {
			if row.Builtin != nil && *row.Builtin == *def.Builtin {
				def.IsEnabled, def.AgentBotID = row.IsEnabled, row.AgentBotID
			}
		}
		skills = append(skills, def)
	}
	for _, row := range rows {
		if row.Builtin == nil {
			skills = append(skills, row)
		}
	}
	return skills, nil
}

// orgSkill resolves a skill key (a built-in key or a custom skill's id) in an
// organization; a skill of another organization is a 404.
func orgSkill(c fiber.Ctx, app *app.Application, orgID uuid.UUID, key string) (models.AgentSkill, error) {
	notFound := apperr.New(apperr.KindNotFound, "skill not found")
	if def, ok := models.BuiltinSkill(key); ok {
		row, err := app.Repositories.AgentSkill.Builtin(c.Context(), orgID, key)
		if err != nil && !apperr.IsNotFound(err) {
			return def, err
		}
		if err == nil {
			def.IsEnabled, def.AgentBotID = row.IsEnabled, row.AgentBotID
		}
		return def, nil
	}
	id, err := uuid.Parse(key)
	if err != nil {
		return models.AgentSkill{}, notFound
	}
	skill, err := app.Repositories.AgentSkill.Get(c.Context(), id)
	if err != nil {
		if apperr.IsNotFound(err) {
			return skill, notFound
		}
		return skill, err
	}
	if skill.OrganizationID != orgID {
		return skill, notFound
	}
	return skill, nil
}

// orgBot loads the agent bot a request names, or nil for the built-in
// persona when it names none. A bot from another organization is a 404.
func orgBot(c fiber.Ctx, app *app.Application, orgID uuid.UUID, rawID string) (*models.AgentBot, error) {
	if rawID == "" {
		return nil, nil
	}
	id, err := uuid.Parse(rawID)
	if err != nil {
		return nil, apperr.New(apperr.KindBadRequest, "invalid agent bot id")
	}
	bot, err := app.Repositories.AgentBot.Get(c.Context(), id)
	if err != nil {
		return nil, err
	}
	if bot.OrganizationID != orgID {
		return nil, apperr.New(apperr.KindNotFound, "agent bot not found")
	}
	return &bot, nil
}

// skillBot is the persona a skill runs as: the bot the skill names, else the
// one the user picked (pickedID), else the built-in one. The skill's bot is
// tied to its organization by the foreign key, and a deleted one drops out.
func skillBot(c fiber.Ctx, app *app.Application, skill models.AgentSkill, pickedID string) (*models.AgentBot, error) {
	if skill.AgentBotID != nil {
		bot, err := app.Repositories.AgentBot.Get(c.Context(), *skill.AgentBotID)
		if err == nil {
			return &bot, nil
		}
		if !apperr.IsNotFound(err) {
			return nil, err
		}
	}
	return orgBot(c, app, skill.OrganizationID, pickedID)
}

// skillBotID checks that a bot a skill should name belongs to the
// organization; empty means none.
func skillBotID(c fiber.Ctx, app *app.Application, orgID uuid.UUID, rawID string) (*uuid.UUID, error) {
	bot, err := orgBot(c, app, orgID, rawID)
	if err != nil || bot == nil {
		return nil, err
	}
	return &bot.ID, nil
}

// List returns an organization's skills, the built-in ones first.
func (h *agentSkillHandler) List(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}
	skills, err := orgSkills(c.Context(), h.app, orgID)
	if err != nil {
		return err
	}
	views := make([]skillView, 0, len(skills))
	for _, s := range skills {
		views = append(views, newSkillView(s))
	}
	return dtos.List(c, views, dtos.ListMeta(len(views), 0, len(views)))
}

// SetBuiltin switches a built-in skill on or off and sets its agent bot;
// owner only, like the other organization settings.
func (h *agentSkillHandler) SetBuiltin(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, orgID); err != nil {
		return err
	}
	skill, ok := models.BuiltinSkill(c.Params("key"))
	if !ok {
		return apperr.New(apperr.KindNotFound, "skill not found")
	}
	var body dtos.BuiltinSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	botID, err := skillBotID(c, h.app, orgID, body.AgentBotID)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.AgentSkill.SetBuiltin(c.Context(), orgID, *skill.Builtin, body.IsEnabled, botID); err != nil {
		return err
	}
	skill.OrganizationID, skill.IsEnabled, skill.AgentBotID = orgID, body.IsEnabled, botID
	recordActivity(c, h.app, orgID, constant.ActivitySkillUpdated, "Updated the skill "+skill.Name, nil)
	return dtos.OK(c, newSkillView(skill))
}

// Create adds a custom skill; owner only.
func (h *agentSkillHandler) Create(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, orgID); err != nil {
		return err
	}
	var body dtos.AgentSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	botID, err := skillBotID(c, h.app, orgID, body.AgentBotID)
	if err != nil {
		return err
	}
	skill := models.AgentSkill{
		OrganizationID: orgID,
		Name:           body.Name,
		Description:    body.Description,
		Instruction:    body.Instruction,
		AgentBotID:     botID,
		IsEnabled:      body.IsEnabled,
	}
	if err := h.app.Repositories.AgentSkill.Create(c.Context(), &skill); err != nil {
		return err
	}
	recordActivity(c, h.app, orgID, constant.ActivitySkillCreated, "Created the skill "+skill.Name, nil)
	return dtos.Created(c, newSkillView(skill), "skill created")
}

// Update rewrites a custom skill.
func (h *agentSkillHandler) Update(c fiber.Ctx) error {
	skill, err := h.custom(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, skill.OrganizationID); err != nil {
		return err
	}
	var body dtos.AgentSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	botID, err := skillBotID(c, h.app, skill.OrganizationID, body.AgentBotID)
	if err != nil {
		return err
	}
	skill.Name, skill.Description, skill.Instruction = body.Name, body.Description, body.Instruction
	skill.AgentBotID, skill.IsEnabled = botID, body.IsEnabled
	if err := h.app.Repositories.AgentSkill.Update(c.Context(), skill); err != nil {
		return err
	}
	recordActivity(c, h.app, skill.OrganizationID, constant.ActivitySkillUpdated, "Updated the skill "+skill.Name, nil)
	return dtos.OK(c, newSkillView(skill))
}

// Delete removes a custom skill.
func (h *agentSkillHandler) Delete(c fiber.Ctx) error {
	skill, err := h.custom(c)
	if err != nil {
		return err
	}
	if err := owner(c, h.app, skill.OrganizationID); err != nil {
		return err
	}
	if err := h.app.Repositories.AgentSkill.Delete(c.Context(), skill.ID); err != nil {
		return err
	}
	recordActivity(c, h.app, skill.OrganizationID, constant.ActivitySkillDeleted, "Deleted the skill "+skill.Name, nil)
	return dtos.Message(c, fiber.StatusOK, "skill deleted")
}

// custom loads the :id path parameter's custom skill; a missing, deleted or
// built-in one is a 404.
func (h *agentSkillHandler) custom(c fiber.Ctx) (models.AgentSkill, error) {
	id, err := pathID(c, "skill")
	if err != nil {
		return models.AgentSkill{}, err
	}
	skill, err := h.app.Repositories.AgentSkill.Get(c.Context(), id)
	if err != nil {
		if apperr.IsNotFound(err) {
			return skill, apperr.New(apperr.KindNotFound, "skill not found")
		}
		return skill, err
	}
	return skill, nil
}
