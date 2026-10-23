package constant

// Mail folders synced from IMAP. Spam is the server's \Junk folder.
const (
	FolderInbox  = "inbox"
	FolderSent   = "sent"
	FolderDrafts = "drafts"
	FolderSpam   = "spam"
	FolderTrash  = "trash"
)

// Folders lists every synced folder.
var Folders = []string{FolderInbox, FolderSent, FolderDrafts, FolderSpam, FolderTrash}

// Mail importance, set by the AI or the user.
const (
	ImportanceImportant   = "important"
	ImportanceLowPriority = "low_priority"
)

// Who set a mail's importance; a user's choice is never overwritten.
const (
	ImportanceByAI   = "ai"
	ImportanceByUser = "user"
)

// IMAPServer is where a provider's mail lives.
type IMAPServer struct {
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
	ProviderIMAP    = "imap"
)

// ProviderServers are the fixed IMAP servers of the known providers.
var ProviderServers = map[string]IMAPServer{
	ProviderGmail:   {Host: "imap.gmail.com", Port: 993},
	ProviderOutlook: {Host: "outlook.office365.com", Port: 993},
	ProviderYahoo:   {Host: "imap.mail.yahoo.com", Port: 993},
	ProviderICloud:  {Host: "imap.mail.me.com", Port: 993},
}
