import { IconCheck } from '@tabler/icons-react'

export type NavItem = {
  title: string
  url: string
  icon: typeof IconCheck
}

export type UserInfo = {
  name: string
  email: string
  avatar: string
}
