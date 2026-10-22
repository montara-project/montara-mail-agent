import { IconArrowRight } from '@tabler/icons-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import ThemeProvider from '@/lib/providers/themes'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Montara Mail: AI email management', template: '%s · Montara Mail' },
  description:
    'Connect Gmail, Outlook, Yahoo, Lark, or any IMAP inbox and let an AI agent sort, summarize, and draft your email.',
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

const nav = [
  { href: '/#providers', label: 'Providers' },
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
]

const footerLinks = [
  { title: 'Product', links: nav },
  { title: 'Company', links: [{ href: '/contact', label: 'Contact' }] },
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
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      {/* 192px export of public/static/images/montara-mail-logo.png (444KB); its white tile is rounded like an app icon. */}
      <img src="/favicon/android-chrome-192x192.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
      Montara Mail
    </Link>
  )
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes sets the theme class before hydration.
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex min-h-svh flex-col overflow-x-clip">
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
              <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
                <Logo />
                <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <Button size="md" radius="md" asChild>
                  <Link href="/contact">
                    Get early access
                    <IconArrowRight />
                  </Link>
                </Button>
              </div>
            </header>

            <main className="flex-1">{children}</main>

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
                © {new Date().getFullYear()} Montara Mail
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
