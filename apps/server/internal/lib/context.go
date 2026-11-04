package lib

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

func ContextGetUID(c fiber.Ctx) (uuid.UUID, error) {
	uid := fiber.Locals[uuid.UUID](c, "uid")
	if uid == uuid.Nil {
		return uuid.Nil, errors.New("can't find get context auth, please check your authorization")
	}
	return uid, nil
}

func ContextSetUID(c fiber.Ctx, uid uuid.UUID) {
	fiber.Locals[uuid.UUID](c, "uid", uid)
}

// ContextGetSessionID returns the Authula session the caller signed in with,
// or "" for a caller without one.
func ContextGetSessionID(c fiber.Ctx) string {
	return fiber.Locals[string](c, "session_id")
}

func ContextSetSessionID(c fiber.Ctx, id string) {
	fiber.Locals[string](c, "session_id", id)
}
