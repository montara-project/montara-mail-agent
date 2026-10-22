import type { AxiosResponse } from 'axios'

import type { Health } from '../../models/health'

/** /api/health returns the payload unwrapped (it is a probe endpoint). */
export type HealthResources = {
  get: () => Promise<AxiosResponse<Health>>
}
