import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'

import { COMMUNITY } from '@/lib/constants/edition'

export const Route = createFileRoute('/(app)/settings/billing')({
  // The Community Edition takes no payments.
  beforeLoad: () => {
    if (COMMUNITY) throw redirect({ to: '/settings/profile', replace: true })
  },
  // A dynamic import behind the build-time constant, so the Community Edition's
  // bundle holds no billing code.
  component: COMMUNITY
    ? () => null
    : lazyRouteComponent(() => import('@/components/block/settings/quota-settings')),
})
