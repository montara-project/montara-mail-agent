import type { NextConfig } from 'next'

// The backend owns /api; override the target when the API is not on :8080.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080'

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiTarget}/api/:path*` }]
  },
}

export default nextConfig
