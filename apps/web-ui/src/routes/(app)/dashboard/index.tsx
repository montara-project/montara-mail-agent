import { createFileRoute } from '@tanstack/react-router'

import HealthCard from '@/components/block/dashboard/health-card'

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <HealthCard />
}
