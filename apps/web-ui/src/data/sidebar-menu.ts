import { Inbox, Settings } from 'lucide-react'

import type { NavItem } from '@/types/menu'

// ponytail: GET /me carries no app role yet, so everyone gets the same menu.
export const NAV_ITEMS: NavItem[] = [
  { title: 'Mail', url: '/mail', icon: Inbox },
  { title: 'Control Center', url: '/settings', icon: Settings },
]
