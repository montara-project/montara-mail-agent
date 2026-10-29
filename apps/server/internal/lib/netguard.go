package lib

import (
	"errors"
	"net"
	"net/netip"
	"slices"
	"syscall"
	"time"
)

// GuardedDialer dials hosts that users type in (an IMAP server, an LLM base
// URL). Unless allowPrivate is set it refuses loopback, private, link-local
// and unspecified addresses, so those fields cannot reach the server's own
// network or a cloud metadata endpoint. The check runs on the resolved
// address at connect time, so DNS pointing a public name inward is caught too.
func GuardedDialer(allowPrivate bool) *net.Dialer {
	d := &net.Dialer{Timeout: 15 * time.Second}
	if allowPrivate {
		return d
	}
	d.Control = func(_, address string, _ syscall.RawConn) error {
		ap, err := netip.ParseAddrPort(address)
		if err != nil {
			return err
		}
		if !PublicAddr(ap.Addr()) {
			// The address stays out of the message: it is shown to whoever typed
			// the host, and would map internal names to addresses.
			return errors.New("connecting to a private or reserved address is not allowed")
		}
		return nil
	}
	return d
}

// PublicAddr reports whether ip is a globally routable address.
func PublicAddr(ip netip.Addr) bool {
	ip = ip.Unmap()
	return ip.IsValid() && !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() &&
		!ip.IsLinkLocalMulticast() && !ip.IsMulticast() && !ip.IsUnspecified() &&
		!slices.ContainsFunc(reservedPrefixes, func(p netip.Prefix) bool { return p.Contains(ip) })
}

// reservedPrefixes are not public although the netip predicates pass them.
var reservedPrefixes = []netip.Prefix{
	// Carrier-grade NAT, internal on many clouds.
	netip.MustParsePrefix("100.64.0.0/10"),
	// IETF protocol assignments, benchmarking, and the old class E.
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("240.0.0.0/4"),
	// IPv6 forms that carry an IPv4 address a gateway may reach: NAT64 and
	// 6to4.
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("2002::/16"),
}
