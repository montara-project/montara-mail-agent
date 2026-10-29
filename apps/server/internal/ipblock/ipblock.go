// Package ipblock refuses requests from blocked addresses, and blocks an
// address on its own after it fails sign-in or hits the rate limit too often.
package ipblock

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/repositories"
)

// The automatic rule: this many strikes of one kind from one address within
// Window blocks it for AutoBlockFor.
const (
	FailedSignInLimit = 10
	RateLimitLimit    = 5
	Window            = 10 * time.Minute
	AutoBlockFor      = time.Hour
	// refreshEvery reloads the blocks, so other replicas' changes and
	// expiries take effect; this replica's own changes apply at once.
	refreshEvery = 30 * time.Second
)

// ErrBlocked answers every request from a blocked address.
var ErrBlocked = apperr.New(apperr.KindForbidden, "requests from this address are blocked")

type strikeKind int

const (
	failedSignIn strikeKind = iota
	rateLimited
)

// Guard holds the blocks in force and the strikes counted toward new ones.
//
// ponytail: strikes are counted per replica, so with several replicas an
// address gets up to that many times the limit before one of them blocks it;
// count in shared storage (Redis) once that matters.
type Guard struct {
	repo   *repositories.IPBlockRepository
	logger *slog.Logger
	// exempt addresses are never refused nor counted: the rate limiter's
	// exempt list, and loopback in development. They are the way back in for
	// a super user who blocked their own range.
	exempt     func(ip string) bool
	signInPath func(path string) bool
	// autoBlockable says whether an address may be blocked automatically:
	// never a private one or a trusted proxy, which stand for many clients
	// when the proxy setting is wrong, so one abuser would shut out all.
	autoBlockable func(addr netip.Addr) bool

	blocks atomic.Pointer[[]netip.Prefix]

	mu      sync.Mutex
	strikes map[netip.Prefix]map[strikeKind][]time.Time
}

// New returns a guard with no blocks; Reload loads them.
func New(repo *repositories.IPBlockRepository, logger *slog.Logger, exempt func(ip string) bool, signInPath func(path string) bool, autoBlockable func(addr netip.Addr) bool) *Guard {
	g := &Guard{repo: repo, logger: logger, exempt: exempt, signInPath: signInPath, autoBlockable: autoBlockable, strikes: map[netip.Prefix]map[strikeKind][]time.Time{}}
	g.blocks.Store(&[]netip.Prefix{})
	return g
}

// Subject is the network one client is counted and blocked as: the IPv4
// address itself, or the IPv6 /64 around it, since one host is usually given
// a whole /64 and could otherwise rotate addresses past every limit.
func Subject(ip string) (netip.Prefix, bool) {
	addr, ok := parseAddr(ip)
	if !ok {
		return netip.Prefix{}, false
	}
	if addr.Is6() {
		return netip.PrefixFrom(addr, 64).Masked(), true
	}
	return netip.PrefixFrom(addr, 32), true
}

// SubjectKey is Subject as a string, for the rate limiter's key: an address
// that does not parse keys as itself.
func SubjectKey(ip string) string {
	if p, ok := Subject(ip); ok {
		return p.String()
	}
	return ip
}

// ParseNetwork reads an address or a range as a network: "203.0.113.7" is
// 203.0.113.7/32. Ranges wider than /8 (IPv4) or /32 (IPv6) are refused: they
// would shut out a large part of the internet by a typo.
func ParseNetwork(s string) (netip.Prefix, error) {
	s = strings.TrimSpace(s)
	if p, err := netip.ParsePrefix(s); err == nil {
		p = p.Masked()
		if (p.Addr().Is4() && p.Bits() < 8) || (p.Addr().Is6() && p.Bits() < 32) {
			return netip.Prefix{}, errors.New("the range is too wide: use /8 or narrower for IPv4, /32 or narrower for IPv6")
		}
		return p, nil
	}
	addr, err := netip.ParseAddr(s)
	if err != nil {
		return netip.Prefix{}, errors.New("not an IP address or a CIDR range")
	}
	addr = addr.Unmap()
	return netip.PrefixFrom(addr, addr.BitLen()), nil
}

func parseAddr(ip string) (netip.Addr, bool) {
	addr, err := netip.ParseAddr(ip)
	return addr.Unmap(), err == nil
}

// Blocked reports whether ip falls in a block in force.
func (g *Guard) Blocked(ip string) bool {
	addr, ok := parseAddr(ip)
	if !ok {
		return false
	}
	return slices.ContainsFunc(*g.blocks.Load(), func(p netip.Prefix) bool { return p.Contains(addr) })
}

// Reload drops the expired blocks and loads the ones in force.
func (g *Guard) Reload(ctx context.Context) error {
	if err := g.repo.DeleteExpired(ctx); err != nil {
		return err
	}
	active, err := g.repo.Active(ctx)
	if err != nil {
		return err
	}
	prefixes := make([]netip.Prefix, 0, len(active))
	for _, b := range active {
		if p, err := netip.ParsePrefix(b.Network); err == nil {
			prefixes = append(prefixes, p)
		}
	}
	g.blocks.Store(&prefixes)
	return nil
}

// Forget clears the strikes of the clients in network, so an address a super
// user unblocked starts over.
func (g *Guard) Forget(network netip.Prefix) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for subject := range g.strikes {
		if network.Overlaps(subject) {
			delete(g.strikes, subject)
		}
	}
}

// Run reloads the blocks and prunes old strikes until ctx ends.
func (g *Guard) Run(ctx context.Context) {
	ticker := time.NewTicker(refreshEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := g.Reload(ctx); err != nil {
				g.logger.Warn("ip blocks not reloaded", "error", err)
			}
			g.prune(time.Now())
		}
	}
}

func (g *Guard) prune(now time.Time) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for subject, kinds := range g.strikes {
		for kind, at := range kinds {
			kinds[kind] = recent(at, now)
			if len(kinds[kind]) == 0 {
				delete(kinds, kind)
			}
		}
		if len(kinds) == 0 {
			delete(g.strikes, subject)
		}
	}
}

func recent(at []time.Time, now time.Time) []time.Time {
	return slices.DeleteFunc(at, func(t time.Time) bool { return now.Sub(t) > Window })
}

// strike counts one failure from ip and blocks it once its kind reaches the
// limit within the window.
func (g *Guard) strike(ip string, kind strikeKind) {
	addr, ok := parseAddr(ip)
	if !ok || !g.autoBlockable(addr) {
		return
	}
	subject, _ := Subject(ip)
	now := time.Now()
	g.mu.Lock()
	kinds := g.strikes[subject]
	if kinds == nil {
		kinds = map[strikeKind][]time.Time{}
		g.strikes[subject] = kinds
	}
	kinds[kind] = append(recent(kinds[kind], now), now)
	count := len(kinds[kind])
	limit, reason := FailedSignInLimit, "failed sign-ins"
	if kind == rateLimited {
		limit, reason = RateLimitLimit, "rate limit hits"
	}
	reached := count >= limit
	if reached {
		delete(g.strikes, subject)
	}
	g.mu.Unlock()
	if !reached {
		return
	}

	// The request that tipped it is already failing; the block applies from
	// the next one.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	network := subject
	why := fmt.Sprintf("%d %s within %s", limit, reason, Window)
	if err := g.repo.BlockAuto(ctx, network.String(), why, now.Add(AutoBlockFor)); err != nil {
		g.logger.Error("ip not blocked", "ip", ip, "error", err)
		return
	}
	g.logger.Warn("ip blocked automatically", "ip", ip, "reason", why, "for", AutoBlockFor)
	if err := g.Reload(ctx); err != nil {
		g.logger.Warn("ip blocks not reloaded", "error", err)
	}
}

// Middleware refuses blocked addresses before any route runs, and counts the
// failures that lead to an automatic block: a 401 from a sign-in route, and
// a request the rate limiter turned away.
func (g *Guard) Middleware(c fiber.Ctx) error {
	ip := c.IP()
	if g.exempt(ip) {
		return c.Next()
	}
	if g.Blocked(ip) {
		return ErrBlocked
	}
	err := c.Next()
	switch {
	case errors.Is(err, apperr.ErrTooManyRequests):
		g.strike(ip, rateLimited)
	case err == nil && c.Response().StatusCode() == fiber.StatusUnauthorized && g.signInPath(c.Path()):
		g.strike(ip, failedSignIn)
	}
	return err
}
