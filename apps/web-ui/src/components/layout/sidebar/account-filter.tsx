import { Link, useSearch } from '@tanstack/react-router'
import { Check, ChevronDown, Layers } from 'lucide-react'
import React from 'react'

import { ProviderIcon } from '@/components/block/account/connector-list'
import { useMailAccounts } from '@/components/layout/mail/mail-panel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { cn } from '@/lib/utils'

/**
 * The topbar's account filter: all the organization's accounts, or one of
 * them. Picking one opens /mail?account=… (from /mail it rewrites that
 * account there), and All accounts clears the filter.
 */
export default function AccountFilter({ className }: { className?: string }) {
  const { data: accounts, isPending } = useMailAccounts()
  const { account } = useSearch({ strict: false })
  const { mask } = useHideEmails()
  const [open, setOpen] = React.useState(false)

  const selected = accounts?.find((item) => item.id === account)

  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by email account"
          className={cn(
            'border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 flex h-8 max-w-56 items-center gap-1.5 rounded-control border px-2.5 text-xs outline-none focus-visible:ring-[3px]',
            className
          )}
        >
          <Layers className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{selected ? mask(selected.label) : 'All accounts'}</span>
          {!selected && !isPending && (
            <span className="text-ink-3 tabular-nums">({accounts?.length ?? 0})</span>
          )}
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="rounded-control w-60 p-1 text-sm"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {/* All accounts clears the ?account= filter. */}
        <Link
          to="/mail"
          search={{}}
          onClick={close}
          className="hover:bg-accent flex items-center gap-2 rounded-control px-2 py-1.5 outline-none"
        >
          <Layers className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="flex-1">All accounts</span>
          {!selected && <Check className="size-4" />}
        </Link>
        {accounts?.map((item) => (
          <Link
            key={item.id}
            to="/mail"
            search={{ account: item.id }}
            onClick={close}
            className="hover:bg-accent flex items-center gap-2 rounded-control px-2 py-1.5 outline-none"
          >
            <ProviderIcon provider={item.provider} className="size-6 shrink-0 rounded-sm" />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate">{mask(item.label)}</span>
              <span className="text-muted-foreground truncate text-xs">{mask(item.email)}</span>
            </span>
            {item.id === selected?.id && <Check className="size-4" />}
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  )
}
