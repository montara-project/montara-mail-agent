import { createFileRoute } from '@tanstack/react-router'

import MailSettings from '@/components/block/settings/mail-settings'

export const Route = createFileRoute('/(app)/settings/mail')({
  component: MailSettings,
})
