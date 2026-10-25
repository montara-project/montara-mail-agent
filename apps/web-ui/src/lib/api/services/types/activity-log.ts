import type { AxiosListResponse } from '@/types/api'

import type { PaginateDto } from '../../dtos/paginate'
import type { Models } from '../../models'

export type ActivityLogListParams = PaginateDto & { search?: string; sorted?: string }

export type ActivityLogResources = {
  /** The signed-in user's own activities. */
  mine: (params?: ActivityLogListParams) => Promise<AxiosListResponse<Models.ActivityLog>>
  /** One organization's activities. */
  byOrganization: (
    organizationId: string,
    params?: ActivityLogListParams
  ) => Promise<AxiosListResponse<Models.ActivityLog>>
}
