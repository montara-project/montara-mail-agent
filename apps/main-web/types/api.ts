import type { AxiosResponse } from 'axios'

export enum HTTP_METHOD {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
}

export type API_METHOD_MAP = {
  [HTTP_METHOD.GET]: 'list' | 'get'
  [HTTP_METHOD.POST]: 'store'
  [HTTP_METHOD.PUT]: 'update'
  [HTTP_METHOD.PATCH]: 'edit'
  [HTTP_METHOD.DELETE]: 'delete'
}

/**
 * `metadata` block of list responses (apps/server internal/dtos/response.go).
 * Offset is 0-based; limit is capped at 100 server-side.
 */
export type Metadata = {
  total?: number
  offset?: number
  limit?: number
}

// For Multiple Response
export type ApiListResponse<TData, TMeta extends Metadata = Metadata> = {
  message?: string
  data: TData[]
  metadata: TMeta
}

// For Single Response
export type ApiItemResponse<TData> = {
  message?: string
  data: TData
  metadata?: Metadata
}

// For Delete Response
export type ApiDeleteResponse = {
  message?: string
}

/**
 * One validation failure item, as the Go API emits it
 * (apps/server internal/lib/request-validator.go).
 */
export type FieldError = {
  code: string
  field: string
  message: string
  param: string
}

// For Error Response; `errors` is present on validation failures
export type ApiErrorResponse = {
  message?: string
  errors?: FieldError[]
}

export type AxiosListResponse<TData> = AxiosResponse<ApiListResponse<TData>>
export type AxiosItemResponse<TData> = AxiosResponse<ApiItemResponse<TData>>
export type AxiosDeleteResponse = AxiosResponse<ApiDeleteResponse>

export type ResourceMethods<TData> = {
  list: (params?: Record<string, unknown>) => Promise<AxiosListResponse<TData>>
  get: (id: string | number) => Promise<AxiosItemResponse<TData>>
  store: (data?: Record<string, unknown>) => Promise<AxiosItemResponse<TData>>
  edit: (id: string | number, data?: Record<string, unknown>) => Promise<AxiosItemResponse<TData>>
  update: (id: string | number, data?: Record<string, unknown>) => Promise<AxiosItemResponse<TData>>
  delete: (id: string | number) => Promise<AxiosDeleteResponse>
}

export type Resources<TMethods extends readonly HTTP_METHOD[], TData> = Pick<
  ResourceMethods<TData>,
  API_METHOD_MAP[TMethods[number]]
>

export interface ResourceProps {
  method: HTTP_METHOD
  url: string
  data?: Record<string, unknown>
  headers?: Record<string, string>
}
