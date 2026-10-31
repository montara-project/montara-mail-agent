import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah } from '@/lib/string'

import TopupStatusBadge from './topup-status-badge'

/** The smallest top-up; the amount is otherwise free-form rupiah. */
const MIN_TOPUP_IDR = 10_000

/** Control Center > Billing: the IDR wallet a subscription renews from. */
export default function WalletCard() {
  const walletQuery = useQuery(queries.billing.wallet())
  const topupsQuery = useQuery(queries.billing.walletTopups({ offset: 0, limit: 5 }))
  const topup = useMutation(queries.billing.walletTopup())
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [checkout, setCheckout] = React.useState<Models.WalletTopup | null>(null)

  const payLink = React.useRef<HTMLAnchorElement>(null)

  const topups = topupsQuery.data?.data
  const value = Number(amount)
  const valid = Number.isInteger(value) && value >= MIN_TOPUP_IDR

  const start = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || topup.isPending) return
    topup.mutate(
      { amount_idr: value },
      {
        onError: toastAxiosError,
        onSuccess: (t) => {
          setCheckout(t)
          setOpen(false)
          setAmount('')
        },
      }
    )
  }

  const closeCheckout = () => {
    setCheckout(null)
    void walletQuery.refetch()
    void topupsQuery.refetch()
  }

  return (
    <>
      <SectionCard
        title="Wallet"
        description="The balance a subscription renews from automatically at period end."
        toolbar={
          <Button size="sm" onClick={() => setOpen(true)}>
            Top up wallet
          </Button>
        }
      >
        <QueryState
          isPending={walletQuery.isPending}
          isError={walletQuery.isError && !walletQuery.data}
          error={walletQuery.error}
          onRetry={() => void walletQuery.refetch()}
          isEmpty={false}
          loading={<Skeleton className="h-5 w-full" />}
          empty={null}
        >
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-medium tabular-nums">
              {formatRupiah(walletQuery.data?.balance_idr ?? 0)}
            </span>
          </div>
        </QueryState>

        <div className="mt-4 empty:hidden">
          <QueryState
            isPending={topupsQuery.isPending}
            isError={topupsQuery.isError && !topups}
            error={topupsQuery.error}
            onRetry={() => void topupsQuery.refetch()}
            isEmpty={!topups?.length}
            loading={null}
            empty={null}
          >
            <div className="grid gap-1">
              <p className="text-muted-foreground text-xs font-medium">Recent wallet top-ups</p>
              <ul className="-mx-2 grid">
                {topups?.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-2 py-2 text-sm">
                    <span className="text-muted-foreground tabular-nums">
                      {monthDay(new Date(t.created_at), true)}
                    </span>
                    <span className="ms-auto tabular-nums">{formatRupiah(t.amount_idr)}</span>
                    {/* A pending top-up's status is its way back to the checkout. */}
                    {t.status === 'pending' && t.pay_url ? (
                      <Button variant="outline" size="xs" asChild>
                        <a href={t.pay_url} target="_blank" rel="noreferrer">
                          <ExternalLink aria-hidden />
                          Pay
                        </a>
                      </Button>
                    ) : (
                      <TopupStatusBadge status={t.status} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </QueryState>
        </div>
      </SectionCard>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setAmount('')
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <form onSubmit={start}>
            <div className="grid gap-4 p-6">
              <div className="grid gap-1.5 pe-8">
                <DialogTitle>Top up your wallet</DialogTitle>
                <DialogDescription>
                  Add rupiah to the balance your subscription renews from. The smallest top-up is
                  Rp10.000.
                </DialogDescription>
              </div>
              <Field>
                <FieldLabel htmlFor="wallet-topup-amount">Amount in rupiah</FieldLabel>
                <Input
                  id="wallet-topup-amount"
                  type="number"
                  inputMode="numeric"
                  min={MIN_TOPUP_IDR}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  className="tabular-nums"
                />
                <FieldDescription>You will be taken to BorderPay's QRIS checkout.</FieldDescription>
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={topup.isPending || !valid}>
                {topup.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Continue to payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkout} onOpenChange={(v) => !v && closeCheckout()}>
        {checkout && (
          <DialogContent
            className="gap-0 p-0 sm:max-w-md"
            // Radix skips links when it picks the first focus, which would land on Done.
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              payLink.current?.focus()
            }}
          >
            <div className="grid gap-5 p-6">
              <div className="grid gap-1.5 pe-8">
                <DialogTitle>Complete your top-up</DialogTitle>
                <DialogDescription>
                  Scan the QRIS or pay at the BorderPay checkout.
                </DialogDescription>
              </div>
              <dl className="divide-y border-y text-sm">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {formatRupiah(checkout.amount_idr)}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground text-xs leading-5">
                The balance is credited automatically once the payment lands, usually within
                seconds.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={closeCheckout}>
                Done
              </Button>
              <Button asChild>
                <a ref={payLink} href={checkout.pay_url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Open the payment page
                </a>
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
