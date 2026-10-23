// Package mailsync pulls mail from connected IMAP accounts into Postgres and
// classifies new inbox mail with the organization's LLM.
package mailsync

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/mailai"
	"montara-mail-agent/server/internal/models"
)

const (
	// A first sync takes only the newest messages of each folder; later
	// runs take everything new, up to perRunLimit.
	initialSyncLimit = 50
	perRunLimit      = 200
	// maxMessageBytes caps how much of a message is downloaded; the text
	// part comes first in almost every message, attachments after it.
	maxMessageBytes = 512 << 10
	syncTimeout     = 2 * time.Minute
	// classifyRounds bounds the LLM calls per sync; the rest waits for the next run.
	classifyRounds = 3
	// backfillLimit is how many old mails per folder get their HTML re-read per run.
	backfillLimit = 50
)

// bodySection is the start of the whole message; Peek leaves it unread on
// the server.
var bodySection = &imap.FetchItemBodySection{Peek: true, Partial: &imap.SectionPartial{Size: maxMessageBytes}}

// Syncer syncs accounts of one application.
type Syncer struct {
	app *app.Application
	// RootCAs verifies IMAP servers; nil means the system roots.
	RootCAs *x509.CertPool
}

func New(app *app.Application) *Syncer {
	return &Syncer{app: app}
}

// dial opens a TLS IMAP connection through the guarded dialer; ctx's
// deadline bounds every later read and write too.
func (s *Syncer) dial(ctx context.Context, host string, port int) (*imapclient.Client, error) {
	conn, err := lib.GuardedDialer(s.app.Config.App.AllowPrivateHosts).DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil, err
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	tlsConn := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12, RootCAs: s.RootCAs})
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		conn.Close()
		return nil, err
	}
	return imapclient.New(tlsConn, nil), nil
}

// login dials and signs in; the caller closes the client.
func (s *Syncer) login(ctx context.Context, host string, port int, username, password string) (*imapclient.Client, error) {
	c, err := s.dial(ctx, host, port)
	if err != nil {
		return nil, fmt.Errorf("connect to %s: %w", host, err)
	}
	if err := c.Login(username, password).Wait(); err != nil {
		c.Close()
		return nil, fmt.Errorf("sign in: %w", err)
	}
	return c, nil
}

// Verify checks that the credentials sign in, before an account is saved.
func (s *Syncer) Verify(ctx context.Context, host string, port int, username, password string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	c, err := s.login(ctx, host, port, username, password)
	if err != nil {
		return err
	}
	_ = c.Logout().Wait()
	return c.Close()
}

// Sync pulls an account's new mail and records the outcome on the account.
// A successful pull is followed by classification, whose failures are only
// logged: the mail is there either way.
func (s *Syncer) Sync(ctx context.Context, account models.EmailAccount) error {
	ctx, cancel := context.WithTimeout(ctx, syncTimeout)
	defer cancel()

	err := s.pull(ctx, account)
	var syncErr *string
	if err != nil {
		msg := err.Error()
		syncErr = &msg
	}
	// Recorded even when ctx ran out, so a timeout shows on the account.
	if serr := s.app.Repositories.EmailAccount.SetSynced(context.WithoutCancel(ctx), account.ID, syncErr); serr != nil {
		s.app.Logger.Error("mail sync: record outcome", "account", account.ID, "error", serr)
	}
	if err != nil {
		return err
	}

	s.classify(ctx, account)
	return nil
}

// connect signs in to an account's IMAP server with its saved password; the
// caller closes the client.
func (s *Syncer) connect(ctx context.Context, account models.EmailAccount) (*imapclient.Client, error) {
	password, err := s.app.Secrets.Open(account.Password)
	if err != nil {
		return nil, errors.New("the saved password can't be read, connect the account again")
	}
	return s.login(ctx, account.IMAPHost, account.IMAPPort, account.Username, password)
}

// mailboxes returns the server's mailbox name of each folder (see folderMailboxes).
func mailboxes(c *imapclient.Client) (map[string]string, error) {
	var opts *imap.ListOptions
	if c.Caps().Has(imap.CapSpecialUse) {
		opts = &imap.ListOptions{ReturnSpecialUse: true}
	}
	list, err := c.List("", "*", opts).Collect()
	if err != nil {
		return nil, fmt.Errorf("list folders: %w", err)
	}
	return folderMailboxes(list), nil
}

func (s *Syncer) pull(ctx context.Context, account models.EmailAccount) error {
	c, err := s.connect(ctx, account)
	if err != nil {
		return err
	}
	defer c.Close()
	defer c.Logout()

	mailboxes, err := mailboxes(c)
	if err != nil {
		return err
	}
	for _, folder := range constant.Folders {
		if mailbox, ok := mailboxes[folder]; ok {
			if err := s.pullFolder(ctx, c, account, folder, mailbox); err != nil {
				return fmt.Errorf("%s: %w", folder, err)
			}
		}
	}
	return nil
}

func (s *Syncer) pullFolder(ctx context.Context, c *imapclient.Client, account models.EmailAccount, folder, mailbox string) error {
	sel, err := c.Select(mailbox, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	if err := s.app.Repositories.Mail.DropStale(ctx, account.ID, folder, sel.UIDValidity); err != nil {
		return err
	}
	if err := s.pullNew(ctx, c, account, folder, sel); err != nil {
		return err
	}
	return s.backfill(ctx, c, account, folder)
}

// pullNew stores the folder's messages that arrived since the last sync.
func (s *Syncer) pullNew(ctx context.Context, c *imapclient.Client, account models.EmailAccount, folder string, sel *imap.SelectData) error {
	repo := &s.app.Repositories.Mail
	last, err := repo.MaxUID(ctx, account.ID, folder)
	if err != nil {
		return err
	}
	if sel.NumMessages == 0 || (sel.UIDNext != 0 && uint32(sel.UIDNext) <= last+1) {
		return nil
	}

	// "last+1:*" always matches the newest message, even an old one, so the
	// result is filtered again.
	var newer imap.UIDSet
	newer.AddRange(imap.UID(last+1), 0)
	found, err := c.UIDSearch(&imap.SearchCriteria{UID: []imap.UIDSet{newer}}, nil).Wait()
	if err != nil {
		return fmt.Errorf("search: %w", err)
	}
	uids := newUIDs(found.AllUIDs(), last, last == 0)
	if len(uids) == 0 {
		return nil
	}

	msgs, err := c.Fetch(imap.UIDSetNum(uids...), &imap.FetchOptions{
		UID:          true,
		Flags:        true,
		Envelope:     true,
		InternalDate: true,
		BodySection:  []*imap.FetchItemBodySection{bodySection},
	}).Collect()
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}

	mails := make([]models.Mail, 0, len(msgs))
	for _, msg := range msgs {
		m := toMail(msg.Envelope, msg.Flags, msg.InternalDate, msg.FindBodySection(bodySection))
		if m.ID, err = uuid.NewV7(); err != nil {
			return err
		}
		m.EmailAccountID, m.Folder, m.UIDValidity, m.UID = account.ID, folder, sel.UIDValidity, uint32(msg.UID)
		mails = append(mails, m)
	}
	return repo.InsertMany(ctx, mails)
}

// backfill re-reads the bodies of mail synced before the HTML part was kept,
// a batch per run, so it renders like newly synced mail.
func (s *Syncer) backfill(ctx context.Context, c *imapclient.Client, account models.EmailAccount, folder string) error {
	repo := &s.app.Repositories.Mail
	missing, err := repo.MissingHTML(ctx, account.ID, folder, backfillLimit)
	if err != nil || len(missing) == 0 {
		return err
	}

	uids := make([]imap.UID, len(missing))
	for i, uid := range missing {
		uids[i] = imap.UID(uid)
	}
	msgs, err := c.Fetch(imap.UIDSetNum(uids...), &imap.FetchOptions{
		UID:         true,
		BodySection: []*imap.FetchItemBodySection{bodySection},
	}).Collect()
	if err != nil {
		return fmt.Errorf("fetch bodies: %w", err)
	}
	for _, msg := range msgs {
		text, htmlBody := messageBodies(msg.FindBodySection(bodySection))
		if err := repo.SetBodies(ctx, account.ID, folder, uint32(msg.UID), clean(text), clean(htmlBody)); err != nil {
			return err
		}
	}
	// What the server no longer has keeps its old body.
	return repo.MarkNoHTML(ctx, account.ID, folder, missing)
}

// newUIDs keeps the uids after last, ascending as the server sent them, and
// only the newest of them when there are too many.
func newUIDs(found []imap.UID, last uint32, initial bool) []imap.UID {
	uids := make([]imap.UID, 0, len(found))
	for _, uid := range found {
		if uint32(uid) > last {
			uids = append(uids, uid)
		}
	}
	limit := perRunLimit
	if initial {
		limit = initialSyncLimit
	}
	if len(uids) > limit {
		uids = uids[len(uids)-limit:]
	}
	return uids
}

// classify labels the account's unclassified inbox mail, a batch per LLM call.
func (s *Syncer) classify(ctx context.Context, account models.EmailAccount) {
	client, err := s.app.LLMFor(ctx, account.OrganizationID)
	if err != nil {
		// No provider configured: the mail stays unclassified until one is.
		return
	}

	repo := &s.app.Repositories.Mail
	for range classifyRounds {
		mails, err := repo.Unclassified(ctx, account.ID, mailai.ClassifyBatch)
		if err != nil || len(mails) == 0 {
			return
		}
		labels, err := mailai.Classify(ctx, client, mails)
		if err != nil {
			s.app.Logger.Warn("mail sync: classify", "account", account.ID, "error", err)
			return
		}
		// A model that labels nothing would loop on the same batch.
		if len(labels) == 0 {
			return
		}
		for i, label := range labels {
			if err := repo.SetAIImportance(ctx, mails[i].ID, label); err != nil {
				s.app.Logger.Warn("mail sync: store importance", "mail", mails[i].ID, "error", err)
			}
		}
		if len(mails) < mailai.ClassifyBatch {
			return
		}
	}
}

// Run syncs every account now and then every interval, until ctx ends.
// ponytail: one account at a time, and every replica runs it; take a
// Postgres advisory lock per account once there are several replicas or
// many accounts.
func (s *Syncer) Run(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		accounts, err := s.app.Repositories.EmailAccount.All(ctx)
		if err != nil && ctx.Err() == nil {
			s.app.Logger.Error("mail sync: list accounts", "error", err)
		}
		for _, account := range accounts {
			if ctx.Err() != nil {
				return
			}
			if err := s.Sync(ctx, account); err != nil {
				s.app.Logger.Warn("mail sync failed", "account", account.ID, "error", err)
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
