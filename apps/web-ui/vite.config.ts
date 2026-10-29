import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend owns /api and /health; override the target when the API is not on :8080.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  build: {
    rolldownOptions: {
      // @lexkit/editor imports react-dom/server at the top of its one bundled file,
      // for code the mail editor never reaches. Without side effects assumed, the
      // unused import drops out: ~200 kB less in the editor chunk.
      treeshake: {
        moduleSideEffects: (id) =>
          !/node_modules\/react-dom\/(server|cjs\/react-dom-server)/.test(id),
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
})

export default config
