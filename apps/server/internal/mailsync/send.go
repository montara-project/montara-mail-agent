package mailsync

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"io"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/emersion/go-message/mail"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/models"
)

// Forward sends m from the account to recipients, with the note on top and
// the original quoted below it.
// ponytail: the original's attachments are not synced, so they are not
// forwarded; the copy also isn't saved to Sent, which Gmail, Outlook, Yahoo
// and iCloud do themselves for mail sent through their SMTP.
func (s *Syncer) Forward(ctx context.Context, account models.EmailAccount, m models.Mail, recipients []string, note string) error {
	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	password, err := s.app.Secrets.Open(account.Password)
	if err != nil {
		return errors.New("the saved password can't be read, connect the account again")
	}
	msg, err := forwardMessage(account.Email, m, recipients, note, time.Now())
	if err != nil {
		return err
	}
	return s.send(ctx, account, password, recipients, msg)
}

// send delivers msg over the account's SMTP server. Ports 587 and 25 upgrade
// with STARTTLS, any other port (465) speaks TLS from the start; either way
// the password only crosses an encrypted connection.
func (s *Syncer) send(ctx context.Context, account models.EmailAccount, password string, recipients []string, msg []byte) error {
	host := account.SMTPHost
	conn, err := lib.GuardedDialer(s.app.Config.App.AllowPrivateHosts).DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(account.SMTPPort)))
	if err != nil {
		return fmt.Errorf("connect to %s: %w", host, err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	tlsConfig := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12, RootCAs: s.RootCAs}

	startTLS := account.SMTPPort == 587 || account.SMTPPort == 25
	if !startTLS {
		tlsConn := tls.Client(conn, tlsConfig)
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			conn.Close()
			return fmt.Errorf("connect to %s: %w", host, err)
		}
		conn = tlsConn
	}
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp: %w", err)
	}
	defer c.Close()

	if startTLS {
		if ok, _ := c.Extension("STARTTLS"); !ok {
			return fmt.Errorf("%s does not offer STARTTLS", host)
		}
		if err := c.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("starttls: %w", err)
		}
	}
	if err := c.Auth(smtp.PlainAuth("", account.Username, password, host)); err != nil {
		return fmt.Errorf("sign in: %w", err)
	}
	if err := c.Mail(account.Email); err != nil {
		return fmt.Errorf("sender: %w", err)
	}
	for _, to := range recipients {
		if err := c.Rcpt(to); err != nil {
			return fmt.Errorf("recipient %s: %w", to, err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("send: %w", err)
	}
	return c.Quit()
}

func contactLine(contacts []models.MailContact) string {
	parts := make([]string, len(contacts))
	for i, c := range contacts {
		parts[i] = (&mail.Address{Name: c.Name, Address: c.Email}).String()
	}
	return strings.Join(parts, ", ")
}

// forwardMessage builds the forward of m as a text and HTML message.
func forwardMessage(from string, m models.Mail, recipients []string, note string, now time.Time) ([]byte, error) {
	var h mail.Header
	h.SetDate(now)
	h.SetAddressList("From", []*mail.Address{{Address: from}})
	to := make([]*mail.Address, len(recipients))
	for i, r := range recipients {
		to[i] = &mail.Address{Address: r}
	}
	h.SetAddressList("To", to)
	subject := m.Subject
	if !strings.HasPrefix(strings.ToLower(subject), "fwd:") {
		subject = "Fwd: " + subject
	}
	h.SetSubject(subject)
	if err := h.GenerateMessageIDWithHostname(from[strings.LastIndexByte(from, '@')+1:]); err != nil {
		return nil, err
	}

	sender := contactLine([]models.MailContact{{Name: m.FromName, Email: m.FromEmail}})
	quote := [][2]string{
		{"From", sender},
		{"Date", m.ReceivedAt.Format("Mon, 2 Jan 2006 at 15:04")},
		{"Subject", m.Subject},
		{"To", contactLine(m.To)},
	}

	var text, htmlBody strings.Builder
	if note != "" {
		text.WriteString(note + "\n\n")
		htmlBody.WriteString("<div>" + strings.ReplaceAll(html.EscapeString(note), "\n", "<br>") + "</div><br>")
	}
	text.WriteString("---------- Forwarded message ---------\n")
	htmlBody.WriteString("<div>---------- Forwarded message ---------<br>")
	for _, line := range quote {
		if line[1] == "" {
			continue
		}
		text.WriteString(line[0] + ": " + line[1] + "\n")
		htmlBody.WriteString(line[0] + ": " + html.EscapeString(line[1]) + "<br>")
	}
	text.WriteString("\n" + m.Body + "\n")
	htmlBody.WriteString("</div><br>")
	if m.BodyHTML != nil && *m.BodyHTML != "" {
		htmlBody.WriteString(*m.BodyHTML)
	} else {
		htmlBody.WriteString(`<div style="white-space:pre-wrap">` + html.EscapeString(m.Body) + "</div>")
	}

	var buf bytes.Buffer
	w, err := mail.CreateWriter(&buf, h)
	if err != nil {
		return nil, err
	}
	inline, err := w.CreateInline()
	if err != nil {
		return nil, err
	}
	for _, part := range []struct{ contentType, body string }{
		{"text/plain", text.String()},
		{"text/html", htmlBody.String()},
	} {
		var ph mail.InlineHeader
		ph.SetContentType(part.contentType, map[string]string{"charset": "utf-8"})
		pw, err := inline.CreatePart(ph)
		if err != nil {
			return nil, err
		}
		if _, err := io.WriteString(pw, part.body); err != nil {
			return nil, err
		}
		if err := pw.Close(); err != nil {
			return nil, err
		}
	}
	if err := inline.Close(); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
