import { createFileRoute } from '@tanstack/react-router'

import APIKeyList from '@/components/block/settings/api-key-list'

export const Route = createFileRoute('/(app)/settings/api-keys')({
  component: APIKeyList,
})
