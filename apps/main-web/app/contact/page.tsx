import { pageMetadata } from '@/lib/seo'

const email = 'hello@montaramail.web.id'

export const metadata = pageMetadata({
  path: '/contact',
  title: 'Contact',
  description: `Questions, feedback, or partnership requests for Montara Mail? Email ${email} and we will get back to you within two business days.`,
})

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        Questions, feedback, or partnership requests? Email us and we will get back to you within
        two business days.
      </p>
      <a href={`mailto:${email}`} className="mt-6 inline-block text-lg font-medium underline">
        {email}
      </a>
    </section>
  )
}
