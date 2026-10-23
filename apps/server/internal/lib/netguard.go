package lib

import (
	"fmt"
	"net"
	"net/netip"
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
			return fmt.Errorf("connecting to %s is not allowed", ap.Addr())
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
		// 100.64.0.0/10, carrier-grade NAT, is internal on many clouds.
		!netip.MustParsePrefix("100.64.0.0/10").Contains(ip)
}
