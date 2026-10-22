/** GET /api/health — liveness plus a real database ping. */
export type Health = {
  status: 'ok' | 'degraded'
  database: 'up' | 'down'
  service: string
  version: string
  timestamp: string
}
