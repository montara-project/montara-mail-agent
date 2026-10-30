import { accentChain, ACCENTS, createShader, playSweep } from 'glimm'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
])

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A controlled composer: quick prompts on / (or the + button),
 * a picker for who answers (the agent bot persona), dictation
 * where the browser has speech recognition, and send — which
 * turns into stop while a turn runs. Type / to open the menu;
 * ↑↓ + Enter to pick.
 * ───────────────────────────────────────────────────────── */

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

/** A quick prompt: picking it replaces the typed /word with `prompt`. */
export type PromptCommand = { key: string; name: string; desc: string; prompt: string }
/** One choice in the picker, e.g. an agent bot. */
type PromptModel = { key: string; name: string; tag?: string }

function Icon({
  children,
  size = 15,
  strokeWidth = 1.8,
}: {
  children: React.ReactNode
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/* The Web Speech API, which TypeScript's DOM types leave out. */
type Recognition = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function speechRecognition(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/* Build the shader with a pinned hue phase. createShader seeds its
 * internal hueShift from Math.random(), which made the sweep a different
 * colour on every reload — pin it so the rainbow is identical each time. */
function makeShader(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null
  const random = Math.random
  Math.random = () => 0
  try {
    return createShader({
      canvas,
      palette: RAINBOW,
      direction: 'ltr',
      bandTight: 10,
      swellAmount: 0.85,
    })
  } finally {
    Math.random = random
  }
}

/* the /word being typed at the end of the draft, if any */
function parseToken(draft: string): { query: string; start: number } | null {
  const match = /(^|\s)\/([\w-]*)$/.exec(draft)
  if (!match) return null
  return { query: match[2].toLowerCase(), start: match.index + match[1].length }
}

export default function PromptBar({
  value,
  onChange,
  onSend,
  busy = false,
  onStop,
  disabled = false,
  placeholder,
  commands = [],
  models = [],
  model,
  onModelChange,
  modelLabel = 'Choose who answers',
  inputRef: externalInputRef,
  label = 'Prompt',
  sendLabel,
}: {
  value: string
  onChange: (value: string) => void
  onSend: (text: string) => void
  /** a turn is running: send becomes stop and the input is locked */
  busy?: boolean
  onStop?: () => void
  disabled?: boolean
  placeholder?: string
  /** quick prompts for the / menu and the + button */
  commands?: PromptCommand[]
  /** picker choices; the picker hides with fewer than two */
  models?: PromptModel[]
  model?: string
  onModelChange?: (key: string) => void
  modelLabel?: string
  inputRef?: Ref<HTMLTextAreaElement>
  /** the input's accessible name */
  label?: string
  /** a worded, accent-colored send (e.g. "Write") where an arrow could pass for another send */
  sendLabel?: string
}) {
  const draft = value
  const setDraft = onChange
  const [dismissed, setDismissed] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [listening, setListening] = useState(false)
  const [wide, setWide] = useState(false)
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null)
  const [engaged, setEngaged] = useState(false)
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null)
  const [modelHovered, setModelHovered] = useState<number | null>(null)
  const [modelMenuLeft, setModelMenuLeft] = useState(0)
  const [modelMenuBottom, setModelMenuBottom] = useState(0)
  const composerAnchorRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const modelRef = useRef<HTMLButtonElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const glimmRef = useRef<HTMLCanvasElement>(null)
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null)
  const sweepingRef = useRef(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const [Speech] = useState(speechRecognition)
  // The caller's ref reaches the same textarea, e.g. to focus it.
  useImperativeHandle(externalInputRef, () => inputRef.current as HTMLTextAreaElement, [])

  const showModels = models.length > 1 && !!onModelChange
  const current = models.find((m) => m.key === model) ?? models[0]
  const locked = disabled || busy

  const token = dismissed ? null : parseToken(draft)
  const menuOpen = commands.length > 0 && (plusOpen || token !== null)
  const query = plusOpen ? '' : (token?.query ?? '')
  const rows = menuOpen
    ? commands.filter(
        (c) => c.name.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query)
      )
    : []

  // A new menu or query starts the highlight at the top.
  const menuKey = `${menuOpen}:${query}`
  const [seenMenuKey, setSeenMenuKey] = useState(menuKey)
  if (menuKey !== seenMenuKey) {
    setSeenMenuKey(menuKey)
    setActive(0)
    setEngaged(false)
  }

  /* a single highlight glides to the active row instead of each row
   * toggling its own background */
  useLayoutEffect(() => {
    const target = rowRefs.current[active]
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight })
  }, [menuOpen, query, active, rows.length])

  /* same gliding highlight in the picker — floats to the hovered row,
   * falling back to the current choice */
  const modelIndex = Math.max(
    0,
    models.findIndex((m) => m.key === current?.key)
  )
  useLayoutEffect(() => {
    if (!modelOpen) return
    const target = modelRowRefs.current[modelHovered ?? modelIndex]
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight })
  }, [modelOpen, modelHovered, modelIndex])

  /* The picker menu is outside the clipped composer, so align it to its
   * trigger by measurement instead of pinning it to an edge. */
  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return
    const anchorRect = composerAnchorRef.current.getBoundingClientRect()
    const triggerRect = modelRef.current.getBoundingClientRect()
    setModelMenuLeft(
      Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 208))
    )
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8)
  }, [modelOpen, wide, current?.name])

  useEffect(() => {
    return () => {
      shaderRef.current?.destroy()
      shaderRef.current = null
      recognitionRef.current?.stop()
    }
  }, [])

  /* switching who answers plays a one-shot rainbow sweep across the composer */
  const celebrate = () => {
    if (sweepingRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Recreate the shader per sweep so uTime restarts at 0 — the hue phase
    // (which drifts with time) is then identical on every trigger.
    shaderRef.current?.destroy()
    const shader = makeShader(glimmRef.current)
    shaderRef.current = shader
    if (!shader) return
    sweepingRef.current = true
    const sweep = playSweep(shader, {
      palette: RAINBOW,
      direction: 'ltr',
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: 'easeOutExpo',
    })
    void sweep.done.finally(() => {
      sweepingRef.current = false
    })
  }

  const selectModel = (next: PromptModel) => {
    setModelOpen(false)
    if (next.key === current?.key) return
    onModelChange?.(next.key)
    celebrate()
  }

  const toggleDictation = () => {
    if (!Speech) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new Speech()
    recognition.lang = navigator.language
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results, (result) => result[0]?.transcript ?? '').join(' ')
      if (spoken.trim()) setDraft(draft ? `${draft.trimEnd()} ${spoken.trim()}` : spoken.trim())
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      inputRef.current?.focus()
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current
    const controls = controlsRef.current
    const measure = measureRef.current
    if (!input || !controls || !measure) return

    // send (wider with a label), plus + and the mic when shown
    const buttons =
      28 * (1 + (commands.length > 0 ? 1 : 0) + (Speech ? 1 : 0)) + (sendLabel ? 48 : 0)
    const fixedControlsWidth = buttons + (modelRef.current?.offsetWidth ?? 0)
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - 4 * 4
    const needsFullWidth = draft.includes('\n') || measure.offsetWidth + 8 > inlineInputWidth
    if (needsFullWidth !== wide) setWide(needsFullWidth)

    const minHeight = 28
    const maxHeight = 120
    input.style.height = '0px'
    const contentHeight = input.scrollHeight
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`
    input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden'
  }, [draft, wide, commands.length, Speech, sendLabel])

  /* clicking anywhere outside the composer closes the open menus */
  useEffect(() => {
    if (!modelOpen && !plusOpen) return
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-promptbar]')) {
        setModelOpen(false)
        setPlusOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [modelOpen, plusOpen])

  const closeMenus = () => {
    setPlusOpen(false)
    setModelOpen(false)
  }

  const pick = (row: PromptCommand) => {
    setDraft(`${token ? draft.slice(0, token.start) : draft}${row.prompt}`)
    setPlusOpen(false)
    setDismissed(false)
    inputRef.current?.focus()
  }

  const canSend = draft.trim().length > 0 && !locked
  // The send button: accent with a worded label, ink as a bare arrow, muted when it can't send.
  let sendColors = { background: 'var(--line-strong)', color: 'var(--ink-2)' }
  if (canSend && sendLabel) sendColors = { background: 'var(--accent-ink)', color: 'white' }
  else if (canSend) sendColors = { background: 'var(--ink)', color: 'var(--surface)' }
  const send = () => {
    if (!canSend) return
    onSend(draft.trim())
    closeMenus()
  }

  // One row: [+] input [picker] [mic] send. Wide: the input takes the first
  // row and the controls sit below it, a spacer pushing mic and send right.
  const columns = [
    commands.length > 0 && '28px',
    !wide && 'minmax(0,1fr)',
    showModels && 'auto',
    wide && 'minmax(0,1fr)',
    Speech && '28px',
    sendLabel ? 'auto' : '28px',
  ].filter((column): column is string => !!column)
  const roundness = 'rounded-[8px]'

  return (
    <div data-promptbar data-ai-motion className="w-full">
      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
        {/* ── / quick prompts ─────────────────────────────── */}
        {menuOpen && (
          <div
            onMouseLeave={() => setEngaged(false)}
            className="bg-surface shadow-raised absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] p-1"
            style={{ animation: `pop-in 180ms ${EASE} both`, transformOrigin: 'bottom center' }}
          >
            <span
              aria-hidden
              className="bg-hover pointer-events-none absolute inset-x-1 rounded-[6px]"
              style={{
                top: rowBox?.top ?? 0,
                height: rowBox?.height ?? 0,
                opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
                transition: `top 220ms ${EASE}, height 220ms ${EASE}, opacity 150ms ease`,
              }}
            />
            {rows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i)
                  setEngaged(true)
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                <span className="text-ink shrink-0 text-[12.5px] font-medium">{row.name}</span>
                <span className="text-ink-3 min-w-0 flex-1 truncate text-[12px]">{row.desc}</span>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="text-ink-3 flex h-9 items-center px-2 text-[12px]">
                No matches for “{query}”
              </div>
            )}
            <div className="border-line text-ink-3 mt-1 border-t px-2 pt-1.5 pb-1 text-[11px]">
              Type to search quick prompts
            </div>
          </div>
        )}

        {/* ── picker menu ─────────────────────────────────── */}
        {modelOpen && (
          <div
            onMouseLeave={() => setModelHovered(null)}
            className="bg-surface shadow-raised absolute z-10 w-52 rounded-[10px] p-1"
            style={{
              left: modelMenuLeft,
              bottom: modelMenuBottom,
              animation: `pop-in 180ms ${EASE} both`,
              transformOrigin: 'bottom left',
            }}
          >
            <span
              aria-hidden
              className="bg-hover pointer-events-none absolute inset-x-1 rounded-[6px]"
              style={{
                top: modelBox?.top ?? 0,
                height: modelBox?.height ?? 0,
                opacity: modelBox && modelHovered !== null ? 1 : 0,
                transition: `top 220ms ${EASE}, height 220ms ${EASE}, opacity 150ms ease`,
              }}
            />
            {models.map((m, i) => (
              <button
                key={m.key}
                type="button"
                ref={(el) => {
                  modelRowRefs.current[i] = el
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setModelHovered(i)}
                onClick={() => {
                  selectModel(m)
                  inputRef.current?.focus()
                }}
                className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
              >
                <span className="text-ink min-w-0 flex-1 truncate text-[12.5px] font-medium">
                  {m.name}
                </span>
                {m.tag && <span className="text-ink-3 shrink-0 text-[11px]">{m.tag}</span>}
                <span className={`text-ink shrink-0 ${m.key === current?.key ? '' : 'invisible'}`}>
                  <Icon size={13} strokeWidth={2.5}>
                    <path d="M20 6L9 17l-5-5" />
                  </Icon>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── composer ───────────────────────────────────── */}
        <div
          className={`border-line bg-surface shadow-card focus-within:border-line-strong relative isolate flex flex-col overflow-hidden border transition-[border-color,border-radius] duration-150 gap-1.5 rounded-[14px] p-1.5 ${
            locked && !busy ? 'opacity-60' : ''
          }`}
        >
          {/* rainbow glimm sweep — plays across the interior on a switch.
              explicit w/h: a <canvas> is a replaced element and won't stretch
              to inset-0 alone, which feeds back into the shader's ResizeObserver. */}
          <canvas
            ref={glimmRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
            style={{ borderRadius: 'inherit' }}
          />
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute text-[13px] leading-[18px] whitespace-pre"
          >
            {draft}
          </span>

          <div
            ref={controlsRef}
            className="grid items-end gap-x-1 gap-y-1.5"
            style={{ gridTemplateColumns: columns.join(' ') }}
          >
            {commands.length > 0 && (
              <button
                type="button"
                aria-label="Quick prompts"
                aria-expanded={plusOpen}
                disabled={locked}
                onClick={() => {
                  setModelOpen(false)
                  setPlusOpen((open) => !open)
                  inputRef.current?.focus()
                }}
                className={`text-ink-3 hover:bg-hover hover:text-ink flex size-7 shrink-0 items-center justify-center justify-self-start transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:pointer-events-none ${roundness} ${
                  plusOpen ? 'bg-hover text-ink' : ''
                } ${wide ? 'row-start-2' : 'row-start-1'}`}
              >
                <Icon size={16} strokeWidth={2}>
                  <path d="M12 5v14M5 12h14" />
                </Icon>
              </button>
            )}

            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={locked}
              onChange={(event) => {
                setDraft(event.target.value)
                setDismissed(false)
                setPlusOpen(false)
              }}
              onKeyDown={(event) => {
                if (menuOpen && rows.length > 0) {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    setEngaged(true)
                    setActive(
                      (i) => (i + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length
                    )
                    return
                  }
                  if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
                    event.preventDefault()
                    pick(rows[active])
                    return
                  }
                }
                if (event.key === 'Escape') {
                  setDismissed(true)
                  closeMenus()
                  return
                }
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  send()
                }
              }}
              placeholder={listening ? 'Listening…' : (placeholder ?? 'Write a message…')}
              aria-label={label}
              className={`min-h-7 px-1 py-[5px] text-[13px] leading-[18px] text-ink placeholder:text-ink-3 w-full min-w-0 resize-none bg-transparent [overflow-wrap:anywhere] outline-none disabled:cursor-not-allowed ${
                wide ? 'col-span-full row-start-1' : 'row-start-1'
              }`}
            />

            {showModels && (
              <button
                ref={modelRef}
                type="button"
                aria-expanded={modelOpen}
                aria-label={`${modelLabel}: ${current?.name ?? ''}`}
                disabled={locked}
                onClick={() => {
                  setPlusOpen(false)
                  setModelOpen((open) => !open)
                }}
                className={`text-ink-2 hover:bg-hover hover:text-ink flex h-7 max-w-36 min-w-0 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium transition-colors duration-150 disabled:pointer-events-none ${roundness} ${
                  wide ? 'row-start-2 justify-self-start' : 'row-start-1'
                }`}
              >
                <span className="truncate">{current?.name}</span>
                <span className="text-ink-3 shrink-0">
                  <Icon size={11} strokeWidth={2.4}>
                    <path d="M6 9l6 6 6-6" />
                  </Icon>
                </span>
              </button>
            )}

            {wide && <span aria-hidden className="row-start-2" />}

            {Speech && (
              <button
                type="button"
                aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                aria-pressed={listening}
                disabled={locked}
                onClick={toggleDictation}
                className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:pointer-events-none ${roundness} ${
                  listening
                    ? 'bg-accent-tint text-accent-ink'
                    : 'text-ink-3 hover:bg-hover hover:text-ink'
                } ${wide ? 'row-start-2' : 'row-start-1'}`}
              >
                {listening ? (
                  <span className="flex h-3.5 items-center gap-[2.5px]">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-[2.5px] rounded-full bg-current"
                        style={{
                          height: '100%',
                          animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite`,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <Icon size={15} strokeWidth={2}>
                    <g>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                    </g>
                  </Icon>
                )}
              </button>
            )}

            {/* send, or stop while a turn runs — tactile square */}
            {busy && onStop ? (
              <button
                type="button"
                aria-label="Stop"
                onClick={onStop}
                className={`bg-inset text-ink hover:bg-hover flex size-7 shrink-0 items-center justify-center transition-[background-color,transform] duration-200 active:scale-[0.94] ${roundness} ${
                  wide ? 'row-start-2' : 'row-start-1'
                }`}
                style={{ gridColumnStart: columns.length }}
              >
                <span className="size-2.5 rounded-[2px] bg-current" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={sendLabel ?? 'Send'}
                disabled={!canSend}
                onClick={send}
                className={`flex h-7 shrink-0 items-center justify-center gap-1.5 transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96] ${
                  sendLabel ? 'px-2.5 text-[12.5px] font-medium' : 'w-7'
                } ${roundness} ${wide ? 'row-start-2' : 'row-start-1'}`}
                style={{ gridColumnStart: columns.length, ...sendColors }}
              >
                {sendLabel ? (
                  <>
                    <Icon size={13} strokeWidth={2.2}>
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                    </Icon>
                    {sendLabel}
                  </>
                ) : (
                  <Icon size={16} strokeWidth={2.4}>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </Icon>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
