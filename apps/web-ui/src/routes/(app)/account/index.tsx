import { createFileRoute } from '@tanstack/react-router'

import ConnectorList from '@/components/block/account/connector-list'
import MailAccountList from '@/components/block/account/mail-account-list'

export const Route = createFileRoute('/(app)/account/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="grid gap-8">
      <MailAccountList />
      <ConnectorList />
    </div>
  )
}
