import type { Metadata } from 'next'

import { IconArrowRight } from '@tabler/icons-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { APP_URL, DOCS_URL, GITHUB_URL, HOME_TITLE, SITE_NAME, SITE_URL } from '@/lib/seo'

// Self-hosted variable fonts, imported here so the bundler rewrites each
// `url()` and emits the woff2 files. Every face carries latin (+ ext) subsets
// behind unicode-range, so a browser downloads only what the page renders.
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/outfit'
import '@fontsource-variable/plus-jakarta-sans'

import './globals.css'

// Canonical and Open Graph live on each page (lib/seo.ts): set here, every
// page inherited the home page's canonical and told search engines it was a
// duplicate of it.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s · ${SITE_NAME}` },
  // X falls back to each page's og:title, og:description and og:image.
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/favicon/site.webmanifest',
}

// Read once per server start, not per render (react/purity).
const YEAR = new Date().getFullYear()

const nav = [
  { href: '/#providers', label: 'Providers' },
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: DOCS_URL, label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
]

const footerLinks = [
  {
    title: 'Product',
    links: [
      ...nav.filter((item) => item.href !== DOCS_URL),
      { href: '/integrations', label: 'Integrations' },
      { href: '/self-hosted', label: 'Self-hosted' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: DOCS_URL, label: 'Docs' },
      { href: GITHUB_URL, label: 'GitHub' },
      { href: APP_URL, label: 'Sign in' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
]

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight whitespace-nowrap"
    >
      {/* 192px export of public/images/mail-agent-logo.png (400KB); its white tile is rounded like an app icon. */}
      <img
        src="/favicon/android-chrome-192x192.png"
        alt=""
        width={36}
        height={36}
        className="size-9 rounded-lg"
      />
      Montara Mail
    </Link>
  )
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The color scheme follows the OS: globals.css swaps the token set inside
    // `prefers-color-scheme: dark`, so no theme class is set here.
    <html lang="en">
      <head>
        {/* Cookieless visit counts (see the Privacy Policy). */}
        <script
          defer
          src="https://analytics.masb0ymas.com/script.js"
          data-website-id="00f68333-a04a-4545-be39-495a293d3883"
        />
      </head>
      <body>
        <div className="flex min-h-svh flex-col overflow-x-clip">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
              <Logo />
              <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="md" variant="ghost" className="hidden sm:inline-flex" asChild>
                  <Link href={APP_URL}>Sign in</Link>
                </Button>
                <Button size="md" asChild>
                  <Link href="https://app.montaramail.web.id">
                    Get early access
                    <IconArrowRight className="hidden sm:block" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Small screens: the same destinations as a scrollable strip instead
                of a menu that hides them. The strip bleeds to the viewport edges
                so a cut-off item reads as "more to the side". */}
            <nav
              aria-label="Sections"
              className="border-t border-border/60 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
                {nav.map((item) => (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className="flex min-h-11 items-center rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </header>

          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>

          <footer className="border-t">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
              <div className="space-y-3">
                <Logo />
                <p className="max-w-xs text-sm text-muted-foreground">
                  One AI agent for every inbox you own.
                </p>
              </div>
              {footerLinks.map((col) => (
                <div key={col.title} className="space-y-3 text-sm">
                  <p className="font-medium">{col.title}</p>
                  <ul className="space-y-2 text-muted-foreground">
                    {col.links.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="transition-colors hover:text-foreground">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mx-auto max-w-6xl border-t px-6 py-6 text-sm text-muted-foreground">
              © {YEAR} Montara Mail
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
