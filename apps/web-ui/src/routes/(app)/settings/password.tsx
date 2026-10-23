import { createFileRoute } from '@tanstack/react-router'

import PasswordSettings from '@/components/block/settings/password-form'

export const Route = createFileRoute('/(app)/settings/password')({
  component: PasswordSettings,
})
