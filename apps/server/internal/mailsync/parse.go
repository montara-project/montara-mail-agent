package mailsync

import (
	"bytes"
	"html"
	"io"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"
	// Decodes bodies in charsets other than UTF-8 and US-ASCII.
	_ "github.com/emersion/go-message/charset"
	"github.com/emersion/go-message/mail"

	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// folderMailboxes maps each synced folder to the server's mailbox name: by
// SPECIAL-USE attribute first, then by the usual names of servers without it.
func folderMailboxes(list []*imap.ListData) map[string]string {
	byAttr := map[imap.MailboxAttr]string{
		imap.MailboxAttrSent:   constant.FolderSent,
		imap.MailboxAttrDrafts: constant.FolderDrafts,
		imap.MailboxAttrJunk:   constant.FolderSpam,
		imap.MailboxAttrTrash:  constant.FolderTrash,
	}
	byName := map[string]string{
		"sent": constant.FolderSent, "sent items": constant.FolderSent, "sent messages": constant.FolderSent, "sent mail": constant.FolderSent,
		"drafts": constant.FolderDrafts, "draft": constant.FolderDrafts,
		"junk": constant.FolderSpam, "spam": constant.FolderSpam, "junk e-mail": constant.FolderSpam, "junk email": constant.FolderSpam, "bulk": constant.FolderSpam, "bulk mail": constant.FolderSpam,
		"trash": constant.FolderTrash, "deleted items": constant.FolderTrash, "deleted messages": constant.FolderTrash, "bin": constant.FolderTrash,
	}

	out := map[string]string{constant.FolderInbox: "INBOX"}
	selectable := slices.DeleteFunc(slices.Clone(list), func(ld *imap.ListData) bool {
		return slices.Contains(ld.Attrs, imap.MailboxAttrNoSelect)
	})
	for _, ld := range selectable {
		for _, attr := range ld.Attrs {
			if folder, ok := byAttr[attr]; ok && out[folder] == "" {
				out[folder] = ld.Mailbox
			}
		}
	}
	for _, ld := range selectable {
		name := ld.Mailbox
		if ld.Delim != 0 {
			name = name[strings.LastIndexByte(name, byte(ld.Delim))+1:]
		}
		if folder, ok := byName[strings.ToLower(name)]; ok && out[folder] == "" {
			out[folder] = ld.Mailbox
		}
	}
	return out
}

// clean makes text storable: Postgres text refuses NUL and invalid UTF-8.
func clean(s string) string {
	return strings.ReplaceAll(strings.ToValidUTF8(s, "�"), "\x00", "")
}

func contacts(addrs []imap.Address) []models.MailContact {
	out := make([]models.MailContact, 0, len(addrs))
	for _, a := range addrs {
		if email := a.Addr(); email != "" {
			out = append(out, models.MailContact{Name: clean(a.Name), Email: clean(email)})
		}
	}
	return out
}

// toMail builds a mail from what IMAP returned; the caller sets the ids.
func toMail(env *imap.Envelope, flags []imap.Flag, internalDate time.Time, raw []byte) models.Mail {
	m := models.Mail{
		ReceivedAt: internalDate,
		IsRead:     slices.Contains(flags, imap.FlagSeen),
		IsStarred:  slices.Contains(flags, imap.FlagFlagged),
		Body:       clean(messageText(raw)),
		To:         []models.MailContact{},
		Cc:         []models.MailContact{},
	}
	if env != nil {
		m.Subject, m.MessageID = clean(env.Subject), clean(env.MessageID)
		m.To, m.Cc = contacts(env.To), contacts(env.Cc)
		if from := contacts(env.From); len(from) > 0 {
			m.FromName, m.FromEmail = from[0].Name, from[0].Email
		}
		if m.ReceivedAt.IsZero() {
			m.ReceivedAt = env.Date
		}
	}
	if m.ReceivedAt.IsZero() {
		m.ReceivedAt = time.Now()
	}
	return m
}

// messageText returns a message's readable text: its first text/plain part,
// else its first text/html part as text. The download may be cut at
// maxMessageBytes, so a broken part ends the walk instead of failing it.
func messageText(raw []byte) string {
	r, err := mail.CreateReader(bytes.NewReader(raw))
	if err != nil {
		return ""
	}

	var plain, htmlBody string
	for {
		part, err := r.NextPart()
		if err != nil {
			break
		}
		h, ok := part.Header.(*mail.InlineHeader)
		if !ok {
			continue
		}
		contentType, _, _ := h.ContentType()
		body, _ := io.ReadAll(part.Body)
		switch {
		case contentType == "text/plain" && plain == "":
			plain = string(body)
		case contentType == "text/html" && htmlBody == "":
			htmlBody = string(body)
		}
		if plain != "" {
			break
		}
	}
	if plain != "" {
		return strings.TrimSpace(plain)
	}
	return htmlText(htmlBody)
}

var (
	htmlHidden    = regexp.MustCompile(`(?is)<(script|style|head)\b.*?</(script|style|head)>`)
	htmlBreak     = regexp.MustCompile(`(?i)<br\s*/?>|</(p|div|tr|li|h[1-6])>`)
	htmlTag       = regexp.MustCompile(`(?s)<[^>]*>`)
	htmlBlankRuns = regexp.MustCompile(`\n[ \t]*(\n[ \t]*)+`)
	htmlSpaceRuns = regexp.MustCompile(`[ \t\r\f\v]+`)
)

// htmlText turns an HTML body into plain text.
// ponytail: regex tag stripping, good enough for reading and for the LLM;
// use golang.org/x/net/html if layouts come out garbled.
func htmlText(s string) string {
	s = htmlHidden.ReplaceAllString(s, "")
	s = htmlBreak.ReplaceAllString(s, "\n")
	s = htmlTag.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	s = htmlSpaceRuns.ReplaceAllString(s, " ")
	s = htmlBlankRuns.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}
