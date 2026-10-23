import { createFileRoute } from '@tanstack/react-router'

import MailStats from '@/components/block/dashboard/mail-stats'

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <MailStats />
}
