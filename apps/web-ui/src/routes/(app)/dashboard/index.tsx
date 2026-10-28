import { createFileRoute } from '@tanstack/react-router'

import PageContainer from '@/components/block/common/page-container'
import MailStats from '@/components/block/dashboard/mail-stats'

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PageContainer>
      <MailStats />
    </PageContainer>
  )
}
