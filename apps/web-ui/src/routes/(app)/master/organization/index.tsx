import { createFileRoute } from '@tanstack/react-router'

import OrganizationTable from '@/components/block/master/organization/table'

export const Route = createFileRoute('/(app)/master/organization/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <OrganizationTable />
}
