import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy Policy',
  description:
    'What Montara Mail stores when you connect your inboxes, what it sends to your AI model, who else handles your data, and how to remove it.',
})

const email = 'support@montaramail.web.id'

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p>Last updated: October 27, 2026</p>

      <p>
        This policy covers the hosted Montara Mail service at app.montaramail.web.id and this
        website. Montara Mail is also open source and can be self-hosted: on a self-hosted server,
        your data stays on that server and whoever runs it is responsible for it, not us.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, email address, and avatar URL if you add one, or
          your Google profile if you sign in with Google. Your password is stored only as a hash. If
          you turn on two-factor authentication, we store what is needed to check your codes.
        </li>
        <li>
          <strong>Connected mailboxes:</strong> the address, server settings, and the app password
          or OAuth token that lets Montara Mail reach each mailbox. Passwords and tokens are
          encrypted in our database.
        </li>
        <li>
          <strong>Your mail:</strong> a background sync copies the messages in your connected
          mailboxes: sender, recipients, subject, body, folder, and read and starred state. Changes
          you make in Montara Mail, such as reading, starring, moving, or deleting a message, are
          written back to your mail server.
        </li>
        <li>
          <strong>What the AI produces:</strong> importance labels, summaries, drafted replies, and
          your conversations with the assistant.
        </li>
        <li>
          <strong>Organization settings:</strong> the AI model your organization connects, including
          its API key, which is encrypted.
        </li>
        <li>
          <strong>Activity log:</strong> sign-ins and changes to your account and organization, with
          the IP address and browser they came from, so you can review them in Settings.
        </li>
      </ul>

      <h2>What we send to AI models</h2>
      <p>
        To sort new mail, summarize threads, draft replies, and answer your questions, Montara Mail
        sends the relevant messages (sender, subject, and body) to an AI model. Each organization
        chooses its own model: any OpenAI- or Anthropic-compatible provider, or one it hosts itself.
        Until an organization sets one, the hosted service uses Anthropic. That provider processes
        the content under its own terms. We do not use your email to train AI models.
      </p>

      <h2>Who else handles your data</h2>
      <ul>
        <li>
          <strong>Your mail providers</strong> (such as Google, Microsoft, Yahoo, Zoho, or your IMAP
          host): Montara Mail connects to them to read and send mail on your behalf.
        </li>
        <li>
          <strong>Your organization&apos;s AI provider</strong>, as described above.
        </li>
        <li>
          <strong>Resend</strong>, which delivers our account emails: sign-up verification, sign-in
          links, and password resets.
        </li>
        <li>
          <strong>Cloudflare</strong>, which serves this website and sits in front of the hosted
          app.
        </li>
      </ul>
      <p>
        Members of an organization can see the mailboxes connected to it. We do not sell your
        personal information, and we disclose it otherwise only when the law requires us to.
      </p>

      <h2>Google user data</h2>
      <p>
        Montara Mail&apos;s use and transfer of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="underline"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We use Gmail data only to show, sort, summarize,
        and send your mail inside Montara Mail.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use a cookie to keep you signed in. Your browser also stores a few preferences locally,
        such as your theme, your active organization, and whether email addresses are hidden. This
        website does not use advertising or tracking cookies.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Synced mail stays in Montara Mail while its mailbox is connected. Disconnecting a mailbox
        removes its synced mail from Montara Mail; the mailbox itself is not touched. To delete your
        account and everything in it, email us at{' '}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>{' '}
        and we will remove it.
      </p>

      <h2>Changes</h2>
      <p>When we change this policy, we update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, email{' '}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
        .
      </p>
    </article>
  )
}
