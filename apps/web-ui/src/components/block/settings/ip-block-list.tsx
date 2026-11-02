import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Ban, Info, Plus } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import SectionHeading from '@/components/block/common/section-heading'
import { SettingsListCard, SettingsPage } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { IP_BLOCK_DURATIONS, IPBlockSchema } from '@/lib/api/dtos/settings/ip-block/schema'
import { queries } from '@/lib/api/queries'
import { timeAgo } from '@/lib/date'
import { cn } from '@/lib/utils'

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

/** "Manual · hello@montaramail.web.id", or what the server blamed: the source, then why. */
function blockSource(block: Models.IPBlock) {
  const auto = block.source === 'auto'
  const why = block.reason.trim() || (auto ? 'Repeated failures' : block.created_by_email)
  return `${auto ? 'Auto' : 'Manual'} · ${why || 'No reason given'}`
}

/** "Blocked 41 minutes ago · lifts in 19 minutes", the design's faint when line. */
function BlockMeta({ block }: { block: Models.IPBlock }) {
  return (
    <span className="text-ink-faint text-[10px] leading-[14px]">
      Blocked {timeAgo(new Date(block.created_at))}
      {' · '}
      {block.expires_at ? `lifts ${timeAgo(new Date(block.expires_at))}` : 'until removed'}
    </span>
  )
}

function BlockRow({ block }: { block: Models.IPBlock }) {
  const [confirming, setConfirming] = React.useState(false)
  const remove = useMutation(queries.ipBlocks.delete())
  const auto = block.source === 'auto'

  return (
    <li className="bg-muted hover:bg-popover hover:border-input flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border border-transparent px-2.5 py-[9px] transition-colors duration-150 motion-reduce:transition-none">
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-[8px]',
          auto ? 'bg-warning/12 text-warning-ink' : 'bg-destructive/12 text-danger-ink'
        )}
      >
        <Ban className="size-[13px]" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="flex min-w-0 flex-wrap items-center gap-x-[7px] gap-y-1">
          <span className="min-w-0 font-mono text-[11.5px] leading-4 font-semibold wrap-anywhere">
            {block.network}
          </span>
          <span
            className={cn(
              'rounded-[4px] px-[5px] py-px font-mono text-[8.5px] leading-3 font-semibold tracking-[0.4px] uppercase',
              auto ? 'bg-warning/12 text-warning-ink' : 'bg-destructive/12 text-danger-ink'
            )}
          >
            {block.source}
          </span>
        </span>
        <span className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">
          {blockSource(block)}
        </span>
        <BlockMeta block={block} />
      </span>
      <Button
        variant="outline"
        className="bg-muted border-border h-7 shrink-0 px-2.5 text-[10.5px] font-semibold shadow-none pointer-coarse:h-11"
        aria-label={`Unblock ${block.network}`}
        disabled={remove.isPending}
        onClick={() => setConfirming(true)}
      >
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
    <div className="grid gap-0.5">
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-[11px] px-2.5 py-[9px]">
          <Skeleton className="size-7 rounded-[8px]" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-56" />
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
    <SettingsPage>
      <SectionHeading
        title="IP Block"
        description={
          auto
            ? `Blocked addresses can't reach the app or the API. The server also blocks an address for ${auto.block_minutes} minutes after ${auto.failed_sign_ins} failed sign-ins or ${auto.rate_limit_hits} rate-limit hits within ${auto.window_minutes} minutes.`
            : "Blocked addresses can't reach the app or the API."
        }
      />

      <SettingsListCard
        icon={Ban}
        title="Blocked addresses"
        description="Addresses and ranges that cannot reach your mail"
        action={
          <Button
            variant="outline"
            className="bg-muted border-border h-7 gap-1.5 px-[11px] text-[11px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-[11px]"
            onClick={() => setBlocking(true)}
          >
            <Plus />
            Block address
          </Button>
        }
        footer={
          <>
            <p className="text-ink-3 flex items-start gap-[5px] text-[10.5px] leading-[14px]">
              <Info className="mt-px size-[11px] shrink-0" aria-hidden />
              Auto-blocks lift on their own · manual blocks stay until you remove them
            </p>
            <Link
              to="/settings/security"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 pointer-coarse:h-11 inline-flex items-center gap-1 rounded-[5px] text-[10.5px] leading-[14px] font-semibold transition-colors duration-150 outline-none focus-visible:ring-[3px] motion-reduce:transition-none"
            >
              Block log
              <ArrowUpRight className="size-[11px]" aria-hidden />
            </Link>
          </>
        }
      >
        <QueryState
          isPending={isPending}
          isError={isError}
          error={error}
          onRetry={() => refetch()}
          isEmpty={blocks.length === 0}
          loading={<Loading />}
          empty={
            <div className="grid justify-items-center gap-2 py-6 text-center">
              <span className="bg-muted grid size-9 place-items-center rounded-[10px]">
                <Ban className="text-ink-3 size-4" aria-hidden />
              </span>
              <p className="text-[12.5px] leading-[17px] font-semibold">No blocked addresses</p>
              <p className="text-ink-3 text-[11px] leading-[15px]">
                Addresses you block, and the ones the server blocks on its own, show here.
              </p>
            </div>
          }
        >
          <ul className="grid gap-0.5">
            {blocks.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </ul>
        </QueryState>
      </SettingsListCard>

      {blocking && (
        <BlockDialog yourIP={data?.metadata.your_ip} onClose={() => setBlocking(false)} />
      )}
    </SettingsPage>
  )
}
