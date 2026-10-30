import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import { appName, gitConfig } from './shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            src="/favicon/android-chrome-192x192.png"
            alt=""
            width={24}
            height={24}
            className="rounded-md"
          />
          <span className="font-semibold">{appName}</span>
        </>
      ),
    },
    links: [
      { text: 'Open the app', url: 'https://app.montaramail.web.id', external: true },
      { text: 'Website', url: 'https://montaramail.web.id', external: true },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}
