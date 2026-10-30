import { useMutation } from '@tanstack/react-query'
import { Plus, Server } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import googleLogo from '@/assets/brands/google.svg'
import gmailLogo from '@/assets/connectors/gmail.svg'
import icloudLogo from '@/assets/connectors/icloud.svg'
import larkLogo from '@/assets/connectors/lark.svg'
import outlookLogo from '@/assets/connectors/outlook.svg'
import yahooLogo from '@/assets/connectors/yahoo.svg'
import zohoLogo from '@/assets/connectors/zoho.svg'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { FieldDescription } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  EmailAccountFormSchema,
  ImapAccountFormSchema,
} from '@/lib/api/dtos/account/email-account/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import ProviderConnectDialog from './provider-connect-dialog'

export type Connector = {
  id: Models.EmailProvider
  name: string
  description: string
  logo?: string
  /**
   * The brand a user signs in with over OAuth, e.g. a Gmail mailbox signs in
   * at Google. Empty for the providers with no OAuth sign-in: iCloud and
   * Lark offer none publicly, and IMAP is a protocol, not a brand.
   */
  oauthName?: string
  /** The OAuth button's logo; falls back to the tile's brand logo. */
  oauthLogo?: string
  /** Where the user gets the app password the connection signs in with. */
  help: string
}

// Brand logos from thesvg.org; IMAP has no brand, so it keeps a generic icon.
export const CONNECTORS: Connector[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Google and Workspace mail',
    logo: gmailLogo,
    oauthName: 'Google',
    oauthLogo: googleLogo,
    help: 'Turn on 2-Step Verification, then create an app password under Google Account › Security › App passwords.',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Outlook.com and Microsoft 365',
    logo: outlookLogo,
    oauthName: 'Microsoft',
    help: 'Create an app password under Microsoft account › Security › Advanced security options. Some Microsoft 365 organizations turn IMAP sign-in off.',
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    description: 'Yahoo Mail',
    logo: yahooLogo,
    oauthName: 'Yahoo',
    help: 'Create an app password under Yahoo Account Security › Generate app password.',
  },
  {
    id: 'icloud',
    name: 'iCloud',
    description: 'iCloud Mail',
    logo: icloudLogo,
    help: 'Create an app-specific password at account.apple.com › Sign-In and Security.',
  },
  {
    id: 'lark',
    name: 'Lark',
    description: 'Lark Mail',
    logo: larkLogo,
    help: 'In Lark Mail, open Settings › Third-party email client, turn on IMAP/SMTP, and generate a password for this device.',
  },
  {
    id: 'zoho',
    name: 'Zoho',
    description: 'Zoho Mail',
    logo: zohoLogo,
    oauthName: 'Zoho',
    help: 'Turn on IMAP access in Zoho Mail settings, then create an app password under Zoho Accounts › Security › App passwords. Custom-domain or non-US accounts: use IMAP with the servers shown in Zoho Mail settings.',
  },
  {
    id: 'imap',
    name: 'IMAP',
    description: 'Any provider with IMAP',
    help: 'Use the IMAP server your provider documents. The connection always uses TLS.',
  },
]

/** A provider's brand logo on a tile; custom IMAP gets a generic server icon. */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: Models.EmailProvider
  className?: string
}) {
  const logo = CONNECTORS.find((c) => c.id === provider)?.logo
  return (
    <span
      className={cn(
        'bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg',
        className
      )}
    >
      {logo ? (
        <img src={logo} alt="" className="size-3/5 object-contain" />
      ) : (
        <Server className="size-1/2" />
      )}
    </span>
  )
}

/** Connects one provider's mailbox: signs in over IMAP first, so a wrong password is caught here. */
function ConnectForm({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const { organization } = useActiveOrganization()
  const mutation = useMutation(queries.emailAccounts.create(organization?.id ?? ''))
  const { mask } = useHideEmails()
  const isImap = connector.id === 'imap'
  const schema = isImap ? ImapAccountFormSchema : EmailAccountFormSchema

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      label: '',
      imap_host: '',
      imap_port: '993',
      smtp_host: '',
      smtp_port: '465',
    },
    validators: { onSubmit: schema, onChange: schema },
    onSubmit: async ({ value }) => {
      try {
        const dto = parseDto(schema, value)
        const account = await mutation.mutateAsync({
          provider: connector.id,
          email: dto.email,
          password: dto.password,
          label: dto.label || undefined,
          ...(isImap && {
            imap_host: dto.imap_host,
            imap_port: Number(dto.imap_port),
            smtp_host: dto.smtp_host || undefined,
            smtp_port: Number(dto.smtp_port),
          }),
        })
        toast.success(`${mask(account.email)} connected; its mail is syncing`)
        onClose()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      title={`Connect ${connector.name}`}
      description={connector.help}
      confirmText="Connect"
      loading={mutation.isPending}
      disabled={!organization}
      size="md"
    >
      <div className="grid gap-4">
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              asterisk
              label="Email"
              type="email"
              autoComplete="off"
              placeholder="you@example.com"
            />
          )}
        />
        <form.AppField
          name="password"
          children={(field) => (
            <field.PasswordField asterisk label="App password" placeholder="xxxx xxxx xxxx xxxx" />
          )}
        />
        {isImap && (
          <>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <form.AppField
                name="imap_host"
                children={(field) => (
                  <field.TextField asterisk label="IMAP server" placeholder="imap.example.com" />
                )}
              />
              <form.AppField
                name="imap_port"
                children={(field) => <field.TextField asterisk label="Port" inputMode="numeric" />}
              />
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <form.AppField
                name="smtp_host"
                children={(field) => (
                  <field.TextField label="SMTP server" placeholder="smtp. + the IMAP server" />
                )}
              />
              <form.AppField
                name="smtp_port"
                children={(field) => <field.TextField label="Port" inputMode="numeric" />}
              />
            </div>
          </>
        )}
        <form.AppField
          name="label"
          children={(field) => <field.TextField label="Label" placeholder="e.g. Work" />}
        />
        <FieldDescription>
          The password is stored encrypted and is only used to read this mailbox.
        </FieldDescription>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** Providers a mailbox can be connected from. */
export default function ConnectorList() {
  const [connecting, setConnecting] = React.useState<Connector | null>(null)

  return (
    <section aria-labelledby="connectors-title" className="grid gap-3">
      <div>
        <h2 id="connectors-title" className="text-lg font-semibold">
          Connect an account
        </h2>
        <p className="text-muted-foreground text-sm">Add a mailbox from one of these providers.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CONNECTORS.map((connector) => (
          <button
            key={connector.id}
            type="button"
            onClick={() => setConnecting(connector)}
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]"
          >
            <ProviderIcon provider={connector.id} />
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-semibold">
                <span className="sr-only">Connect </span>
                {connector.name}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {connector.description}
              </span>
            </div>
            <Plus className="text-muted-foreground size-4" aria-hidden />
          </button>
        ))}
      </div>
      {connecting &&
        (connecting.oauthName ? (
          <ProviderConnectDialog
            key={connecting.id}
            connector={connecting}
            onClose={() => setConnecting(null)}
          />
        ) : (
          // IMAP is a protocol and iCloud and Lark offer no public IMAP
          // OAuth: they only have the app password way in, straight to the
          // form.
          <ConnectForm
            key={connecting.id}
            connector={connecting}
            onClose={() => setConnecting(null)}
          />
        ))}
    </section>
  )
}
