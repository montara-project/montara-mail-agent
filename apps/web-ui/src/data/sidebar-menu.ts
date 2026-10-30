import { Inbox, LayoutDashboard } from 'lucide-react'

import type { NavItem } from '@/types/menu'

// ponytail: GET /me carries no app role yet, so everyone gets the same menu.
export const NAV_ITEMS: NavItem[] = [
  { title: 'Platform', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Mail', url: '/mail', icon: Inbox },
]
