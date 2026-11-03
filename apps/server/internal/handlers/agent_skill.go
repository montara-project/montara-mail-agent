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

// agentSkillHandler manages the skills: the organizations' switches and bots
// of the built-in ones, and the users' own custom ones, which follow their
// maker into every organization they are a member of and reach no one else.
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
	// Target is what the skill works on: "email", or "draft" for one that
	// rewrites the reply being written.
	Target string `json:"target"`
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
		Target:      s.WorksOn(),
	}
	// A built-in skill's instruction is the server's, not a setting.
	if v.Builtin {
		v.Instruction = ""
	}
	return v
}

// orgSkills returns every skill userID sees in an organization: the built-in
// ones first, with its switch and bot laid over each, then the user's own
// custom ones.
func orgSkills(ctx context.Context, app *app.Application, orgID, userID uuid.UUID) ([]models.AgentSkill, error) {
	rows, err := app.Repositories.AgentSkill.List(ctx, orgID, userID)
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
			row.OrganizationID = orgID
			skills = append(skills, row)
		}
	}
	return skills, nil
}

// orgSkill resolves a skill key (a built-in key or a custom skill's id) in an
// organization: a custom skill runs there for its maker alone, so another
// user's is a 404.
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
	skill, err := ownSkill(c, app, id)
	if err != nil {
		return skill, err
	}
	skill.OrganizationID = orgID
	return skill, nil
}

// ownSkill loads a live custom skill of the signed-in user; anyone else's,
// like a missing or deleted one, is a 404.
func ownSkill(c fiber.Ctx, app *app.Application, id uuid.UUID) (models.AgentSkill, error) {
	notFound := apperr.New(apperr.KindNotFound, "skill not found")
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return models.AgentSkill{}, apperr.ErrUnauthorized
	}
	skill, err := app.Repositories.AgentSkill.Get(c.Context(), id)
	if apperr.IsNotFound(err) {
		return skill, notFound
	}
	if err != nil {
		return skill, err
	}
	if skill.UserID == nil || *skill.UserID != uid {
		return models.AgentSkill{}, notFound
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

// List returns the skills the user sees in an organization, the built-in
// ones first, then their own custom ones.
func (h *agentSkillHandler) List(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	skills, err := orgSkills(c.Context(), h.app, orgID, uid)
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

// Create adds a custom skill of the signed-in user's, from an organization
// they are a member of; it then shows in every one of theirs. Its activity is
// the user's own, not that organization's.
func (h *agentSkillHandler) Create(c fiber.Ctx) error {
	orgID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, orgID); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var body dtos.AgentSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	skill := models.AgentSkill{
		OrganizationID: orgID,
		UserID:         &uid,
		Name:           body.Name,
		Description:    body.Description,
		Instruction:    body.Instruction,
		IsEnabled:      body.IsEnabled,
	}
	if err := h.app.Repositories.AgentSkill.Create(c.Context(), &skill); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivitySkillCreated, "Created the skill "+skill.Name, nil)
	return dtos.Created(c, newSkillView(skill), "skill created")
}

// Update rewrites one of the user's custom skills.
func (h *agentSkillHandler) Update(c fiber.Ctx) error {
	skill, err := h.custom(c)
	if err != nil {
		return err
	}
	var body dtos.AgentSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	skill.Name, skill.Description, skill.Instruction = body.Name, body.Description, body.Instruction
	skill.IsEnabled = body.IsEnabled
	if err := h.app.Repositories.AgentSkill.Update(c.Context(), skill); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivitySkillUpdated, "Updated the skill "+skill.Name, nil)
	return dtos.OK(c, newSkillView(skill))
}

// Delete removes one of the user's custom skills.
func (h *agentSkillHandler) Delete(c fiber.Ctx) error {
	skill, err := h.custom(c)
	if err != nil {
		return err
	}
	if err := h.app.Repositories.AgentSkill.Delete(c.Context(), skill.ID); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivitySkillDeleted, "Deleted the skill "+skill.Name, nil)
	return dtos.Message(c, fiber.StatusOK, "skill deleted")
}

// custom loads the :id path parameter's custom skill, the signed-in user's
// own; anyone else's, a missing, deleted or built-in one is a 404.
func (h *agentSkillHandler) custom(c fiber.Ctx) (models.AgentSkill, error) {
	id, err := pathID(c, "skill")
	if err != nil {
		return models.AgentSkill{}, err
	}
	return ownSkill(c, h.app, id)
}
