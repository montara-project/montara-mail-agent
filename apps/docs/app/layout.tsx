import type { Metadata } from 'next'

import { Plus_Jakarta_Sans } from 'next/font/google'

import { Provider } from '@/components/provider'
import { appName, siteUrl } from '@/lib/shared'

import './global.css'

// The marketing site's face, so the docs read as the same product.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${appName} Docs`, template: `%s | ${appName} Docs` },
  description:
    'Use, self-host and build on Montara Mail, the AI mail client that runs your own model.',
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={sans.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
