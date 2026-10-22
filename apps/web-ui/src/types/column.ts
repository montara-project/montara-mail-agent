import type { ColumnDef, RowData } from '@tanstack/react-table'

import type { features } from '@/components/block/common/react-table'

export type BaseColumnProps = {
  loading: boolean
}

/** Column definition bound to the shared table features. */
export type AppColumnDef<T extends RowData> = ColumnDef<typeof features, T, unknown>
