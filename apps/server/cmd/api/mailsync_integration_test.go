package main

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"math/big"
	"net"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-imap/v2/imapserver"
	"github.com/emersion/go-imap/v2/imapserver/imapmemserver"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

// literal is an in-memory IMAP literal for APPEND.
type literal struct{ *bytes.Reader }

func (l literal) Size() int64 { return int64(l.Len()) }

func appendMail(t *testing.T, user *imapmemserver.User, mailbox, raw string, flags ...imap.Flag) {
	t.Helper()
	body := strings.ReplaceAll(raw, "\n", "\r\n")
	if _, err := user.Append(mailbox, literal{bytes.NewReader([]byte(body))}, &imap.AppendOptions{Flags: flags, Time: time.Now()}); err != nil {
		t.Fatal(err)
	}
}

// tlsIMAPServer serves an in-memory IMAP server over TLS on loopback and
// returns its port and the pool that trusts its certificate.
func tlsIMAPServer(t *testing.T, user *imapmemserver.User) (int, *x509.CertPool) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
		KeyUsage:              x509.KeyUsageDigitalSignature,
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

	mem := imapmemserver.New()
	mem.AddUser(user)
	server := imapserver.New(&imapserver.Options{
		NewSession: func(*imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return mem.NewSession(), nil, nil
		},
		Caps:         imap.CapSet{imap.CapIMAP4rev1: {}, imap.CapIMAP4rev2: {}, imap.CapSpecialUse: {}},
		InsecureAuth: true,
	})
	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}})
	if err != nil {
		t.Fatal(err)
	}
	go server.Serve(ln)
	t.Cleanup(func() { server.Close() })
	return ln.Addr().(*net.TCPAddr).Port, pool
}

// classifier labels the first mail of every batch important, the rest low priority.
type classifier struct{}

// Chat is never called by the sync flows this file exercises.
func (classifier) Chat(context.Context, llm.ChatRequest) (llm.ChatResult, error) {
	return llm.ChatResult{}, errors.New("chat not supported by this fake")
}

func (classifier) Complete(_ context.Context, _, prompt string, _ int64) (string, error) {
	var lines []string
	for i := 1; strings.Contains(prompt, `<email id="`+itoa(i)+`">`); i++ {
		label := "low_priority"
		if i == 1 {
			label = "important"
		}
		lines = append(lines, itoa(i)+" "+label)
	}
	return strings.Join(lines, "\n"), nil
}

func itoa(i int) string { return big.NewInt(int64(i)).String() }

// testIMAPSync syncs a real IMAP conversation into organizationID.
func testIMAPSync(t *testing.T, application *app.Application, organizationID string) {
	ctx := context.Background()

	user := imapmemserver.NewUser("sync@example.com", "app-password")
	for name, attr := range map[string]imap.MailboxAttr{"INBOX": "", "Junk": imap.MailboxAttrJunk, "Sent": imap.MailboxAttrSent, "Trash": imap.MailboxAttrTrash} {
		var opts *imap.CreateOptions
		if attr != "" {
			opts = &imap.CreateOptions{SpecialUse: []imap.MailboxAttr{attr}}
		}
		if err := user.Create(name, opts); err != nil {
			t.Fatal(err)
		}
	}
	appendMail(t, user, "INBOX", `From: Boss <boss@example.com>
To: Me <sync@example.com>
Subject: Contract
Message-ID: <1@example.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary=b

--b
Content-Type: text/plain; charset=utf-8

Please sign it.
--b
Content-Type: text/html

<p>Please sign it.</p>
--b--
`)
	appendMail(t, user, "INBOX", `From: news@shop.example
Subject: Sale
Content-Type: text/html

<p>50% off</p>
`, imap.FlagSeen, imap.FlagFlagged)
	appendMail(t, user, "Junk", "From: spam@example.com\nSubject: You won\n\nclick\n")

	port, pool := tlsIMAPServer(t, user)

	application.Config.App.AllowPrivateHosts = true
	application.AI = classifier{}
	defer func() {
		application.Config.App.AllowPrivateHosts = false
		application.AI = nil
	}()

	syncer := mailsync.New(application)
	syncer.RootCAs = pool

	if err := syncer.Verify(ctx, "127.0.0.1", port, "sync@example.com", "wrong"); err == nil {
		t.Fatal("wrong password verified")
	}
	if err := syncer.Verify(ctx, "127.0.0.1", port, "sync@example.com", "app-password"); err != nil {
		t.Fatalf("verify: %v", err)
	}

	account := models.EmailAccount{
		OrganizationID: uuid.MustParse(organizationID),
		Provider:       constant.ProviderIMAP,
		Label:          "Sync",
		Email:          "sync@example.com",
		IMAPHost:       "127.0.0.1",
		IMAPPort:       port,
		Username:       "sync@example.com",
		Password:       application.Secrets.Seal("app-password"),
	}
	account.ID = uuid.Must(uuid.NewV7())
	if err := application.Repositories.EmailAccount.Insert(ctx, account); err != nil {
		t.Fatal(err)
	}

	folder := func(name string) []models.Mail {
		t.Helper()
		params := repositories.MailListParams{ListParams: repositories.ListParams{Limit: 100}, Folder: name}
		mails, err := application.Repositories.Mail.List(ctx, account.ID, params)
		if err != nil {
			t.Fatal(err)
		}
		return mails
	}

	if err := syncer.Sync(ctx, account); err != nil {
		t.Fatalf("sync: %v", err)
	}
	inbox := folder(constant.FolderInbox)
	if len(inbox) != 2 || len(folder(constant.FolderSpam)) != 1 || len(folder(constant.FolderSent)) != 0 {
		t.Fatalf("after first sync: inbox %d, spam %d", len(inbox), len(folder(constant.FolderSpam)))
	}
	byFrom := map[string]models.Mail{}
	for _, m := range inbox {
		full, err := application.Repositories.Mail.Get(ctx, m.ID)
		if err != nil {
			t.Fatal(err)
		}
		byFrom[full.FromEmail] = full
	}
	contract, sale := byFrom["boss@example.com"], byFrom["news@shop.example"]
	if contract.Body != "Please sign it." || contract.FromName != "Boss" || contract.IsRead || len(contract.To) != 1 {
		t.Fatalf("multipart mail: %+v", contract)
	}
	if sale.Body != "50% off" || !sale.IsRead || !sale.IsStarred {
		t.Fatalf("html mail: %+v", sale)
	}
	if contract.BodyHTML == nil || *contract.BodyHTML != "<p>Please sign it.</p>" || sale.BodyHTML == nil || *sale.BodyHTML != "<p>50% off</p>" {
		t.Fatalf("HTML parts not kept: %q, %q", *contract.BodyHTML, *sale.BodyHTML)
	}
	for _, m := range []models.Mail{contract, sale} {
		if m.Importance == nil || *m.ImportanceBy != constant.ImportanceByAI {
			t.Fatalf("mail not classified by the AI: %+v", m)
		}
	}
	synced, err := application.Repositories.EmailAccount.Get(ctx, account.ID)
	if err != nil || synced.SyncedAt == nil || synced.SyncError != nil {
		t.Fatalf("sync outcome: %+v %v", synced, err)
	}

	// Mail synced before the HTML part was kept gets its bodies re-read.
	if _, err := application.DB.Exec(`UPDATE mails SET body = 'old', body_html = NULL WHERE email_account_id = $1`, account.ID); err != nil {
		t.Fatal(err)
	}
	if err := syncer.Sync(ctx, account); err != nil {
		t.Fatalf("backfill sync: %v", err)
	}
	if again, _ := application.Repositories.Mail.Get(ctx, contract.ID); again.Body != "Please sign it." || again.BodyHTML == nil || *again.BodyHTML != "<p>Please sign it.</p>" {
		t.Fatalf("backfill: %q %v", again.Body, again.BodyHTML)
	}

	// The next run takes only what is new.
	appendMail(t, user, "INBOX", "From: late@example.com\nSubject: Late\n\nnew one\n")
	if err := syncer.Sync(ctx, account); err != nil {
		t.Fatalf("second sync: %v", err)
	}
	if inbox := folder(constant.FolderInbox); len(inbox) != 3 {
		t.Fatalf("after second sync: %d inbox mails, want 3", len(inbox))
	}

	// Changes go to the server. Read and starred are flags on the message.
	read, starred := true, true
	if err := syncer.SetFlags(ctx, account, contract, &read, &starred); err != nil {
		t.Fatalf("set flags: %v", err)
	}
	if flags := serverFlags(t, port, pool, "INBOX", contract.UID); !slices.Contains(flags, imap.FlagSeen) || !slices.Contains(flags, imap.FlagFlagged) {
		t.Fatalf("flags on the server: %v", flags)
	}

	// A move carries the mail's importance and summary to its copy.
	if err := application.Repositories.Mail.SetSummary(ctx, contract.ID, "kept summary"); err != nil {
		t.Fatal(err)
	}
	if err := syncer.Move(ctx, account, contract, constant.FolderSpam); err != nil {
		t.Fatalf("move to spam: %v", err)
	}
	spam := folder(constant.FolderSpam)
	if len(folder(constant.FolderInbox)) != 2 || len(spam) != 2 {
		t.Fatalf("after the move: inbox %d, spam %d", len(folder(constant.FolderInbox)), len(spam))
	}
	var moved models.Mail
	for _, m := range spam {
		if full, _ := application.Repositories.Mail.Get(ctx, m.ID); full.FromEmail == "boss@example.com" {
			moved = full
		}
	}
	if moved.Summary == nil || *moved.Summary != "kept summary" || moved.Importance == nil || !moved.IsRead || !moved.IsStarred {
		t.Fatalf("moved mail lost its state: %+v", moved)
	}
	if _, err := application.Repositories.Mail.Get(ctx, contract.ID); !apperr.IsNotFound(err) {
		t.Fatalf("the old row stayed: %v", err)
	}

	// No archive folder (and no Gmail All Mail) on this server.
	if err := syncer.Move(ctx, account, moved, constant.FolderArchive); err == nil || !strings.Contains(err.Error(), "no archive folder") {
		t.Fatalf("archive without the folder: %v", err)
	}

	// Trash, then delete for good: gone from the server and the app.
	if err := syncer.Move(ctx, account, moved, constant.FolderTrash); err != nil {
		t.Fatalf("move to trash: %v", err)
	}
	trash := folder(constant.FolderTrash)
	if len(trash) != 1 {
		t.Fatalf("trash: %d mails", len(trash))
	}
	trashed, _ := application.Repositories.Mail.Get(ctx, trash[0].ID)
	if err := syncer.Delete(ctx, account, trashed); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if len(folder(constant.FolderTrash)) != 0 || serverFlags(t, port, pool, "Trash", trashed.UID) != nil {
		t.Fatal("deleted mail is still there")
	}

	// A failed sync is recorded on the account.
	account.Password = application.Secrets.Seal("revoked")
	if err := syncer.Sync(ctx, account); err == nil {
		t.Fatal("sync with a revoked password succeeded")
	}
	failed, _ := application.Repositories.EmailAccount.Get(ctx, account.ID)
	if failed.SyncError == nil || failed.SyncedAt == nil {
		t.Fatalf("failed sync not recorded, or the last good time lost: %+v", failed)
	}

	if err := application.Repositories.EmailAccount.Delete(ctx, account.ID); err != nil {
		t.Fatal(err)
	}
}

// serverFlags returns a message's flags as the test server holds them, nil
// when the message is gone.
func serverFlags(t *testing.T, port int, pool *x509.CertPool, mailbox string, uid uint32) []imap.Flag {
	t.Helper()
	c, err := imapclient.DialTLS("127.0.0.1:"+strconv.Itoa(port), &imapclient.Options{TLSConfig: &tls.Config{RootCAs: pool}})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	if err := c.Login("sync@example.com", "app-password").Wait(); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Select(mailbox, nil).Wait(); err != nil {
		t.Fatal(err)
	}
	msgs, err := c.Fetch(imap.UIDSetNum(imap.UID(uid)), &imap.FetchOptions{Flags: true}).Collect()
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) == 0 {
		return nil
	}
	return msgs[0].Flags
}
