import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p>Last updated: October 22, 2026</p>

      <h2>Using Montara Mail</h2>
      <p>
        By using Montara Mail you agree to these terms. You must use the service lawfully and must
        not use it to send spam or to access mailboxes you are not authorized to access.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your account credentials secure and for all activity under
        your account.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of your email and other content. You grant us only the rights needed to
        process it on your behalf to provide the service.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The service is provided as is. We work to keep it reliable but do not guarantee it will be
        uninterrupted or error free, and to the extent the law allows we are not liable for indirect
        losses.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. When we do, we will change the date above, and continued use
        means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a href="mailto:support@montaramail.web.id" className="underline">
          support@montaramail.web.id
        </a>
        .
      </p>
    </article>
  )
}
