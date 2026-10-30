import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'

import SearchDialog from '@/components/search'
import { appName } from '@/lib/shared'
import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${appName} Docs` },
      {
        name: 'description',
        content:
          'Use, self-host and build on Montara Mail, the AI mail client that runs your own model.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon/favicon.ico', sizes: 'any' },
      { rel: 'icon', href: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'icon', href: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png' },
    ],
    // Cookieless visit counts; public/_headers allows the host in script-src and connect-src.
    scripts: [
      {
        src: 'https://analytics.masb0ymas.com/script.js',
        defer: true,
        'data-website-id': '61904e18-06cf-450c-8b22-2ca9e6d0c111',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}
