'use client'

import { Skeleton } from '@/components/ui/skeleton'

interface CellItemProps {
  loading: boolean
  children: React.ReactNode
}

export default function CellItem({ loading, children }: CellItemProps) {
  return loading ? <Skeleton className="h-5 w-full" /> : children
}
