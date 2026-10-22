import type { Metadata } from 'next'
import Link from 'next/link'

import ThemeProvider from '@/lib/providers/themes'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Montara Mail', template: '%s · Montara Mail' },
  description: 'Montara Mail, your email agent.',
}

const nav = [
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes sets the theme class before hydration.
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex min-h-svh flex-col">
            <header className="border-b">
              <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <Link href="/" className="font-semibold">
                  Montara Mail
                </Link>
                <nav className="flex gap-4 text-sm text-muted-foreground">
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:text-foreground">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="border-t">
              <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
                <span>© {new Date().getFullYear()} Montara Mail</span>
                <nav className="flex gap-4">
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:text-foreground">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
