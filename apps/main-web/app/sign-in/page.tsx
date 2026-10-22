import LoginForm from '@/components/block/auth/login-form'
import { redirectIfAuthenticated } from '@/lib/auth/handler'

export default async function SignInPage() {
  await redirectIfAuthenticated('/dashboard')

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
