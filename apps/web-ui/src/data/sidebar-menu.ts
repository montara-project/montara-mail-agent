import { Inbox, LayoutDashboard, Settings, UserRound } from 'lucide-react'

import type { NavItem } from '@/types/menu'

// ponytail: GET /me carries no app role yet, so everyone gets the same menu.
export const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Accounts', url: '/account', icon: UserRound },
  { title: 'Mail', url: '/mail', icon: Inbox },
  // { title: 'Notifications', url: '/notifications', icon: Bell },
  // { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Control Center', url: '/settings', icon: Settings },
]

/** A sidebar row whose page doesn't exist yet: looks like its neighbours, but does nothing. */
export const SOON_BUTTON =
  'cursor-default hover:bg-transparent hover:text-muted-foreground active:bg-transparent aria-disabled:pointer-events-auto aria-disabled:opacity-100'
