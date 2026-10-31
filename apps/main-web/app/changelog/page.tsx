import type { Metadata } from 'next'

import { releases } from '@/lib/changelog'
import { GITHUB_URL, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  path: '/changelog',
  title: 'Changelog',
  description:
    'Every Montara Mail release: new features, fixes and improvements across the server, web app and docs.',
})

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Text with `inline code` spans, as the changelog writes them. */
function InlineCode({ text }: { text: string }) {
  return text.split('`').map((part, index) =>
    index % 2 ? (
      <code key={index} className="font-mono text-[0.9em] text-foreground">
        {part}
      </code>
    ) : (
      part
    )
  )
}

const chip =
  'rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-4 text-muted-foreground'

export default function ChangelogPage() {
  const latest = releases[0]
  return (
    <div>
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="font-mono text-xs lowercase text-muted-foreground">Product</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Changelog
          </h1>
          {latest ? (
            <p className="mt-4 font-mono text-xs lowercase text-muted-foreground">
              latest v{latest.version} · {formatDate(latest.date)}
            </p>
          ) : null}
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
            What changed in each release of Montara Mail, newest first. Every entry links to its
            commit on{' '}
            <a href={GITHUB_URL} className="underline underline-offset-4 hover:no-underline">
              GitHub
            </a>
            .
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <aside className="hidden lg:block">
          <nav
            aria-label="Versions"
            className="sticky top-24 flex flex-col gap-1.5 border-l border-border pl-4"
          >
            {releases.map((release) => (
              <a
                key={release.version}
                href={`#v${release.version}`}
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                v{release.version}
              </a>
            ))}
          </nav>
        </aside>

        {/* Small screens: the versions as a scrollable strip, like the header's sections strip. */}
        <div className="border-b border-border lg:hidden">
          <nav aria-label="Versions" className="mx-auto max-w-6xl">
            <ul className="flex gap-1 overflow-x-auto px-6 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {releases.map((release) => (
                <li key={release.version} className="shrink-0">
                  <a
                    href={`#v${release.version}`}
                    className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    v{release.version}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="min-w-0 max-w-3xl">
          {releases.map((release) => (
            <section
              key={release.version}
              id={`v${release.version}`}
              className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-xl font-medium tracking-tight sm:text-2xl">
                  v{release.version}
                </h2>
                <p className="font-mono text-xs lowercase text-muted-foreground">
                  {release.compareUrl ? (
                    <a href={release.compareUrl} className="hover:text-foreground">
                      <time dateTime={release.date}>{formatDate(release.date)}</time>
                    </a>
                  ) : (
                    <time dateTime={release.date}>{formatDate(release.date)}</time>
                  )}
                </p>
              </div>

              {release.groups.map((group) => (
                <div key={group.title} className="mt-8">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {group.title.charAt(0) + group.title.slice(1).toLowerCase()}
                    </h3>
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {group.entries.length}
                    </span>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {group.entries.map((entry, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 text-[15px] leading-7 text-muted-foreground"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-3 size-1 self-start rounded-full bg-border"
                        />
                        <span>
                          {entry.scope ? (
                            <span className={`${chip} mr-2`}>{entry.scope}</span>
                          ) : null}
                          <InlineCode text={entry.text} />
                        </span>
                        {entry.commit ? (
                          <a
                            href={entry.commit.url}
                            aria-label={`Commit ${entry.commit.hash.slice(0, 7)} on GitHub`}
                            className="font-mono text-xs tabular-nums text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                          >
                            {entry.commit.hash.slice(0, 7)}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
