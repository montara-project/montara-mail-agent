import { createFileRoute } from '@tanstack/react-router'

import { DeleteAccountSettings } from '@/components/block/settings/settings-pages'

export const Route = createFileRoute('/(app)/settings/delete-account')({
  component: DeleteAccountSettings,
})
