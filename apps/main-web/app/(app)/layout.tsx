import SidebarLayout from '@/components/layout/sidebar/layout'
import { requireSession } from '@/lib/auth/handler'

/** Every route under (app) requires a live session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession()

  return <SidebarLayout>{children}</SidebarLayout>
}
