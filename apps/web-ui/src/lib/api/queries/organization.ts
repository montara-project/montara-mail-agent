import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import type { OrganizationFormDto } from '../dtos/master/organization/schema'
import type { PaginateDto } from '../dtos/paginate'

import { services } from '../services'

export const ORGANIZATION_QUERY_KEY = 'organizations'

export const LIST_ORGANIZATION_QUERY_KEY = (params?: PaginateDto) => {
  return [ORGANIZATION_QUERY_KEY, 'list', params]
}

export const GET_ORGANIZATION_QUERY_KEY = (id: string) => {
  return [ORGANIZATION_QUERY_KEY, 'detail', id]
}

const list = (params?: PaginateDto & { search?: string; sorted?: string }) =>
  queryOptions({
    queryKey: LIST_ORGANIZATION_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.organizations.list(params ?? DEFAULT_PAGINATE)
      return res.data
    },
  })

const get = (id: string) =>
  queryOptions({
    queryKey: GET_ORGANIZATION_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.organizations.get(id)
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: OrganizationFormDto) => {
      const res = await services.organizations.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: OrganizationFormDto) => {
      const res = await services.organizations.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.organizations.delete(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY] })
    },
  })
}

export const organizationQueries = { list, get, create, update, delete: del } as const
