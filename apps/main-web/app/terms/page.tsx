import Link from 'next/link'

import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  path: '/terms',
  title: 'Terms of Service',
  description:
    'The terms for the hosted Montara Mail service: your account and organization, connected mailboxes, AI drafts you approve, your AI provider, and acceptable use.',
})

const email = 'support@montaramail.web.id'

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p>Last updated: October 27, 2026</p>

      <p>
        These terms cover the hosted Montara Mail service at app.montaramail.web.id. By using it you
        agree to them. The Montara Mail software is open source under the GNU General Public License
        v3.0: if you run it on your own server, that license governs the software and these terms do
        not apply to your instance.
      </p>

      <h2>Early access</h2>
      <p>
        The hosted service is in early access. Features may change, be added, or be removed as the
        product develops.
      </p>

      <h2>Your account and organization</h2>
      <ul>
        <li>
          You are responsible for keeping your sign-in credentials secure and for activity under
          your account. We recommend turning on two-factor authentication.
        </li>
        <li>
          Mailboxes are connected to an organization, and every member of that organization can read
          them. Add only people who should see that mail.
        </li>
      </ul>

      <h2>Connected mailboxes</h2>
      <ul>
        <li>
          Connect only mailboxes you own or are authorized to access, and follow your mail
          provider&apos;s terms when you do.
        </li>
        <li>
          Montara Mail acts on the mailbox itself. Reading, starring, moving, and deleting a message
          in Montara Mail does the same on your mail server, and a message you delete forever cannot
          be recovered by us.
        </li>
      </ul>

      <h2>AI features</h2>
      <ul>
        <li>
          The AI sorts mail, writes summaries, and drafts replies. Its output can be wrong or
          incomplete, so check it before you rely on it.
        </li>
        <li>
          The AI never sends mail on its own. A reply, forward, or new message it proposes is sent
          only after someone in your organization approves it, and you are responsible for the mail
          you send.
        </li>
        <li>
          If your organization connects its own AI provider, its use is subject to that
          provider&apos;s terms and pricing, and you must have the right to use the API key you add.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not use Montara Mail to:</p>
      <ul>
        <li>send spam, phishing, or unlawful content;</li>
        <li>access mailboxes or accounts you are not authorized to use;</li>
        <li>
          probe, overload, or bypass the security of the hosted service or the mail servers it
          connects to.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of your email and everything else you put into Montara Mail. You grant us
        only the rights needed to store and process it to run the service for you, as described in
        the{' '}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2>Fees</h2>
      <p>
        We do not charge for the hosted service today. If paid plans are introduced, they will come
        with their own terms that you accept before you are charged.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Montara Mail at any time. Disconnecting a mailbox removes its synced mail
        from Montara Mail, and you can ask us to delete your account by emailing{' '}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
        . We may suspend or close accounts that break these terms.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The service is provided as is. We work to keep it reliable but do not guarantee it will be
        uninterrupted or error free, and to the extent the law allows we are not liable for indirect
        losses, including mail lost or sent through actions you approved.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. When we do, we change the date above, and continued use means you
        accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
        .
      </p>
    </article>
  )
}
