import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ChevronLeft, ExternalLink, Printer } from 'lucide-react'
import React from 'react'

import type { TokenTopup } from '@/lib/api/models/quota'

import QueryState from '@/components/block/common/query-state'
import TopupStatusBadge from '@/components/block/settings/billing/topup-status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The invoice number the page shows: MTR-YYYYMMDD-xxxxxxxx. */
function invoiceNumber(topup: TokenTopup) {
  const day = new Date(topup.created_at).toISOString().slice(0, 10).replaceAll('-', '')
  // The tail: a UUIDv7 starts with its timestamp, so the head repeats for a minute.
  return `MTR-${day}-${topup.id.slice(-8)}`
}

const statusNote: Record<TokenTopup['status'], string> = {
  paid: 'Paid through BorderPay’s QRIS checkout. Thank you.',
  pending: 'Not paid yet: finish the payment at the BorderPay checkout.',
  expired: 'This top-up expired before it was paid. Start a new one from Billing.',
  failed: 'This payment failed. Start a new top-up from Billing.',
}

/** One billing row, or a friendly note when the top-up doesn't belong here. */
function Invoice({ topup, email, name }: { topup: TokenTopup; email: string; name: string }) {
  const amount = formatRupiah(topup.amount_idr)
  const paid = topup.status === 'paid'

  return (
    <article className="bg-card mx-auto w-full max-w-3xl rounded-xl border shadow-sm print:border-0 print:bg-transparent print:shadow-none">
      <div className="grid gap-8 p-8 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-0.5 text-sm">
            <p className="font-display text-2xl font-semibold tracking-tight">
              Montara Mail<span className="text-accent-ink">.</span>
            </p>
            <p className="text-muted-foreground">app.montaramail.web.id</p>
            <p className="text-muted-foreground">hello@montaramail.web.id</p>
          </div>
          <div className="grid justify-items-start gap-0.5 text-sm sm:justify-items-end">
            <p className="font-display text-2xl font-semibold tracking-tight">INVOICE</p>
            <p className="text-muted-foreground">No. {invoiceNumber(topup)}</p>
            <p className="text-muted-foreground">
              Date{' '}
              {new Date(topup.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <TopupStatusBadge status={topup.status} />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-1">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Billed to
            </p>
            <p className="truncate">{name || email}</p>
            <p className="text-muted-foreground truncate text-sm">{email}</p>
          </div>
          <div className="grid justify-items-start gap-1 sm:justify-items-end">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Payment method
            </p>
            <p>BorderPay QRIS</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-muted-foreground py-2 text-left text-xs font-medium tracking-widest uppercase">
                Description
              </th>
              <th className="text-muted-foreground py-2 text-right text-xs font-medium tracking-widest uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3 pr-4">
                {formatTokens(topup.tokens)} token top-up (pay as you go)
              </td>
              <td className="py-3 text-right tabular-nums">{amount}</td>
            </tr>
          </tbody>
        </table>

        <div className="ml-auto w-full max-w-60 text-sm">
          <div className="flex items-center justify-between border-b py-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{amount}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-medium">Total</span>
            <span className={cn('font-medium tabular-nums', paid && 'text-accent-ink')}>
              {amount}
            </span>
          </div>
        </div>

        <div className="text-muted-foreground border-t pt-4 text-xs leading-5">
          {statusNote[topup.status]} This invoice is valid without a signature. Questions:
          hello@montaramail.web.id.
        </div>
      </div>
    </article>
  )
}

/** The invoice for one top-up, laid out to print as a single page. */
function InvoicePage() {
  const { id } = Route.useParams()
  const { data: me } = useQuery(queries.auth.profile())
  const { data: topup, isPending, isError, error, refetch } = useQuery(queries.quota.topup(id))
  const notFound = isAxiosError(error) && error.response?.status === 404
  const payUrl = topup?.status === 'pending' ? topup.pay_url : ''

  // The shell steps aside while this page prints (see styles.css).
  React.useEffect(() => {
    document.body.dataset.print = 'invoice'
    return () => {
      delete document.body.dataset.print
    }
  }, [])

  const print = () => window.print()

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings/billing">
            <ChevronLeft aria-hidden />
            Back to billing
          </Link>
        </Button>
        {topup && (
          <div className="flex flex-wrap gap-2">
            <Button variant={payUrl ? 'outline' : 'primary'} onClick={print}>
              <Printer aria-hidden />
              Print / Save as PDF
            </Button>
            {payUrl && (
              <Button asChild>
                <a href={payUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Finish payment
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
      <QueryState
        isPending={isPending}
        isError={isError && !notFound && !topup}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={!topup}
        loading={<Skeleton className="mx-auto h-96 max-w-3xl" />}
        empty={
          <div className="bg-card mx-auto grid max-w-3xl gap-2 rounded-xl border p-8 text-sm">
            <p className="font-medium">Invoice not found</p>
            <p className="text-muted-foreground">
              This invoice doesn't exist or belongs to another account.
            </p>
          </div>
        }
      >
        {topup && (
          <Invoice topup={topup} email={me?.user?.email ?? ''} name={me?.user?.name ?? ''} />
        )}
      </QueryState>
    </div>
  )
}

export const Route = createFileRoute('/(app)/settings/billing_/invoice/$id')({
  // The Community Edition takes no payments, so it has no invoices.
  beforeLoad: () => {
    if (COMMUNITY) throw redirect({ to: '/settings/profile', replace: true })
  },
  component: COMMUNITY ? () => null : InvoicePage,
})
