import { useMutation, useQuery } from '@tanstack/react-query'
import { EyeOff, Inbox } from 'lucide-react'
import React from 'react'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

type ToggleRowProps = {
  id: string
  label: string
  description: string
  /** Not built yet: the switch stays off and disabled, and the row says Soon. */
  soon?: boolean
} & Pick<React.ComponentProps<typeof Switch>, 'checked' | 'disabled' | 'onCheckedChange'>

/** One setting. A live row toggles from anywhere on it: its label stretches over the row. */
function ToggleRow({ id, label, description, soon, disabled, ...props }: ToggleRowProps) {
  return (
    <div
      className={
        soon
          ? 'flex items-center gap-[11px] rounded-[9px] border border-transparent px-[9px] py-2'
          : 'hover:border-input hover:bg-popover relative flex items-center gap-[11px] rounded-[9px] border border-transparent px-[9px] py-2 transition-colors duration-150 motion-reduce:transition-none'
      }
    >
      <div className="grid min-w-0 flex-1 gap-px">
        <Label
          htmlFor={id}
          className={
            soon
              ? 'text-[12px] leading-4 font-semibold'
              : 'cursor-pointer text-[12px] leading-4 font-semibold after:absolute after:inset-0'
          }
        >
          {label}
        </Label>
        <p id={`${id}-description`} className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">
          {description}
        </p>
      </div>
      {soon && (
        <Badge variant="secondary" appearance="light" size="sm" className="shrink-0">
          Soon
        </Badge>
      )}
      <Switch
        id={id}
        size="sm"
        aria-describedby={`${id}-description`}
        disabled={soon || disabled}
        className="z-10 w-9"
        thumbClassName="w-4 data-[state=checked]:translate-x-[18px] rtl:data-[state=checked]:-translate-x-[18px]"
        {...props}
      />
    </div>
  )
}

/** Saved on the account: the same inbox on every device. Off, the default, is the global inbox. */
function SplitInboxRow() {
  const { data: me, isPending } = useQuery(queries.auth.profile())
  const update = useMutation(queries.profile.updatePreferences())
  // The saved value, or the one on its way: a failed save falls back by itself.
  const checked = update.isPending
    ? update.variables.split_inbox
    : me?.user?.metadata?.split_inbox === true

  return (
    <ToggleRow
      id="split-inbox"
      label="Split inbox"
      description="See one account at a time with a switcher, instead of all your mail together."
      checked={checked}
      disabled={isPending || update.isPending}
      onCheckedChange={(on) => update.mutate({ split_inbox: on }, { onError: toastAxiosError })}
    />
  )
}

/** Per browser: masks email addresses on screen, for screen sharing and demos. */
function HideEmailsRow() {
  const { hidden, setHidden } = useHideEmails()

  return (
    <ToggleRow
      id="hide-emails"
      label="Hide email addresses"
      description="Masks your addresses in the sidebar, the account switcher and your mail list, so they stay private when you share your screen."
      checked={hidden}
      onCheckedChange={setHidden}
    />
  )
}

export default function MailSettings() {
  return (
    <SettingsPage>
      <SectionHeading
        title="Mail"
        description="Inbox layout and what this browser shows on screen."
      />
      <div className="grid gap-5">
        <SettingsCard
          icon={Inbox}
          tone="info"
          title="Inbox"
          description="How your connected accounts show up in Mail."
        >
          <SplitInboxRow />
          <ToggleRow
            soon
            id="conversation-view"
            label="Conversation view"
            description="Group replies into a single thread instead of separate messages."
          />
        </SettingsCard>
        <SettingsCard
          icon={EyeOff}
          tone="info"
          title="Privacy"
          description="What this browser shows on screen."
        >
          <HideEmailsRow />
          <ToggleRow
            soon
            id="blur-previews"
            label="Blur message previews"
            description="Previews stay blurred until you hover or focus the row."
          />
          <ToggleRow
            soon
            id="hide-notifications"
            label="Hide notification popups"
            description="No desktop notifications while this browser is focused."
          />
        </SettingsCard>
      </div>
    </SettingsPage>
  )
}
