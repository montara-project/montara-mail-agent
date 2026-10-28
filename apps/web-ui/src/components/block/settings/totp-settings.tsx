import { useMutation, useQuery } from '@tanstack/react-query'
import { Copy, Download, KeyRound, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { SECURITY_QUERY_KEY } from '@/lib/api/queries/profile'
import { services } from '@/lib/api/services'
import { verifyTOTP } from '@/lib/auth/email-auth'
import { getQueryClient } from '@/lib/providers/react-query'

const refreshSecurity = () => getQueryClient().invalidateQueries({ queryKey: [SECURITY_QUERY_KEY] })

/** Backup codes, shown once: each signs in once when the phone is not at hand. */
function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join('\n')

  return (
    <div className="grid gap-3">
      <ul
        aria-label="Backup codes"
        className="bg-muted/40 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border p-3 font-mono text-sm sm:grid-cols-3"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(text).then(
              () => toast.success('Backup codes copied'),
              () => toast.error("Couldn't copy; select the codes instead.")
            )
          }
        >
          <Copy />
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(text + '\n')}`}
            download="montara-backup-codes.txt"
          >
            <Download />
            Download
          </a>
        </Button>
      </div>
    </div>
  )
}

/**
 * Turning it on: scan the code, keep the backup codes, then confirm with a
 * first code. Until then sign-in stays as it was, so a botched scan locks no
 * one out.
 */
function Setup({ setup, onClose }: { setup: Models.TOTPSetup; onClose: () => void }) {
  const [code, setCode] = React.useState('')
  const [verifying, setVerifying] = React.useState(false)
  const secret = React.useMemo(() => new URL(setup.totp_uri).searchParams.get('secret'), [setup])

  const confirm = async () => {
    setVerifying(true)
    try {
      // The answer is a fresh session; verifyTOTP keeps its tokens.
      await verifyTOTP({ code: code.trim() })
      await refreshSecurity()
      toast.success('Two-factor sign-in is on')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="grid max-w-xl gap-6">
      <section className="grid gap-3">
        <h3 className="font-medium">1. Scan the code</h3>
        <p className="text-muted-foreground text-sm">
          Use an authenticator app such as Google Authenticator, 1Password or Authy.
        </p>
        {/* White behind the code in both themes: scanners need the contrast. */}
        <div className="w-fit rounded-lg border bg-white p-3">
          <QRCodeSVG value={setup.totp_uri} size={176} title="Authenticator QR code" />
        </div>
        {secret && (
          <p className="text-sm">
            Can't scan it? Enter this key:{' '}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono break-all">{secret}</code>
          </p>
        )}
      </section>
      <section className="grid gap-3">
        <h3 className="font-medium">2. Save the backup codes</h3>
        <p className="text-muted-foreground text-sm">
          Keep them somewhere safe. Each one signs you in once if you lose your phone; they are not
          shown again.
        </p>
        <BackupCodes codes={setup.backup_codes} />
      </section>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) void confirm()
        }}
      >
        <h3 className="font-medium">3. Enter a code</h3>
        <Field>
          <FieldLabel htmlFor="totp-confirm">Code from the app</FieldLabel>
          <Input
            id="totp-confirm"
            variant="lg"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            className="max-w-48"
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={verifying || !code.trim()}>
            {verifying ? 'Verifying...' : 'Turn on'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={verifying}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Two-factor sign-in is on: replace the backup codes, or turn it off. */
function Enabled() {
  const [confirming, setConfirming] = React.useState<'codes' | 'disable' | null>(null)
  const [codes, setCodes] = React.useState<string[] | null>(null)
  const regenerate = useMutation({
    mutationFn: async () => (await services.auth.totpBackupCodes()).data.backup_codes,
    onSuccess: (next) => {
      setCodes(next)
      toast.success('New backup codes made; the old ones no longer work')
    },
    onError: toastAxiosError,
  })
  const disable = useMutation({
    mutationFn: () => services.auth.totpDisable(),
    onSuccess: async () => {
      await refreshSecurity()
      toast.success('Two-factor sign-in is off')
    },
    onError: toastAxiosError,
  })

  return (
    <div className="grid max-w-xl gap-4">
      <p className="text-sm">
        Signing in asks for a code from your authenticator app after the password, on every browser
        you don't mark as trusted.
      </p>
      {codes && <BackupCodes codes={codes} />}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={regenerate.isPending}
          onClick={() => setConfirming('codes')}
        >
          <KeyRound />
          New backup codes
        </Button>
        <Button
          variant="destructive"
          className="text-white"
          disabled={disable.isPending}
          onClick={() => setConfirming('disable')}
        >
          Turn off
        </Button>
      </div>
      <SimpleAlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'codes' ? 'Make new backup codes?' : 'Turn off two-factor sign-in?'}
        description={
          confirming === 'codes'
            ? 'The current backup codes stop working.'
            : 'Signing in will take only your password.'
        }
        confirmText={confirming === 'codes' ? 'Make new codes' : 'Turn off'}
        variant={confirming === 'codes' ? 'primary' : 'destructive'}
        onConfirm={() => (confirming === 'codes' ? regenerate.mutate() : disable.mutate())}
      />
    </div>
  )
}

/** Two-factor sign-in with an authenticator app (TOTP). */
export default function TOTPSettings() {
  const { data, isPending, isError, error } = useQuery(queries.profile.security())
  const [setup, setSetup] = React.useState<Models.TOTPSetup | null>(null)
  const enable = useMutation({
    mutationFn: async () => (await services.auth.totpEnable()).data,
    onSuccess: setSetup,
    onError: toastAxiosError,
  })
  const enabled = data?.totp_enabled

  const content = () => {
    if (isPending) {
      return (
        <div className="grid max-w-xl gap-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-10 w-32" />
        </div>
      )
    }
    if (isError) return <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
    if (enabled) return <Enabled />
    if (setup) return <Setup setup={setup} onClose={() => setSetup(null)} />
    return (
      <div className="grid max-w-xl gap-4">
        <p className="text-sm">
          With it on, someone who learns your password still can't sign in without your phone.
        </p>
        <div>
          <Button onClick={() => enable.mutate()} disabled={enable.isPending}>
            <ShieldCheck />
            {enable.isPending ? 'Starting...' : 'Set up'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SectionCard
      title="Two-factor authentication"
      description="A code from your phone on top of the password."
      toolbar={
        data && (
          <Badge variant={enabled ? 'success' : 'secondary'} appearance="light">
            {enabled ? 'On' : 'Off'}
          </Badge>
        )
      }
    >
      {content()}
    </SectionCard>
  )
}
