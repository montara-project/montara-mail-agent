import { useMutation, useQuery } from '@tanstack/react-query'

import SectionCard from '@/components/block/common/section-card'
import { FieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** Saved on the account: the same inbox on every device. Off, the default, is the global inbox. */
function InboxSettings() {
  const { data: me, isPending } = useQuery(queries.auth.profile())
  const update = useMutation(queries.profile.updatePreferences())
  // The saved value, or the one on its way: a failed save falls back by itself.
  const checked = update.isPending
    ? update.variables.split_inbox
    : me?.user?.metadata?.split_inbox === true

  return (
    <SectionCard title="Inbox" description="How your connected accounts show up in Mail.">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1 text-sm">
          <Label htmlFor="split-inbox">Split inbox</Label>
          <FieldDescription>
            See one account at a time with a switcher, instead of all your mail together.
          </FieldDescription>
        </div>
        <Switch
          id="split-inbox"
          checked={checked}
          disabled={isPending || update.isPending}
          onCheckedChange={(on) => update.mutate({ split_inbox: on }, { onError: toastAxiosError })}
        />
      </div>
    </SectionCard>
  )
}

/** Per browser: masks email addresses on screen, for screen sharing and demos. */
function PrivacySettings() {
  const { hidden, setHidden } = useHideEmails()

  return (
    <SectionCard title="Privacy" description="What this browser shows on screen.">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1 text-sm">
          <Label htmlFor="hide-emails">Hide email addresses</Label>
          <FieldDescription>
            Masks your addresses in the sidebar, the account switcher and your mail list, so they
            stay private when you share your screen.
          </FieldDescription>
        </div>
        <Switch id="hide-emails" checked={hidden} onCheckedChange={setHidden} />
      </div>
    </SectionCard>
  )
}

export default function MailSettings() {
  return (
    <div className="grid gap-4">
      <InboxSettings />
      <PrivacySettings />
    </div>
  )
}
