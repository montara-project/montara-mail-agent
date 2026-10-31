import Link from 'next/link'

import { DOCS_URL, GITHUB_URL, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  path: '/self-hosted',
  title: 'Self-hosted, open source AI email client',
  description:
    'Run Montara Mail on your own server with Docker and PostgreSQL. An open source AI email client under GPL-3.0, with the AI model of your choice.',
})

export default function SelfHostedPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h1 className="text-3xl font-bold tracking-tight">Self-host your AI email client</h1>
      <p>
        Montara Mail is open source under GPL-3.0. Run it on your own server, and your mail, your
        mailbox credentials, and your AI settings stay there.
      </p>

      <h2>What you need</h2>
      <ul>
        <li>Docker, to run the single image that holds the API and the web app.</li>
        <li>PostgreSQL 18.</li>
        <li>A secret of at least 32 characters for encrypting mailbox credentials.</li>
        <li>An AI model, if you want the AI features.</li>
      </ul>

      <h2>Choose an edition</h2>
      <p>
        <strong>Community</strong> is for one person on their own server: no sign-up, and the only
        account is the one you configure. <strong>Cloud</strong> is for a shared server with open
        sign-up and organizations, and it needs Resend for verification emails.
      </p>

      <h2>Use your own AI model</h2>
      <p>
        Point Montara Mail at any OpenAI- or Anthropic-compatible endpoint, or at a model on your
        own network such as Ollama, vLLM, or LM Studio. Without a model, mail still syncs and you
        can still read and send it.
      </p>

      <h2>Get started</h2>
      <p>
        Follow the{' '}
        <Link href={`${DOCS_URL}/self-hosting/docker`} className="underline">
          Docker guide
        </Link>{' '}
        for Docker Compose, Dokploy, or Coolify, or read the source on{' '}
        <Link href={GITHUB_URL} className="underline">
          GitHub
        </Link>
        .
      </p>
    </article>
  )
}
