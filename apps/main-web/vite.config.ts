import { cloudflare } from '@cloudflare/vite-plugin'
import { staticAssetsAdapter } from '@vinext/cloudflare/cache/static-assets-adapter'
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vinext({
      images: { optimizer: imagesOptimizer() },
      // Every page is static: rendered at build, served from Workers Static Assets.
      prerender: true,
      cache: { cdn: staticAssetsAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
