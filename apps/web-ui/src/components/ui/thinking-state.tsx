import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────
 * THINKING — an expandable trace of what the agent is doing
 *
 * Controlled: the caller passes the steps as they happen and
 * whether work is still going on. While working the trace is
 * open, the newest step spins and the header shimmers; once
 * done it settles to a summary and stays expandable.
 * ───────────────────────────────────────────────────────── */

export type ThinkingRow = { primary: string; secondary?: string }

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export default function ThinkingState({
  working,
  rows,
  active = 'Thinking',
  done = 'Done',
  className,
}: {
  /** the trace is live: header shimmers, newest step spins */
  working: boolean
  /** the steps so far, oldest first */
  rows: ThinkingRow[]
  /** header while working */
  active?: string
  /** header once settled */
  done?: string
  className?: string
}) {
  // null follows the work (open while working); a click pins it.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const expanded = (manualExpanded ?? working) && rows.length > 0
  const traceRef = useRef<HTMLDivElement>(null)
  const [lineHeight, setLineHeight] = useState(0)
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight)
  }, [rows.length, expanded])

  return (
    <div data-ai-motion className={cn('flex w-full flex-col', className)}>
      <button
        type="button"
        aria-expanded={expanded}
        disabled={rows.length === 0}
        onClick={() => setManualExpanded(!expanded)}
        className="rounded-control hover:bg-hover-2 -mx-1.5 flex w-fit items-center gap-2 px-1.5 py-1 transition-colors duration-100 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={working ? 'var(--accent-ink)' : 'var(--ink-3)'}
          aria-hidden
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {working ? (
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-text 1.4s linear infinite',
              }}
            >
              {active}
            </span>
          ) : (
            <span
              className="text-ink-2 text-[13px] font-medium whitespace-nowrap"
              style={{ animation: 'fade-in 350ms ease-out both' }}
            >
              {done}
            </span>
          )}
        </span>
        {rows.length > 0 && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: EASE,
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span
              aria-hidden
              className="bg-line absolute left-[3px] w-px"
              style={{
                top: -8,
                height: lineHeight ? lineHeight - 2 : 0,
                transition: `height 500ms ${EASE}`,
              }}
            />
            <div ref={traceRef} className="flex flex-col gap-1 py-1">
              {rows.map((row, i) => (
                <div
                  key={`${i}-${row.primary}`}
                  className="flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left"
                  style={{ animation: `fade-up 320ms ${EASE} both` }}
                >
                  {working && i === rows.length - 1 ? (
                    <span className="border-line-strong border-t-ink-2 size-3 shrink-0 animate-spin rounded-full border-[1.5px]" />
                  ) : (
                    <Check />
                  )}
                  <span className="text-ink min-w-0 truncate text-[12.5px] font-medium">
                    {row.primary}
                  </span>
                  {row.secondary && (
                    <span className="text-ink-3 min-w-0 truncate text-[11.5px]">
                      {row.secondary}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
