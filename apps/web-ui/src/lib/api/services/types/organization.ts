import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { OrganizationFormDto } from '../../dtos/master/organization/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { Models } from '../../models'

export type OrganizationListParams = PaginateDto & { search?: string; sorted?: string }

export type OrganizationResources = {
  list: (params: OrganizationListParams) => Promise<AxiosListResponse<Models.Organization>>
  get: (id: string) => Promise<AxiosItemResponse<Models.Organization>>
  store: (body: OrganizationFormDto) => Promise<AxiosItemResponse<Models.Organization>>
  update: (id: string, body: OrganizationFormDto) => Promise<AxiosItemResponse<Models.Organization>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  stats: (id: string) => Promise<AxiosItemResponse<Models.OrganizationStats>>
}
