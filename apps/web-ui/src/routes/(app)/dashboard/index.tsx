import { createFileRoute } from '@tanstack/react-router'

import MailAccountList from '@/components/block/dashboard/mail-account-list'

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <MailAccountList />
}
