package mailsync

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/emersion/go-imap/v2"

	"montara-mail-agent/server/internal/lib/constant"
)

func TestFolderMailboxes(t *testing.T) {
	// Gmail announces SPECIAL-USE; the "Spam" name decoy must not win over \Junk.
	gmail := []*imap.ListData{
		{Mailbox: "INBOX", Delim: '/'},
		{Mailbox: "[Gmail]", Delim: '/', Attrs: []imap.MailboxAttr{imap.MailboxAttrNoSelect}},
		{Mailbox: "[Gmail]/Sent Mail", Delim: '/', Attrs: []imap.MailboxAttr{imap.MailboxAttrSent}},
		{Mailbox: "[Gmail]/Spam", Delim: '/', Attrs: []imap.MailboxAttr{imap.MailboxAttrJunk}},
		{Mailbox: "Projects/Spam", Delim: '/'},
		{Mailbox: "[Gmail]/Bin", Delim: '/', Attrs: []imap.MailboxAttr{imap.MailboxAttrTrash}},
	}
	want := map[string]string{
		constant.FolderInbox: "INBOX",
		constant.FolderSent:  "[Gmail]/Sent Mail",
		constant.FolderSpam:  "[Gmail]/Spam",
		constant.FolderTrash: "[Gmail]/Bin",
	}
	if got := folderMailboxes(gmail); !reflect.DeepEqual(got, want) {
		t.Fatalf("gmail: %v, want %v", got, want)
	}

	// A server without SPECIAL-USE falls back to the usual names.
	plain := []*imap.ListData{
		{Mailbox: "INBOX", Delim: '.'},
		{Mailbox: "INBOX.Sent Items", Delim: '.'},
		{Mailbox: "INBOX.Junk E-mail", Delim: '.'},
		{Mailbox: "Drafts", Delim: '.'},
	}
	want = map[string]string{
		constant.FolderInbox:  "INBOX",
		constant.FolderSent:   "INBOX.Sent Items",
		constant.FolderSpam:   "INBOX.Junk E-mail",
		constant.FolderDrafts: "Drafts",
	}
	if got := folderMailboxes(plain); !reflect.DeepEqual(got, want) {
		t.Fatalf("plain: %v, want %v", got, want)
	}
}

func crlf(s string) []byte {
	return []byte(strings.ReplaceAll(s, "\n", "\r\n"))
}

func TestMessageText(t *testing.T) {
	multipart := crlf(`From: a@example.com
Subject: Hi
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary=b

--b
Content-Type: text/html; charset=utf-8

<p>Hello <b>HTML</b></p>
--b
Content-Type: text/plain; charset=iso-8859-1
Content-Transfer-Encoding: quoted-printable

Ol=E1, plain text
--b--
`)
	if got := messageText(multipart); got != "Olá, plain text" {
		t.Fatalf("multipart: %q", got)
	}

	htmlOnly := crlf(`Content-Type: text/html

<html><head><style>p{color:red}</style></head><body><p>Line&nbsp;one</p><p>Line &amp; two</p><script>x()</script></body></html>
`)
	if got := messageText(htmlOnly); got != "Line one\nLine & two" {
		t.Fatalf("html only: %q", got)
	}

	// A download cut inside a part still yields the text before the cut.
	cut := multipart[:len(multipart)-40]
	if got := messageText(cut); !strings.HasPrefix(got, "Hello HTML") && !strings.HasPrefix(got, "Olá") {
		t.Fatalf("cut message: %q", got)
	}

	if got := messageText(nil); got != "" {
		t.Fatalf("empty message: %q", got)
	}
}

func TestToMail(t *testing.T) {
	date := time.Date(2026, 10, 22, 10, 6, 0, 0, time.UTC)
	env := &imap.Envelope{
		Subject: "Bad \x00 byte",
		From:    []imap.Address{{Name: "Vanuel", Mailbox: "van", Host: "example.com"}},
		Cc:      []imap.Address{{Name: "Group", Mailbox: "", Host: ""}},
		Date:    date,
	}
	m := toMail(env, []imap.Flag{imap.FlagSeen}, time.Time{}, nil)
	if m.Subject != "Bad  byte" || m.FromName != "Vanuel" || m.FromEmail != "van@example.com" {
		t.Fatalf("envelope: %+v", m)
	}
	if !m.IsRead || m.IsStarred || !m.ReceivedAt.Equal(date) || len(m.Cc) != 0 || m.To == nil {
		t.Fatalf("flags, date or contacts: %+v", m)
	}
}

func TestNewUIDs(t *testing.T) {
	// "11:*" matched the newest message, uid 10, which is already stored.
	if got := newUIDs([]imap.UID{10}, 10, false); len(got) != 0 {
		t.Fatalf("old uid kept: %v", got)
	}
	found := make([]imap.UID, 0, 80)
	for uid := range imap.UID(80) {
		found = append(found, uid+1)
	}
	got := newUIDs(found, 0, true)
	if len(got) != initialSyncLimit || got[0] != 31 || got[len(got)-1] != 80 {
		t.Fatalf("initial sync kept %d uids from %v", len(got), got[0])
	}
}
