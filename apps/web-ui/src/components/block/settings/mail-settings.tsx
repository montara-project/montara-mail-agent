import { useMutation, useQuery } from '@tanstack/react-query'

import SectionCard from '@/components/block/common/section-card'
import { FieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** Saved on the account: the same inbox on every device. Off, the default, is the global inbox. */
export default function MailSettings() {
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
