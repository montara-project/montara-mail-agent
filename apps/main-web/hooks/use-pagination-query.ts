import { useQueryState } from 'nuqs'

/**
 * Read server pagination from the URL. `offset` is 0-based and `limit` is
 * capped at 100 server-side; `pageIndex` is what the table components expect.
 */
export function usePaginationQuery() {
  const [queryPage] = useQueryState('page')
  const [queryPageSize] = useQueryState('pageSize')

  // Garbage like ?page=abc must fall back, not produce a NaN offset.
  const parsedPage = Number.parseInt(queryPage ?? '', 10)
  const pageIndex = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 0

  const parsedPageSize = Number.parseInt(queryPageSize ?? '', 10)
  const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize >= 0 ? parsedPageSize : 10

  return { offset: pageIndex * pageSize, limit: pageSize, pageIndex }
}
