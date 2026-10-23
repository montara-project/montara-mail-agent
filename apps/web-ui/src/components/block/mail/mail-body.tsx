import React from 'react'

// No scripts, no forms, nothing loaded but images, styles and fonts; links
// open in a new tab. allow-same-origin only lets this page read the frame's
// height: without allow-scripts the email can't use it.
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
const CSP =
  "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline' https:; font-src https: data:"

// Emails are designed for a white page, so the frame keeps one in dark mode too.
const BASE_STYLE = `
  html, body { margin: 0; }
  body { padding: 16px; background: #fff; color: #1f2328; font: 14px/1.5 system-ui, sans-serif; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
`

/**
 * An email's HTML, isolated in a sandboxed frame that grows with its content
 * (images loading late included), so the email's CSS can't leak into the app.
 */
function HtmlBody({ html }: { html: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = React.useState(240)

  // Our head goes first so the CSP and base apply before the email's own markup.
  const srcDoc = React.useMemo(
    () =>
      `<meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>${BASE_STYLE}</style>${html}`,
    [html]
  )

  const fit = React.useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc) return
    setHeight(doc.documentElement.scrollHeight)
    const observer = new ResizeObserver(() => setHeight(doc.documentElement.scrollHeight))
    observer.observe(doc.documentElement)
    // The frame's document is replaced on the next load, which ends this observer with it.
    ref.current?.addEventListener('load', () => observer.disconnect(), { once: true })
  }, [])

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox={SANDBOX}
      srcDoc={srcDoc}
      onLoad={fit}
      style={{ height }}
      className="w-full rounded-lg border bg-white"
    />
  )
}

/** The mail's HTML when it has some, else its plain text. */
export default function MailBody({ html, text }: { html?: string | null; text?: string }) {
  if (html) return <HtmlBody html={html} />
  return <div className="max-w-3xl text-[15px] leading-relaxed whitespace-pre-line">{text}</div>
}
