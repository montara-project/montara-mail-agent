import { useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

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
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      {children}
    </div>
  )
}

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
        className="w-full gap-0"
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="flex-row items-center justify-between border-b p-4">
          <SheetTitle>New message</SheetTitle>
          <Button variant="ghost" size="sm" onClick={discard} disabled={send.isPending}>
            <Trash2 />
            Discard
          </Button>
        </SheetHeader>
        <div className="grid gap-3 border-b p-4">
          <Row label="From">
            {accounts?.length ? (
              <Select value={fromId} onValueChange={setFrom} indicatorPosition="right">
                <SelectTrigger aria-label="From" className="h-9">
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
              <span className="text-muted-foreground text-sm">No email account connected</span>
            )}
          </Row>
          <Row label="To">
            <div className="flex items-center gap-2">
              <Input
                aria-label="To"
                placeholder="name@example.com, other@example.com"
                autoComplete="off"
                {...field('to')}
              />
              {!showCc && (
                <Button variant="ghost" size="sm" onClick={() => setShowCc(true)}>
                  Cc
                </Button>
              )}
            </div>
          </Row>
          {showCc && (
            <Row label="Cc">
              <Input aria-label="Cc" autoComplete="off" {...field('cc')} />
            </Row>
          )}
          <Row label="Subject">
            <Input aria-label="Subject" {...field('subject')} />
          </Row>
          {problem && (
            <p role="alert" className="text-destructive text-sm">
              {problem}
            </p>
          )}
        </div>
        {/* The editor takes the rest of the sheet; its text scrolls on its own. */}
        <div className="min-h-0 flex-1 p-4">
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
              cancelLabel="Close"
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
