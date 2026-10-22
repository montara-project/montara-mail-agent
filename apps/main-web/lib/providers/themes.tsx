'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import React from 'react'

/**
 * Theme provider (light / dark / system)
 * @param params
 * @returns
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      storageKey="vine-theme"
      defaultTheme="dark"
      attribute="class"
      disableTransitionOnChange
      enableColorScheme
      enableSystem
    >
      {children}
    </NextThemesProvider>
  )
}
