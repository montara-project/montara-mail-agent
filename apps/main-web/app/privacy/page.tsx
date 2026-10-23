import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p>Last updated: October 22, 2026</p>

      <h2>Information we collect</h2>
      <p>
        We collect the details you give us when you create an account or contact us, such as your
        name and email address, and the email data you allow Montara Mail to access in order to
        provide the service.
      </p>

      <h2>How we use it</h2>
      <p>
        We use your information only to run, maintain, and improve Montara Mail and to communicate
        with you about it. We do not sell your personal information.
      </p>

      <h2>Sharing</h2>
      <p>
        We share data only with service providers that help us operate the service, under agreements
        that require them to protect it, or when the law requires us to.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can ask us to delete your account and
        its data at any time.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, email{' '}
        <a href="mailto:support@montaramail.web.id" className="underline">
          support@montaramail.web.id
        </a>
        .
      </p>
    </article>
  )
}
