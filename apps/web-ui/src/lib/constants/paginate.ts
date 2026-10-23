import type { PaginateDto } from '../api/dtos/paginate'

/** Default list page: first page, ten rows (the server default limit). */
export const DEFAULT_PAGINATE: Required<PaginateDto> = {
  offset: 0,
  limit: 10,
}
