import type { AxiosResponse } from 'axios'

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
type ApiDeleteResponse = {
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
