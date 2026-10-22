import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Montara Mail</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        An email agent that reads, sorts, and drafts replies for you, so your inbox takes minutes
        instead of hours.
      </p>
      <Button size="lg" asChild>
        <Link href="/contact">Get in touch</Link>
      </Button>
    </section>
  )
}
