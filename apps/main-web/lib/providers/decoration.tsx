'use client'

import { NuqsAdapter } from 'nuqs/adapters/next/app'

import ThemeProvider from './themes'

export default function DecorationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider>{children}</ThemeProvider>
    </NuqsAdapter>
  )
}
