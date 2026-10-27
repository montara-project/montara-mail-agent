package constant

// Mail folders synced from IMAP. Spam is the server's \Junk folder.
const (
	FolderInbox   = "inbox"
	FolderArchive = "archive"
	FolderSent    = "sent"
	FolderDrafts  = "drafts"
	FolderSpam    = "spam"
	FolderTrash   = "trash"
)

// Folders lists every synced folder.
var Folders = []string{FolderInbox, FolderArchive, FolderSent, FolderDrafts, FolderSpam, FolderTrash}

// MoveTargets are the folders a user may move a mail to.
var MoveTargets = []string{FolderInbox, FolderArchive, FolderSpam, FolderTrash}

// Mail importance, set by the AI or the user.
const (
	ImportanceImportant   = "important"
	ImportanceLowPriority = "low_priority"
	// ImportanceBroadcast is one-to-many mail: newsletters, announcements and
	// mass mailings, apart from the low-priority rest.
	ImportanceBroadcast = "broadcast"
)

// Importances lists every importance label.
var Importances = []string{ImportanceImportant, ImportanceLowPriority, ImportanceBroadcast}

// Who set a mail's importance; a user's choice is never overwritten.
const (
	ImportanceByAI   = "ai"
	ImportanceByUser = "user"
)

// MailServer is a host and port; for SMTP, 465 means implicit TLS and any
// other port STARTTLS.
type MailServer struct {
	Host string
	Port int
}

// Email providers. Every one is reached over IMAP with an app password; the
// custom one names its own server.
const (
	ProviderGmail   = "gmail"
	ProviderOutlook = "outlook"
	ProviderYahoo   = "yahoo"
	ProviderICloud  = "icloud"
	ProviderLark    = "lark"
	ProviderZoho    = "zoho"
	ProviderIMAP    = "imap"
)

// ProviderServers are the fixed IMAP and SMTP servers of the known providers
// (migration 000009 copies the SMTP ones).
var ProviderServers = map[string]struct{ IMAP, SMTP MailServer }{
	ProviderGmail:   {IMAP: MailServer{"imap.gmail.com", 993}, SMTP: MailServer{"smtp.gmail.com", 465}},
	ProviderOutlook: {IMAP: MailServer{"outlook.office365.com", 993}, SMTP: MailServer{"smtp.office365.com", 587}},
	ProviderYahoo:   {IMAP: MailServer{"imap.mail.yahoo.com", 993}, SMTP: MailServer{"smtp.mail.yahoo.com", 465}},
	ProviderICloud:  {IMAP: MailServer{"imap.mail.me.com", 993}, SMTP: MailServer{"smtp.mail.me.com", 587}},
	ProviderLark:    {IMAP: MailServer{"imap.larksuite.com", 993}, SMTP: MailServer{"smtp.larksuite.com", 465}},
	ProviderZoho:    {IMAP: MailServer{"imap.zoho.com", 993}, SMTP: MailServer{"smtp.zoho.com", 465}},
}
