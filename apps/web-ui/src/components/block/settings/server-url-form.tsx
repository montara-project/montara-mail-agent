import React from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  checkServer,
  DEFAULT_SERVER_URL,
  normalizeServerURL,
  SERVER_URL,
  switchServer,
} from '@/lib/api/server-url'

/**
 * The Montara server this Community Edition browser uses: the one serving this
 * app, or another one. Switching checks the server answers, then signs out.
 */
export function ServerURLForm({
  onCancel,
  autoFocus,
}: {
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const [url, setUrl] = React.useState(SERVER_URL)
  const [checking, setChecking] = React.useState(false)
  const next = normalizeServerURL(url)
  const valid = /^https?:\/\/[^\s/]+/.test(next)

  const save = async (target: string | null) => {
    setChecking(true)
    try {
      if (target) await checkServer(target)
      switchServer(target)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      setChecking(false)
    }
  }

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && next !== SERVER_URL) void save(next)
      }}
    >
      <Field>
        <FieldLabel htmlFor="server-url">Server URL</FieldLabel>
        <Input
          id="server-url"
          variant="lg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus={autoFocus}
          inputMode="url"
          autoComplete="url"
          placeholder={DEFAULT_SERVER_URL}
        />
        <FieldDescription>
          Where your Montara server runs, e.g. https://mail.example.com. The default is{' '}
          {DEFAULT_SERVER_URL}. Switching signs you out; sign in with your account on that server.
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={checking || !valid || next === SERVER_URL}>
          {checking ? 'Checking...' : 'Use this server'}
        </Button>
        {SERVER_URL !== DEFAULT_SERVER_URL && (
          <Button type="button" variant="outline" disabled={checking} onClick={() => save(null)}>
            Use the default
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" disabled={checking} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

export default function ServerSettings() {
  return (
    <SectionCard
      title="Self hosted"
      description={
        SERVER_URL === DEFAULT_SERVER_URL
          ? `This browser uses the server that serves this app, ${SERVER_URL}.`
          : `This browser uses another server, ${SERVER_URL}.`
      }
    >
      <ServerURLForm />
    </SectionCard>
  )
}
