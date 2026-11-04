import { useMutation, useQuery } from '@tanstack/react-query'
import { Fingerprint, Plus, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import { SettingsCard } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { passkeyCancelled, passkeysSupported } from '@/lib/auth/passkey'
import { timeAgo } from '@/lib/date'
import { describeUserAgent } from '@/lib/user-agent'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function PasskeyRow({ passkey }: { passkey: Models.Passkey }) {
  const [confirming, setConfirming] = React.useState(false)
  const remove = useMutation(queries.passkeys.delete())

  return (
    <li className="flex flex-wrap items-center gap-3 px-[1.125rem] py-3">
      <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-[0.5rem]">
        <Fingerprint className="text-muted-foreground size-[0.8125rem]" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[0.84375rem] leading-[1.0625rem] font-semibold wrap-anywhere">
          {passkey.name}
        </span>
        <span className="text-ink-3 text-[0.71875rem] leading-[0.875rem]">
          Added {day(passkey.created_at)}
          {' · '}
          {passkey.last_used_at ? `Used ${timeAgo(new Date(passkey.last_used_at))}` : 'Never used'}
        </span>
      </span>
      <Button
        variant="destructive"
        mode="icon"
        size="sm"
        aria-label={`Remove ${passkey.name}`}
        disabled={remove.isPending}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>

      <SimpleAlertDialog
        title={`Remove ${passkey.name}?`}
        description="It stops signing you in at once. Remove it from the device's password manager too."
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() =>
          remove.mutate(passkey.id, {
            onSuccess: () => {
              toast.success(`${passkey.name} removed`)
              setConfirming(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Remove"
        variant="destructive"
      />
    </li>
  )
}

/** Names the passkey, then hands over to the browser's passkey sheet. */
function AddPasskeyDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = React.useState(() => describeUserAgent(navigator.userAgent).name)
  const create = useMutation(queries.passkeys.create())

  return (
    <SimpleAlertScrollableDialogForm
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate(name.trim(), {
          onSuccess: (passkey) => {
            toast.success(`${passkey.name} added`)
            onClose()
          },
          onError: (error) => {
            if (!passkeyCancelled(error)) toastAxiosError(error)
          },
        })
      }}
      title="Add a passkey"
      description="Your device asks for your fingerprint, face or screen lock, and keeps the key."
      confirmText="Continue"
      loading={create.isPending}
      disabled={!name.trim()}
      size="md"
    >
      <Field className="gap-1.5">
        <FieldLabel htmlFor="passkey-name">Name</FieldLabel>
        <Input
          id="passkey-name"
          value={name}
          maxLength={64}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <FieldDescription>So you can tell your passkeys apart.</FieldDescription>
      </Field>
    </SimpleAlertScrollableDialogForm>
  )
}

function Loading() {
  return (
    <div className="grid gap-1.5 py-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-64" />
    </div>
  )
}

/**
 * The user's passkeys: sign-in with the device's fingerprint, face or screen
 * lock instead of a password, and no two-factor code.
 */
export default function PasskeyList() {
  const [adding, setAdding] = React.useState(false)
  const supported = passkeysSupported()
  const {
    data: passkeys = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(queries.passkeys.list())

  return (
    <SettingsCard
      icon={Fingerprint}
      tone="success"
      body="form"
      title="Passkeys"
      description="Sign in with your fingerprint, face or screen lock. No password or code needed."
      action={
        <Button
          variant="outline"
          className="bg-muted h-7.5 gap-1.5 px-3 text-[0.78125rem] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
          disabled={!supported}
          title={supported ? undefined : "This browser can't make passkeys"}
          onClick={() => setAdding(true)}
        >
          <Plus />
          Add passkey
        </Button>
      }
    >
      <QueryState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={passkeys.length === 0}
        loading={<Loading />}
        empty={
          <p className="text-ink-3 py-6 text-center text-[0.75rem] leading-[0.9375rem]">
            {supported
              ? 'No passkeys yet. Add one to sign in without a password.'
              : "This browser can't make passkeys. Try a current Chrome, Safari, Edge or Firefox."}
          </p>
        }
      >
        <ul className="divide-border/60 -m-[1.125rem] divide-y overflow-hidden rounded-b-lg">
          {passkeys.map((passkey) => (
            <PasskeyRow key={passkey.id} passkey={passkey} />
          ))}
        </ul>
      </QueryState>

      {adding && <AddPasskeyDialog onClose={() => setAdding(false)} />}
    </SettingsCard>
  )
}
