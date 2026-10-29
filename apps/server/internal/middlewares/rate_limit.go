package middlewares

import (
	"time"

	"montara-mail-agent/server/internal/ipblock"
	"montara-mail-agent/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

// RateLimit allows max requests per client and minute. A client is counted
// the way ipblock counts it, so an IPv6 host can't rotate through its /64;
// exempt addresses are not counted at all.
func RateLimit(max int, exempt func(ip string) bool) fiber.Handler {
	return limiter.New(limiter.Config{
		Next:         func(c fiber.Ctx) bool { return exempt(c.IP()) },
		KeyGenerator: func(c fiber.Ctx) string { return ipblock.SubjectKey(c.IP()) },
		Max:          max,
		Expiration:   time.Minute,
		LimitReached: func(c fiber.Ctx) error {
			return apperr.ErrTooManyRequests
		},
	})
}
