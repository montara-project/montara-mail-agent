import { SERVER_URL } from '@/lib/api/server-url'

/** Where MCP clients connect: the server this browser uses. */
export const MCP_ENDPOINT = `${SERVER_URL || window.location.origin}/mcp`
