import { createFileRoute } from '@tanstack/react-router'

import LoginForm from '@/components/block/auth/login-form'
import { redirectIfAuthenticated } from '@/lib/auth/handler'

export const Route = createFileRoute('/sign-in/')({
  beforeLoad: () => redirectIfAuthenticated('/dashboard'),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
