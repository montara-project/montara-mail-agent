import { useMutation } from '@tanstack/react-query'
import { Minus, X } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import Hint from '@/components/block/common/hint'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastProgress } from '@/lib/api/axios-error'
import { parseRecipients, recipientProblem } from '@/lib/api/dtos/mail/recipients'
import { queries } from '@/lib/api/queries'

import type { Draft, Reply } from './mail-editor'

const MailEditor = React.lazy(() => import('./mail-editor'))

const EMPTY = { to: '', cc: '', subject: '' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border/60 grid grid-cols-[3.5rem_1fr] items-center gap-2.5 border-b px-[18px] py-[11px]">
      <span className="text-ink-3 text-[11.5px] font-semibold">{label}</span>
      {children}
    </div>
  )
}

/** The design's borderless field: the row border does the framing. */
const bareField =
  'h-auto border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-0'

/**
 * A new mail from one of the organization's accounts. It closes only through
 * its own buttons: Close (or Escape in the editor) keeps the draft for the
 * next open, Discard drops it. A stray click outside or Escape would otherwise lose the text.
 */
export default function ComposeSheet({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The accounts it can send from. */
  accounts?: Models.EmailAccount[]
  /** The mailbox open behind it, picked until the user picks another. */
  defaultAccountId?: string
}) {
  const [from, setFrom] = React.useState<string>()
  const [fields, setFields] = React.useState(EMPTY)
  const [showCc, setShowCc] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [attachments, setAttachments] = React.useState<File[]>([])
  const send = useMutation(queries.emailAccounts.send())
  const { mask } = useHideEmails()

  const fromId = from ?? defaultAccountId
  // Stable while open: the editor reloads its content whenever this changes.
  const initial = React.useMemo(() => (draft ? { state: draft.state } : {}), [draft])

  const field = (key: keyof typeof EMPTY) => ({
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value })),
  })

  const discard = () => {
    setFields(EMPTY)
    setDraft(null)
    setShowCc(false)
    setProblem(null)
    setAttachments([])
    onOpenChange(false)
  }

  const submit = (body: Reply) => {
    const to = parseRecipients(fields.to)
    const cc = parseRecipients(fields.cc)
    const found = fromId ? recipientProblem(to, cc) : 'Connect an email account to send from.'
    setProblem(found)
    if (found) return

    const progress = toastProgress('Sending...')
    send.mutate(
      {
        accountId: fromId!,
        body: {
          to,
          cc: cc.length > 0 ? cc : undefined,
          subject: fields.subject.trim(),
          text: body.text,
          html: body.html,
          attachments,
        },
      },
      {
        onSuccess: () => {
          progress.success('Mail sent')
          discard()
        },
        onError: progress.error,
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        size="xl"
        showCloseButton={false}
        className="bg-card w-full gap-0"
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-[18px] py-[13px]">
          <SheetTitle className="text-sm font-bold">New message</SheetTitle>
          <div className="flex items-center gap-1.5">
            <Hint label="Close and keep the draft">
              <Button
                variant="ghost"
                size="icon"
                className="bg-muted hover:bg-accent size-6 rounded-md shadow-none [&_svg]:size-3"
                aria-label="Close and keep the draft"
                onClick={() => onOpenChange(false)}
              >
                <Minus />
              </Button>
            </Hint>
            <Hint label="Discard draft">
              <Button
                variant="ghost"
                size="icon"
                className="bg-muted hover:bg-accent size-6 rounded-md shadow-none [&_svg]:size-3"
                aria-label="Discard draft"
                disabled={send.isPending}
                onClick={discard}
              >
                <X />
              </Button>
            </Hint>
          </div>
        </SheetHeader>
        <div className="border-border/60 grid border-b">
          <Row label="From">
            {accounts?.length ? (
              <Select value={fromId} onValueChange={setFrom} indicatorPosition="right">
                <SelectTrigger
                  aria-label="From"
                  className="h-auto w-full justify-start gap-2 border-0 bg-transparent p-0 text-[12.5px] shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-start [&>span]:break-all"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {mask(
                        account.label === account.email
                          ? account.email
                          : `${account.label} <${account.email}>`
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-muted-foreground text-[12.5px]">
                No email account connected
              </span>
            )}
          </Row>
          <Row label="To">
            <div className="flex items-center gap-2">
              <Input
                aria-label="To"
                placeholder="name@example.com, other@example.com"
                autoComplete="off"
                className={bareField}
                {...field('to')}
              />
              {!showCc && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-auto px-1 py-0.5 text-[11.5px] font-semibold"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              )}
            </div>
          </Row>
          {showCc && (
            <Row label="Cc">
              <Input aria-label="Cc" autoComplete="off" className={bareField} {...field('cc')} />
            </Row>
          )}
          <Row label="Subject">
            <Input aria-label="Subject" className={bareField} {...field('subject')} />
          </Row>
          {problem && (
            <p role="alert" className="text-destructive text-sm">
              {problem}
            </p>
          )}
        </div>
        {/* The editor takes the rest of the sheet; its text scrolls on its own. */}
        <div className="min-h-0 flex-1 px-[18px] py-4">
          <React.Suspense
            fallback={
              <div className="grid gap-2" aria-busy="true">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-28 w-full" />
              </div>
            }
          >
            <MailEditor
              fill
              initial={initial}
              placeholder="Write your message..."
              cancelLabel="Save draft"
              onCancel={(next) => {
                setDraft(next)
                onOpenChange(false)
              }}
              onSend={submit}
              sending={send.isPending}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </React.Suspense>
        </div>
      </SheetContent>
    </Sheet>
  )
}
