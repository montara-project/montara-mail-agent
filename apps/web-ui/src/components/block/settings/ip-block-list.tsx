import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw, ShieldBan, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { IP_BLOCK_DURATIONS, IPBlockSchema } from '@/lib/api/dtos/settings/ip-block/schema'
import { queries } from '@/lib/api/queries'
import { timeAgo } from '@/lib/date'

const DURATION_OPTIONS = IP_BLOCK_DURATIONS.map((hours) => ({
  value: hours,
  label: {
    '1': '1 hour',
    '24': '24 hours',
    '168': '7 days',
    '720': '30 days',
    '0': 'Until removed',
  }[hours],
}))

const ago = (iso: string) => timeAgo(new Date(iso))

/** "Blocked 3 minutes ago by you@… · Lifts in about 1 hour". */
function BlockMeta({ block }: { block: Models.IPBlock }) {
  return (
    <span className="text-muted-foreground text-xs">
      Blocked {ago(block.created_at)}
      {block.created_by_email && ` by ${block.created_by_email}`}
      {' · '}
      {block.expires_at ? `Lifts ${ago(block.expires_at)}` : 'Until removed'}
    </span>
  )
}

function BlockRow({ block }: { block: Models.IPBlock }) {
  const [confirming, setConfirming] = React.useState(false)
  const remove = useMutation(queries.ipBlocks.delete())

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ShieldBan className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm">{block.network}</span>
          <Badge
            variant={block.source === 'auto' ? 'warning' : 'secondary'}
            appearance="light"
            size="sm"
          >
            {block.source === 'auto' ? 'Automatic' : 'Manual'}
          </Badge>
        </span>
        {block.reason && <span className="text-sm text-pretty">{block.reason}</span>}
        <BlockMeta block={block} />
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={remove.isPending}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
        Unblock
      </Button>

      <SimpleAlertDialog
        title={`Unblock ${block.network}?`}
        description="Requests from it reach the app and the API again, and its count of failures starts over."
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() =>
          remove.mutate(block.id, {
            onSuccess: () => {
              toast.success(`${block.network} unblocked`)
              setConfirming(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Unblock"
      />
    </li>
  )
}

function BlockDialog({ yourIP, onClose }: { yourIP?: string; onClose: () => void }) {
  const create = useMutation(queries.ipBlocks.create())
  const form = useAppForm({
    defaultValues: {
      address: '',
      reason: '',
      expires_in_hours: '24' as (typeof IP_BLOCK_DURATIONS)[number],
    },
    validators: { onSubmit: IPBlockSchema, onChange: IPBlockSchema },
    onSubmit: async ({ value }) => {
      const dto = parseDto(IPBlockSchema, value)
      try {
        const block = await create.mutateAsync({
          address: dto.address.trim(),
          reason: dto.reason.trim(),
          expires_in_hours: Number(dto.expires_in_hours),
        })
        toast.success(`${block.network} blocked`)
        onClose()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      title="Block an address"
      description="Requests from it are refused everywhere: sign-in, the app, the API and /mcp."
      confirmText="Block"
      loading={create.isPending}
      size="md"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <form.AppField
            name="address"
            children={(field) => (
              <field.TextField
                asterisk
                label="IP address or range"
                placeholder="203.0.113.7 or 203.0.113.0/24"
              />
            )}
          />
          <FieldDescription>
            A range can be as wide as /8 (IPv4) or /32 (IPv6).
            {yourIP && ` Your own address, ${yourIP}, can't be blocked from here.`}
          </FieldDescription>
        </div>
        <form.AppField
          name="reason"
          children={(field) => (
            <field.TextField label="Reason" placeholder="Scraping the sign-in page" />
          )}
        />
        <form.AppField
          name="expires_in_hours"
          children={(field) => <field.SelectField label="Block for" options={DURATION_OPTIONS} />}
        />
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** Shaped like the rows it stands in for. */
function Loading() {
  return (
    <div className="grid gap-5 py-3">
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The addresses the whole server refuses: blocked here by a super user, or by
 * the server itself after repeated failed sign-ins or rate-limit hits.
 */
export default function IPBlockList() {
  const [blocking, setBlocking] = React.useState(false)
  const { data, isPending, isError, error, refetch } = useQuery(queries.ipBlocks.list())
  const blocks = data?.data ?? []
  const auto = data?.metadata.auto

  return (
    <section className="grid gap-3">
      <SectionHeading
        title="IP Block"
        description={
          auto
            ? `Blocked addresses can't reach the app or the API. The server also blocks an address for ${auto.block_minutes} minutes after ${auto.failed_sign_ins} failed sign-ins or ${auto.rate_limit_hits} rate-limit hits within ${auto.window_minutes} minutes.`
            : "Blocked addresses can't reach the app or the API."
        }
        action={
          <Button className="h-8.5 rounded-lg" onClick={() => setBlocking(true)}>
            <Plus />
            <span>Block address</span>
          </Button>
        }
      />

      <SectionCard>
        {isPending ? (
          <Loading />
        ) : isError ? (
          <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
            <p className="text-destructive">{axiosErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : blocks.length === 0 ? (
          <EmptyState
            title="No blocked addresses"
            description="Addresses you block, and the ones the server blocks on its own, show here."
          />
        ) : (
          <ul className="-m-4 divide-y overflow-hidden rounded-lg">
            {blocks.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </ul>
        )}
      </SectionCard>

      {blocking && (
        <BlockDialog yourIP={data?.metadata.your_ip} onClose={() => setBlocking(false)} />
      )}
    </section>
  )
}
