import { IconFolders, IconLayoutDashboard } from '@tabler/icons-react'

import type { NavMainItem, SidebarMenuData } from '@/types/menu'

import { ROLES, type RoleName } from '@/lib/constants/auth'

const NAV_DASHBOARD: NavMainItem = {
  title: 'Dashboard',
  url: '/dashboard',
  icon: IconLayoutDashboard,
  isActive: true,
  items: [],
}

const NAV_MASTER: NavMainItem = {
  title: 'Master',
  url: '#',
  icon: IconFolders,
  items: [{ title: 'Organization', url: '/master/organization', icon: IconFolders }],
}

/** Menus by role. Only routes that actually exist are listed. */
const MENUS: Record<RoleName, NavMainItem[]> = {
  [ROLES.ADMIN]: [NAV_DASHBOARD, NAV_MASTER],
  [ROLES.MENTOR]: [NAV_DASHBOARD, NAV_MASTER],
  [ROLES.USER]: [NAV_DASHBOARD],
}

const SIDEBAR_MENU: SidebarMenuData = {
  navMenu: {
    overview: MENUS[ROLES.ADMIN],
  },
}

/** Menu for a role; unknown or missing roles fall back to the dashboard only. */
export function getSidebarMenu(role?: string): SidebarMenuData {
  const nav = MENUS[role as RoleName] ?? MENUS[ROLES.USER]
  return { navMenu: { overview: nav } }
}

export { SIDEBAR_MENU }
