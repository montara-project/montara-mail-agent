package mailsync

import (
	"context"
	"fmt"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// actionTimeout bounds one change made on the mail server.
const actionTimeout = time.Minute

// errNoFolder answers a move to a folder the account's server doesn't have.
func errNoFolder(folder string) error {
	return apperr.New(apperr.KindBadRequest, "this account has no %s folder", folder)
}

// errStale answers a change to a mail whose folder the server renumbered
// since the last sync.
var errStale = apperr.New(apperr.KindConflict, "the folder changed on the mail server; sync the account and try again")

// openMail signs in and opens the mail's folder for changes. It returns the
// client, which the caller closes, and the server's mailbox names.
func (s *Syncer) openMail(ctx context.Context, account models.EmailAccount, m models.Mail) (*imapclient.Client, map[string]string, error) {
	c, err := s.connect(ctx, account)
	if err != nil {
		return nil, nil, err
	}
	boxes, err := mailboxes(c)
	if err != nil {
		c.Close()
		return nil, nil, err
	}
	mailbox, ok := boxes[m.Folder]
	if !ok {
		c.Close()
		return nil, nil, errNoFolder(m.Folder)
	}
	sel, err := c.Select(mailbox, nil).Wait()
	if err != nil {
		c.Close()
		return nil, nil, fmt.Errorf("open %s: %w", m.Folder, err)
	}
	if sel.UIDValidity != m.UIDValidity {
		c.Close()
		return nil, nil, errStale
	}
	return c, boxes, nil
}

// Move moves a mail to another folder on the server. The destination is
// synced right away, then the mail's importance and summary pass to its copy
// there and the old row goes. Without a copy (a server that doesn't report
// the new uid, or Gmail's unsynced All Mail) the mail simply leaves its folder.
func (s *Syncer) Move(ctx context.Context, account models.EmailAccount, m models.Mail, to string) error {
	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	c, boxes, err := s.openMail(ctx, account, m)
	if err != nil {
		return err
	}
	defer c.Close()
	defer c.Logout()

	dest, synced := boxes[to]
	if to == constant.FolderArchive && dest == "" {
		dest = boxes[allMail]
	}
	if dest == "" {
		return errNoFolder(to)
	}

	moved, err := c.Move(imap.UIDSetNum(imap.UID(m.UID)), dest).Wait()
	if err != nil {
		return fmt.Errorf("move: %w", err)
	}

	var newUID uint32
	if synced {
		if uids, ok := moved.DestUIDs.(imap.UIDSet); ok {
			if nums, ok := uids.Nums(); ok && len(nums) == 1 {
				newUID = uint32(nums[0])
			}
		}
		// Takes in the moved mail and anything that arrived before it, so the
		// sync's uid cursor never skips a message.
		sel, err := c.Select(dest, &imap.SelectOptions{ReadOnly: true}).Wait()
		if err != nil {
			return fmt.Errorf("open %s: %w", to, err)
		}
		if err := s.app.Repositories.Mail.DropStale(ctx, account.ID, to, sel.UIDValidity); err != nil {
			return err
		}
		if err := s.pullNew(ctx, c, account, to, sel); err != nil {
			return err
		}
	}
	return s.app.Repositories.Mail.Replace(ctx, m, to, newUID)
}

// Delete removes a mail from the server for good: it is flagged \Deleted and
// expunged. Callers move mail to the trash first; this is for the trash itself.
func (s *Syncer) Delete(ctx context.Context, account models.EmailAccount, m models.Mail) error {
	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	c, _, err := s.openMail(ctx, account, m)
	if err != nil {
		return err
	}
	defer c.Close()
	defer c.Logout()

	uid := imap.UIDSetNum(imap.UID(m.UID))
	deleted := &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagDeleted}}
	if err := c.Store(uid, deleted, nil).Close(); err != nil {
		return fmt.Errorf("flag deleted: %w", err)
	}
	// Without UIDPLUS, EXPUNGE also removes other mail already flagged
	// \Deleted in the folder; in the trash that is what the user wants anyway.
	expunge := c.Expunge()
	if c.Caps().Has(imap.CapUIDPlus) {
		expunge = c.UIDExpunge(uid)
	}
	if err := expunge.Close(); err != nil {
		return fmt.Errorf("expunge: %w", err)
	}
	return s.app.Repositories.Mail.Delete(ctx, m.ID)
}

// SetFlags writes a mail's read and starred states back to the server; nil
// leaves one as it is.
func (s *Syncer) SetFlags(ctx context.Context, account models.EmailAccount, m models.Mail, read, starred *bool) error {
	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	c, _, err := s.openMail(ctx, account, m)
	if err != nil {
		return err
	}
	defer c.Close()
	defer c.Logout()

	uid := imap.UIDSetNum(imap.UID(m.UID))
	for flag, on := range map[imap.Flag]*bool{imap.FlagSeen: read, imap.FlagFlagged: starred} {
		if on == nil {
			continue
		}
		op := imap.StoreFlagsDel
		if *on {
			op = imap.StoreFlagsAdd
		}
		if err := c.Store(uid, &imap.StoreFlags{Op: op, Silent: true, Flags: []imap.Flag{flag}}, nil).Close(); err != nil {
			return fmt.Errorf("store %s: %w", flag, err)
		}
	}
	return nil
}
