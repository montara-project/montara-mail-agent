import ReactMarkdown, { type Components } from 'react-markdown'

import { cn } from '@/lib/utils'

// No typography plugin here, so each element gets its spacing explicitly.
// Bold text is the model's way of flagging what matters: show it highlighted.
const components: Components = {
  p: ({ node: _, ...props }) => <p className="leading-relaxed [&:not(:first-child)]:mt-2" {...props} />,
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
    <a className="text-blue-600 underline dark:text-blue-400" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node: _, ...props }) => <code className="bg-muted rounded px-1 text-[0.9em]" {...props} />,
}

/** Renders Markdown from an untrusted source: react-markdown never renders raw HTML. */
export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('text-sm', className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  )
}
