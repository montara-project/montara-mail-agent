import type { AxiosResponse } from 'axios'

import type {
  ApiListResponse,
  AxiosDeleteResponse,
  AxiosItemResponse,
  AxiosListResponse,
  Metadata,
} from '@/types/api'

import type { OrganizationFormDto } from '../../dtos/organization/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { Models } from '../../models'
import type { MailListParams } from './email-account'

export type OrganizationListParams = PaginateDto & {
  search?: string
  sorted?: string
  /** member=1 limits the list to the caller's memberships, even for a super user. */
  member?: string
}

export type OrganizationResources = {
  list: (params: OrganizationListParams) => Promise<AxiosListResponse<Models.Organization>>
  get: (id: string) => Promise<AxiosItemResponse<Models.Organization>>
  store: (body: OrganizationFormDto) => Promise<AxiosItemResponse<Models.Organization>>
  update: (id: string, body: OrganizationFormDto) => Promise<AxiosItemResponse<Models.Organization>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  stats: (id: string) => Promise<AxiosItemResponse<Models.OrganizationStats>>
  /** One folder across every account of the organization, newest first. */
  mails: (
    id: string,
    params: MailListParams
  ) => Promise<AxiosResponse<ApiListResponse<Models.Mail, Metadata & { unread: number }>>>
}
