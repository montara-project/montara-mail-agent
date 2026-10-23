import { X } from 'lucide-react'
import React from 'react'

import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allEmails, parseRecipients } from '@/lib/api/dtos/mail/recipients'
import { cn } from '@/lib/utils'

type RecipientInputProps = {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  /** Names to show for known addresses, e.g. the mail's sender. */
  names?: Record<string, string>
  placeholder?: string
}

/**
 * Addresses as removable chips, with a box to type more. An address becomes a
 * chip on Enter, a comma, a space or leaving the box; Backspace in the empty
 * box removes the last chip. Invalid addresses stay as red chips, so the
 * mistake is visible where it was made.
 */
export default function RecipientInput({
  label,
  value,
  onChange,
  names = {},
  placeholder,
}: RecipientInputProps) {
  const id = React.useId()
  const [text, setText] = React.useState('')

  const commit = (raw: string) => {
    const added = parseRecipients(raw).filter((r) => !value.includes(r))
    if (added.length > 0) onChange([...value, ...added])
    setText('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label htmlFor={id} className="w-8 shrink-0 text-sm font-medium">
        {label}:
      </label>
      {value.map((address) => {
        const valid = allEmails([address])
        const name = names[address]
        return (
          <span
            key={address}
            title={valid ? address : `${address} is not a valid email`}
            className={cn(
              'bg-background flex h-8 items-center gap-1.5 rounded-md border pr-1 pl-1.5 text-sm',
              !valid && 'border-destructive text-destructive'
            )}
          >
            <Avatar className="size-5">
              <AvatarFallback className="text-[10px]">
                {mailInitials(name || address)}
              </AvatarFallback>
            </Avatar>
            {name || address}
            <button
              type="button"
              aria-label={`Remove ${name || address}`}
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
              onClick={() => onChange(value.filter((v) => v !== address))}
            >
              <X className="size-3.5" />
            </button>
          </span>
        )
      })}
      <input
        id={id}
        value={text}
        autoComplete="off"
        placeholder={value.length === 0 ? placeholder : undefined}
        className="placeholder:text-muted-foreground h-8 min-w-40 flex-1 bg-transparent text-sm outline-none"
        onChange={(e) =>
          // A separator typed at the end turns what came before into a chip.
          /[\s,;]$/.test(e.target.value) ? commit(e.target.value) : setText(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            e.preventDefault()
            commit(text)
          }
          if (e.key === 'Backspace' && text === '' && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => commit(text)}
      />
    </div>
  )
}
