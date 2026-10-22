import type { Metadata } from 'next'

import { Toaster } from '@/components/ui/sonner'
import DecorationProvider from '@/lib/providers/decoration'
import ReactQueryProvider from '@/lib/providers/react-query'

import './globals.css'

export const metadata: Metadata = {
  title: 'Main Web',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes sets the theme class before hydration.
    <html lang="en" suppressHydrationWarning>
      <body>
        <ReactQueryProvider>
          <DecorationProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </DecorationProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
