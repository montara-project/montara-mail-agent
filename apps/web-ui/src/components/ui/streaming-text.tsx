import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT
 * A finished answer revealed word by word, then swapped for its
 * final rendering (e.g. Markdown) with its actions and follow-up
 * prompts. The server sends the answer whole, so the reveal is
 * paced here: a long answer reveals in chunks, never slower than
 * REVEAL_MS in total, and at once under reduced motion.
 * ───────────────────────────────────────────────────────── */

const TICK_MS = 30
/* per token: a word or the whitespace after it */
const TOKEN_MS = 20
const REVEAL_MS = 1600
const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => {})
      }}
      className="text-ink-3 hover:bg-hover-2 hover:text-ink-2 flex size-6 items-center justify-center rounded-[6px] transition-colors duration-100"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {copied ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <g>
            <rect x="9" y="9" width="12" height="12" rx="2.5" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </g>
        )}
      </svg>
    </button>
  )
}

export default function StreamingText({
  text,
  animate = true,
  render,
  actions,
  copy = true,
  followUps = [],
  followUpsLabel = 'Follow-ups',
  onFollowUp,
  onDone,
  className,
}: {
  /** the whole answer */
  text: string
  /** reveal it; off for answers already seen (e.g. history) */
  animate?: boolean
  /** the settled rendering; plain text with line breaks when absent */
  render?: (text: string) => ReactNode
  /** extra buttons in the action row once the reveal ends */
  actions?: ReactNode
  /** show the Copy action */
  copy?: boolean
  /** follow-up prompt suggestions shown once the reveal ends */
  followUps?: string[]
  followUpsLabel?: string
  onFollowUp?: (text: string, index: number) => void
  onDone?: () => void
  className?: string
}) {
  // Words and the whitespace between them, so line breaks survive the reveal.
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  const instant = !animate || reducedMotion()
  const [count, setCount] = useState(instant ? tokens.length : 0)
  // A new answer restarts the reveal.
  const [seen, setSeen] = useState(text)
  if (text !== seen) {
    setSeen(text)
    setCount(instant ? tokens.length : 0)
  }
  const done = count >= tokens.length
  const ticks = Math.max(1, Math.min(tokens.length * TOKEN_MS, REVEAL_MS) / TICK_MS)
  const step = Math.ceil(tokens.length / ticks)

  useEffect(() => {
    if (done) {
      onDone?.()
      return
    }
    const t = setTimeout(() => setCount((c) => c + step), TICK_MS)
    return () => clearTimeout(t)
    // onDone is a notification, not an input of the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done, step])

  const showRow = done && (copy || actions)

  return (
    <div data-ai-motion className={cn('w-full', className)}>
      {done && render ? (
        render(text)
      ) : (
        <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
          {tokens.slice(0, count).join('')}
          {!done && (
            <span
              aria-hidden
              className="bg-ink ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full"
              style={{ animation: 'fade-in 150ms ease-out both' }}
            />
          )}
        </p>
      )}

      {showRow && (
        <div
          className="mt-2 flex items-center gap-0.5"
          style={{ animation: 'fade-in 300ms ease-out both' }}
        >
          {copy && <CopyButton text={text} />}
          {actions}
        </div>
      )}

      {done && followUps.length > 0 && (
        <div className="mt-2.5">
          <p className="text-ink-2 text-[12px] font-medium">{followUpsLabel}</p>
          <div className="mt-0.5 flex flex-col">
            {followUps.map((prompt, i) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onFollowUp?.(prompt, i)}
                className="border-line text-ink hover:bg-hover-2 -mx-1.5 flex items-center gap-2 rounded-[7px] border-b px-1.5 py-1.5 text-left text-[12.5px] transition-colors duration-100"
                style={{ animation: `fade-up 350ms ${EASE} ${i * 90}ms both` }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden
                >
                  <path d="M9 10l-5 5 5 5" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
