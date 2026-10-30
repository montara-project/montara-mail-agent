import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import LoginForm from '@/components/block/auth/login-form'
import { completeGoogleSignIn } from '@/lib/auth/google-auth'
import { redirectIfAuthenticated } from '@/lib/auth/handler'

export const Route = createFileRoute('/sign-in/')({
  // via=google is the address Google's callback returns the browser to (see
  // google-auth.ts): the sign-in page then trades the fresh session cookie
  // for a token pair.
  validateSearch: (search: Record<string, unknown>): { via?: string } => ({
    via: typeof search.via === 'string' ? search.via : undefined,
  }),
  beforeLoad: () => redirectIfAuthenticated('/dashboard'),
  component: RouteComponent,
})

function RouteComponent() {
  const { via } = Route.useSearch()
  const router = useRouter()
  const [exchanging, setExchanging] = useState(false)
  // Once per visit: a failed exchange is not retried on every render.
  const attempted = useRef(false)

  useEffect(() => {
    if (via !== 'google' || attempted.current) return
    attempted.current = true
    setExchanging(true)

    completeGoogleSignIn()
      .then(async () => {
        await router.invalidate()
        await router.navigate({ to: '/dashboard', replace: true })
      })
      .catch(() => {
        // The consent was abandoned, or the callback's session cookie stayed
        // on the API's origin; the cause isn't knowable here.
        toast.error("Google sign-in didn't finish. Try again, or log in with your email.")
      })
      .finally(() => setExchanging(false))
  }, [via, router])

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        {exchanging ? (
          <div role="status" className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Finishing Google sign-in…</p>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  )
}
