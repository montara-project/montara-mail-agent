import { useMutation, useQuery } from '@tanstack/react-query'
import { LogOut, Monitor, Smartphone } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { PageNav, PageRange, usePaged } from '@/components/block/common/page-nav'
import QueryState from '@/components/block/common/query-state'
import { SettingsCard } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { timeAgo } from '@/lib/date'
import { describeUserAgent as describe } from '@/lib/user-agent'

const PAGE_SIZE = 10

function SessionRow({ session }: { session: Models.Session }) {
  const [confirming, setConfirming] = React.useState(false)
  const revoke = useMutation(queries.profile.revokeSession())
  const { name, mobile } = describe(session.user_agent)
  const Icon = mobile ? Smartphone : Monitor

  return (
    <li className="flex flex-wrap items-center gap-3 px-[1.125rem] py-3">
      <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-[0.5rem]">
        <Icon className="text-muted-foreground size-[0.8125rem]" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-[0.84375rem] leading-[1.0625rem] font-semibold">{name}</span>
          {session.current && (
            <Badge variant="success" appearance="light" size="sm">
              This device
            </Badge>
          )}
        </span>
        <span className="text-ink-3 text-[0.71875rem] leading-[0.875rem]">
          {session.ip_address || 'Unknown IP'}
          {' · '}
          Signed in {timeAgo(new Date(session.created_at))}
        </span>
      </span>
      {/* The sidebar's sign-out ends this one. */}
      {!session.current && (
        <Button
          variant="destructive"
          mode="icon"
          size="sm"
          aria-label={`Sign out ${name}`}
          disabled={revoke.isPending}
          onClick={() => setConfirming(true)}
        >
          <LogOut />
        </Button>
      )}

      <SimpleAlertDialog
        title={`Sign out ${name}?`}
        description="That device loses access at once and has to sign in again."
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() =>
          revoke.mutate(session.id, {
            onSuccess: () => {
              toast.success(`${name} signed out`)
              setConfirming(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Sign out"
        variant="destructive"
      />
    </li>
  )
}

function Loading() {
  return (
    <div className="grid gap-5 py-3">
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Where the user is signed in, each one revocable, or all but this one at once. */
export default function SessionList() {
  const [confirming, setConfirming] = React.useState(false)
  const {
    data: sessions = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(queries.profile.sessions())
  const revokeOthers = useMutation(queries.profile.revokeOtherSessions())
  const others = sessions.filter((session) => !session.current).length
  const { page, setPage, pageCount, first, pageItems } = usePaged(sessions, PAGE_SIZE)

  return (
    <SettingsCard
      icon={Monitor}
      tone="info"
      body="form"
      title="Active sessions"
      description="Devices signed in to your account. Sign out any you don't recognize."
      footer={
        pageCount > 1 && (
          <>
            <PageRange first={first} count={pageItems.length} total={sessions.length} />
            <PageNav
              page={page}
              pageCount={pageCount}
              onChange={setPage}
              label="Active session pages"
            />
          </>
        )
      }
      action={
        others > 0 && (
          <Button
            variant="outline"
            className="bg-muted h-7.5 gap-1.5 px-3 text-[0.78125rem] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
            disabled={revokeOthers.isPending}
            onClick={() => setConfirming(true)}
          >
            <LogOut />
            Sign out others
          </Button>
        )
      }
    >
      <QueryState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={sessions.length === 0}
        loading={<Loading />}
        empty={<p className="text-ink-3 py-6 text-center text-[0.75rem]">No active sessions</p>}
      >
        <ul className="divide-border/60 -m-[1.125rem] divide-y overflow-hidden rounded-b-lg">
          {pageItems.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      </QueryState>

      <SimpleAlertDialog
        title="Sign out every other session?"
        description={`${others} other ${others === 1 ? 'session loses' : 'sessions lose'} access at once. This device stays signed in.`}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() =>
          revokeOthers.mutate(undefined, {
            onSuccess: () => {
              toast.success('Other sessions signed out')
              setConfirming(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Sign out others"
        variant="destructive"
      />
    </SettingsCard>
  )
}
