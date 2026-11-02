import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trash2, TriangleAlert } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { clearAuthTokens } from '@/lib/auth/token-storage'
import { getQueryClient } from '@/lib/providers/react-query'

/** What the deletion takes with it, said before anything is typed. */
function PermanentNotice() {
  return (
    <div className="border-destructive/20 bg-destructive/4 flex items-start gap-3.5 rounded-lg border p-[18px]">
      <span className="bg-destructive/12 text-danger-soft grid size-[34px] shrink-0 place-items-center rounded-[9px]">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h2 className="text-danger-soft text-[13px] leading-[18px] font-bold">
          This action is permanent
        </h2>
        <p className="text-muted-foreground text-[11.5px] leading-4 text-pretty">
          Deleting your account removes all mailboxes, messages, API keys, agent bots and billing
          history. Domains and mail delivered elsewhere stay untouched.
        </p>
      </div>
    </div>
  )
}

/**
 * The account's own deletion. The button stays disabled until the typed
 * address is the account's, so a stray click cannot finish it. The account's
 * sessions end with it, so the app signs out on success.
 */
export default function DeleteAccountSettings() {
  const navigate = useNavigate()
  const remove = useMutation(queries.profile.deleteAccount())
  const { data: me } = useQuery(queries.auth.profile())
  const [email, setEmail] = React.useState('')

  const account = me?.user?.email ?? ''
  const typed = email.trim()
  const confirmed = typed !== '' && typed.toLowerCase() === account.toLowerCase()
  // A disabled button with no reason reads as broken; the input says why.
  const mismatch = typed !== '' && !confirmed

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!confirmed) return

    try {
      await remove.mutateAsync(typed)
    } catch (error) {
      toastAxiosError(error)
      return
    }
    // The account's sessions ended with it, this one included.
    clearAuthTokens()
    getQueryClient().clear()
    toast.success('Your account and its data are deleted')
    await navigate({ to: '/sign-in', replace: true })
  }

  return (
    <SettingsPage>
      <SectionHeading
        title="Delete account"
        description="Permanently remove your account and all of its data. This can't be undone."
      />
      <div className="grid gap-[20px]">
        <PermanentNotice />

        <SettingsCard
          dense
          title="Confirm deletion"
          description="Type your account email to enable the button."
        >
          <form className="grid gap-3" onSubmit={submit}>
            <div className="grid gap-1.5">
              <Label
                htmlFor="confirm-account-email"
                className="text-[11.5px] leading-4 font-semibold"
              >
                Account email
              </Label>
              <Input
                id="confirm-account-email"
                name="email"
                type="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={account || 'you@example.com'}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={mismatch}
                aria-describedby="confirm-account-email-hint"
                className="border-border placeholder:text-ink-3 h-[38px] text-[12.5px] focus-visible:border-ring"
              />
              {/* The card's description already says how to enable the button. */}
              <span id="confirm-account-email-hint" className="sr-only">
                Type the email you signed up with to enable the delete button.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-muted-foreground h-8 rounded-[8px]! px-3.5 text-[11.5px] font-semibold pointer-coarse:h-11"
                onClick={() => navigate({ to: '/settings' })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!confirmed || remove.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 gap-1.5 rounded-[8px]! border-transparent px-3.5 text-[11.5px] font-semibold pointer-coarse:h-11 [&_svg]:size-3"
              >
                <Trash2 />
                {remove.isPending ? 'Deleting…' : 'Delete account'}
              </Button>
            </div>
          </form>
        </SettingsCard>
      </div>
    </SettingsPage>
  )
}
