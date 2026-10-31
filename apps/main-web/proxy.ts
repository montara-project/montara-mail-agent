import { type NextRequest, NextResponse } from 'next/server'

import { SITE_URL } from '@/lib/seo'

/**
 * Sends plain HTTP to HTTPS. Cloudflare reports the visitor's scheme in this
 * header; without it nothing redirects, so a change there can't cause a loop.
 */
export function proxy(request: NextRequest) {
  if (request.headers.get('x-forwarded-proto') !== 'http') return NextResponse.next()
  const { pathname, search } = new URL(request.url)
  return NextResponse.redirect(`${SITE_URL}${pathname}${search}`, 308)
}
