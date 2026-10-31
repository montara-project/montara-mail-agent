import Link from 'next/link'

import { DOCS_URL, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  path: '/integrations',
  title: 'Integrations: Gmail, Outlook, Yahoo, IMAP',
  description:
    'Connect Gmail, Outlook, Yahoo, iCloud, Lark, Zoho, or any IMAP mailbox to Montara Mail, and manage them all in one inbox with an AI agent.',
})

const providers = [
  {
    name: 'Gmail',
    text: 'Personal Gmail and Google Workspace accounts. Connect with Google sign-in, or with an app password after turning on 2-Step Verification.',
  },
  {
    name: 'Outlook',
    text: 'Outlook.com and Microsoft 365 mailboxes. Connect with Microsoft sign-in or an app password. Some Microsoft 365 organizations turn IMAP sign-in off.',
  },
  {
    name: 'Yahoo',
    text: 'Yahoo Mail accounts, connected with an app password from Yahoo Account Security.',
  },
  {
    name: 'iCloud',
    text: 'iCloud Mail, connected with an app-specific password from your Apple account.',
  },
  {
    name: 'Lark',
    text: 'Lark Mail, connected with a password generated under Third-party email client in its settings.',
  },
  {
    name: 'Zoho',
    text: 'Zoho Mail, connected with an app password once IMAP access is on. Custom-domain and non-US accounts use the IMAP option.',
  },
  {
    name: 'Any IMAP provider',
    text: 'Any other mailbox that supports IMAP and SMTP, with the server and port your provider documents. The connection always uses TLS.',
  },
]

export default function IntegrationsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
      <h1 className="text-3xl font-bold tracking-tight">Connect every mailbox you own</h1>
      <p>
        Montara Mail reads over IMAP and sends over SMTP, so it works with the provider you already
        use. Connect as many mailboxes as you need, then read, sort, and reply from one inbox.
      </p>

      {providers.map((provider) => (
        <section key={provider.name}>
          <h2>{provider.name}</h2>
          <p className="mt-2">{provider.text}</p>
        </section>
      ))}

      <h2>What stays in sync</h2>
      <p>
        A background job syncs every mailbox. Read, starred, move, and delete are written back to
        the mail server, so your other mail apps stay in step.
      </p>

      <h2>How credentials are stored</h2>
      <p>
        App passwords and OAuth tokens are encrypted in the database and never shown again after you
        save them.
      </p>

      <p>
        Step-by-step instructions for each provider are in the{' '}
        <Link href={`${DOCS_URL}/mailboxes`} className="underline">
          mailbox guide
        </Link>
        .
      </p>
    </article>
  )
}
