import { useTheme } from 'next-themes'
import React from 'react'

// No scripts, no forms, nothing loaded but images, styles and fonts; links
// open in a new tab. allow-same-origin only lets this page read the frame's
// height: without allow-scripts the email can't use it.
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
const CSP =
  "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline' https:; font-src https: data:"

// An email that styles its own dark mode says so in its CSS or meta tags.
const OWN_DARK_MODE = /prefers-color-scheme\s*:\s*dark|color-scheme[^;>]*dark/i
// Inverts lightness but keeps hues; applied twice (page, then images) it cancels out.
const INVERT = 'filter: invert(1) hue-rotate(180deg);'

/**
 * The frame's own styles. The page stays transparent so the app's card shows
 * through. In dark mode an email with its own dark styles gets to use them;
 * any other email is inverted, with images inverted back, so dark text on a
 * white layout turns light on dark instead of vanishing.
 */
function frameStyle(dark: boolean, ownDarkMode: boolean) {
  const invert = dark && !ownDarkMode
  return `
    :root { color-scheme: ${ownDarkMode ? 'light dark' : 'light'}; }
    html { overflow: hidden; ${invert ? INVERT : ''} }
    html, body { margin: 0; background: transparent; }
    body { padding: 1px 0; color: CanvasText; font: 14px/1.5 system-ui, sans-serif; overflow-wrap: anywhere; overflow-x: auto; }
    img { max-width: 100%; height: auto; }
    ${invert ? `img, picture, video, [background], [style*="background-image"] { ${INVERT} }` : ''}
  `
}

/**
 * An email's HTML, isolated in a sandboxed frame that grows with its content
 * (images loading late included), so the email's CSS can't leak into the app.
 */
function HtmlBody({ html }: { html: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = React.useState(240)
  const dark = useTheme().resolvedTheme !== 'light'
  const ownDarkMode = OWN_DARK_MODE.test(html)

  // Our head goes first so the CSP and base apply before the email's own markup.
  const srcDoc = React.useMemo(
    () =>
      `<meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>${frameStyle(dark, ownDarkMode)}</style>${html}`,
    [html, dark, ownDarkMode]
  )

  // The body's own box, not the document's: the document is never shorter
  // than the frame, so measuring it could only ever grow.
  const fit = React.useCallback(() => {
    const body = ref.current?.contentDocument?.body
    if (!body) return
    const measure = () => setHeight(Math.ceil(body.getBoundingClientRect().height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
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
      // Matching the frame's color scheme to its page keeps the browser from
      // painting an opaque backdrop behind the transparent page.
      style={{ height, colorScheme: ownDarkMode && dark ? 'dark' : 'light' }}
      className="block w-full"
    />
  )
}

/** The mail's HTML when it has some, else its plain text. */
export default function MailBody({ html, text }: { html?: string | null; text?: string }) {
  if (html) return <HtmlBody html={html} />
  return <div className="max-w-3xl text-[15px] leading-relaxed whitespace-pre-line">{text}</div>
}
