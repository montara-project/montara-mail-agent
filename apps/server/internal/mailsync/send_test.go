package mailsync

import (
	"bufio"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"math/big"
	"net"
	"strings"
	"testing"
	"time"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/models"
)

// fakeSMTP accepts one message over implicit TLS on loopback and records
// the sign-in, envelope and data it got.
type fakeSMTP struct {
	auth, from string
	to         []string
	data       string
	done       chan struct{}
}

func serveFakeSMTP(t *testing.T) (*fakeSMTP, int, *x509.CertPool) {
	t.Helper()
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IsCA:                  true,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, _ := x509.ParseCertificate(der)
	pool := x509.NewCertPool()
	pool.AddCert(cert)

	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })

	f := &fakeSMTP{done: make(chan struct{})}
	go func() {
		defer close(f.done)
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		r, w := bufio.NewReader(conn), conn
		reply := func(s string) { _, _ = w.Write([]byte(s + "\r\n")) }
		reply("220 fake ESMTP")
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimRight(line, "\r\n")
			switch cmd := strings.ToUpper(strings.SplitN(line, " ", 2)[0]); cmd {
			case "EHLO":
				reply("250-fake\r\n250 AUTH PLAIN")
			case "AUTH":
				raw, _ := base64.StdEncoding.DecodeString(strings.TrimPrefix(line, "AUTH PLAIN "))
				f.auth = string(raw)
				reply("235 ok")
			case "MAIL":
				f.from = line
				reply("250 ok")
			case "RCPT":
				f.to = append(f.to, line)
				reply("250 ok")
			case "DATA":
				reply("354 go on")
				var data strings.Builder
				for {
					l, err := r.ReadString('\n')
					if err != nil || l == ".\r\n" {
						break
					}
					data.WriteString(l)
				}
				f.data = data.String()
				reply("250 queued")
			case "QUIT":
				reply("221 bye")
				return
			default:
				reply("502 unknown")
			}
		}
	}()
	return f, ln.Addr().(*net.TCPAddr).Port, pool
}

func TestForward(t *testing.T) {
	smtpServer, port, pool := serveFakeSMTP(t)

	box, _ := lib.NewSecretBox("0123456789abcdef0123456789abcdef")
	application := &app.Application{Secrets: box}
	application.Config.App.AllowPrivateHosts = true
	syncer := New(application)
	syncer.RootCAs = pool

	account := models.EmailAccount{
		Email:    "me@example.com",
		Username: "me@example.com",
		Password: box.Seal("app-password"),
		SMTPHost: "127.0.0.1",
		SMTPPort: port,
	}
	html := "<p>Please sign it.</p>"
	m := models.Mail{
		FromName:   "Boss",
		FromEmail:  "boss@example.com",
		To:         []models.MailContact{{Email: "me@example.com"}},
		Subject:    "Contract",
		Body:       "Please sign it.",
		BodyHTML:   &html,
		ReceivedAt: time.Date(2026, 10, 22, 10, 6, 0, 0, time.UTC),
	}

	if err := syncer.Forward(context.Background(), account, m, []string{"a@example.com", "b@example.com"}, "FYI <see below>"); err != nil {
		t.Fatalf("forward: %v", err)
	}
	<-smtpServer.done

	if smtpServer.auth != "\x00me@example.com\x00app-password" {
		t.Fatalf("sign in: %q", smtpServer.auth)
	}
	if !strings.Contains(smtpServer.from, "<me@example.com>") || len(smtpServer.to) != 2 {
		t.Fatalf("envelope: %q %q", smtpServer.from, smtpServer.to)
	}
	for _, want := range []string{
		"Subject: Fwd: Contract",
		"FYI <see below>",
		"FYI &lt;see below&gt;",
		"From: \"Boss\" <boss@example.com>",
		"<p>Please sign it.</p>",
		"Content-Type: multipart/alternative",
	} {
		if !strings.Contains(smtpServer.data, want) {
			t.Errorf("message lacks %q:\n%s", want, smtpServer.data)
		}
	}
}

func TestForwardKeepsFwdPrefix(t *testing.T) {
	msg, err := forwardMessage("me@example.com", models.Mail{Subject: "Fwd: Hi"}, []string{"a@example.com"}, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(msg), "Fwd: Fwd:") {
		t.Fatal("a forward of a forward doubled the prefix")
	}
}

func TestReply(t *testing.T) {
	smtpServer, port, pool := serveFakeSMTP(t)

	box, _ := lib.NewSecretBox("0123456789abcdef0123456789abcdef")
	application := &app.Application{Secrets: box}
	application.Config.App.AllowPrivateHosts = true
	syncer := New(application)
	syncer.RootCAs = pool

	account := models.EmailAccount{
		Email:    "me@example.com",
		Username: "me@example.com",
		Password: box.Seal("app-password"),
		SMTPHost: "127.0.0.1",
		SMTPPort: port,
	}
	m := models.Mail{
		MessageID:  "1@example.com",
		FromName:   "Boss",
		FromEmail:  "boss@example.com",
		Subject:    "Contract",
		Body:       "Please sign it.\nThanks",
		ReceivedAt: time.Date(2026, 10, 22, 10, 6, 0, 0, time.UTC),
	}

	if err := syncer.Reply(context.Background(), account, m, "**Signed.**", "<p><b>Signed.</b></p>"); err != nil {
		t.Fatalf("reply: %v", err)
	}
	<-smtpServer.done

	if len(smtpServer.to) != 1 || !strings.Contains(smtpServer.to[0], "<boss@example.com>") {
		t.Fatalf("reply went to %q, want the sender", smtpServer.to)
	}
	for _, want := range []string{
		"Subject: Re: Contract",
		"In-Reply-To: <1@example.com>",
		"References: <1@example.com>",
		"**Signed.**",
		"<p><b>Signed.</b></p>",
		"> Please sign it.",
		"<blockquote",
	} {
		if !strings.Contains(smtpServer.data, want) {
			t.Errorf("reply lacks %q:\n%s", want, smtpServer.data)
		}
	}

	if err := syncer.Reply(context.Background(), account, models.Mail{}, "hi", ""); err == nil {
		t.Fatal("a mail without a sender was replied to")
	}
}
