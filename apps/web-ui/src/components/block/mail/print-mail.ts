import { format } from 'date-fns'

import type { Models } from '@/lib/api/models'

import { senderName } from '@/components/layout/mail/mail-data'

import { CSP } from './mail-body'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const contacts = (list: Models.MailContact[]) =>
  list.map((c) => escape(c.name ? `${c.name} <${c.email}>` : c.email)).join(', ')

/**
 * Prints one mail on its own, from a hidden frame holding its header and
 * body, so the app around it stays off the page. The frame runs no scripts;
 * allow-modals is what lets it open the print dialog.
 */
export function printMail(mail: Models.Mail) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'

  const sender = escape(
    mail.from_name ? `${mail.from_name} <${mail.from_email}>` : senderName(mail)
  )
  const body = mail.body_html
    ? mail.body_html
    : `<div style="white-space:pre-wrap">${escape(mail.body ?? '')}</div>`
  frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${escape(mail.subject || 'Email')}</title>
<style>
  body { margin: 24px; color: #000; font: 14px/1.5 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  .meta { color: #444; font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 12px; margin-bottom: 16px; }
  img { max-width: 100%; height: auto; }
</style>
<h1>${escape(mail.subject || '(no subject)')}</h1>
<div class="meta">
  <div><b>From:</b> ${sender}</div>
  ${mail.to.length ? `<div><b>To:</b> ${contacts(mail.to)}</div>` : ''}
  ${mail.cc.length ? `<div><b>Cc:</b> ${contacts(mail.cc)}</div>` : ''}
  <div><b>Date:</b> ${escape(format(new Date(mail.received_at), 'PPpp'))}</div>
</div>
${body}`

  // load fires once images are in, so they make it onto the page.
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) return frame.remove()
    win.addEventListener('afterprint', () => frame.remove(), { once: true })
    win.print()
  }
  document.body.appendChild(frame)
}
