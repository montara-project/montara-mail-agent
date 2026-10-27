import type { Variants } from 'motion/react'

import { IconArrowLeft, IconKey, IconLoader2 } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import React from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { EmailAccountFormSchema } from '@/lib/api/dtos/account/email-account/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'

import type { Connector } from './connector-list'

const methodButtonClass =
  'bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50'

/**
 * Connecting a branded provider offers two ways in, picked in this dialog:
 * OAuth, where the provider grants Montara access after a sign-in at the
 * brand behind it (Google for Gmail, Microsoft for Outlook), or the provider's
 * app password over IMAP. The OAuth hand-off goes through the server, which
 * owns the client secrets, so the browser is sent to the consent URL the
 * server returns rather than to the provider directly.
 */
export default function ProviderConnectDialog({
  connector,
  onClose,
}: {
  connector: Connector
  onClose: () => void
}) {
  const { organization } = useActiveOrganization()
  const [method, setMethod] = React.useState<'choose' | 'app-password'>('choose')
  const reduceMotion = useReducedMotion()
  const oauthConnect = useMutation(
    queries.emailAccounts.oauthConnect(organization?.id ?? '', connector.id)
  )
  const create = useMutation(queries.emailAccounts.create(organization?.id ?? ''))
  const { mask } = useHideEmails()

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
    validators: { onSubmit: EmailAccountFormSchema, onChange: EmailAccountFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const dto = parseDto(EmailAccountFormSchema, value)
        const account = await create.mutateAsync({
          provider: connector.id,
          email: dto.email,
          password: dto.password,
          label: dto.label || undefined,
        })
        toast.success(`${mask(account.email)} connected; its mail is syncing`)
        onClose()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  // Each view leaves toward the side it entered from: choosing moves forward
  // (chooser exits left, form enters from the right), Back reverses it.
  const viewMotion = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.2, ease: 'easeOut' as const },
  }
  const formViewMotion = {
    ...viewMotion,
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 },
  }
  const formVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
  }
  const fieldVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  }

  function connectWithOAuth() {
    if (!organization) return
    oauthConnect.mutate(undefined, {
      onSuccess: (authUrl) => window.location.assign(authUrl),
      onError: toastAxiosError,
    })
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg gap-0 p-0">
        <AnimatePresence mode="wait" initial={false}>
          {method === 'choose' ? (
            <motion.div key="choose" {...viewMotion} className="p-6">
              <AlertDialogHeader>
                <AlertDialogTitle>Connect {connector.name}</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose how Montara signs in to your {connector.name} account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  disabled={!organization || oauthConnect.isPending}
                  onClick={connectWithOAuth}
                  className={methodButtonClass}
                >
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {oauthConnect.isPending ? (
                      <IconLoader2 className="size-1/2 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <img
                        src={connector.oauthLogo ?? connector.logo}
                        alt=""
                        className="size-1/2 object-contain"
                      />
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">Connect {connector.oauthName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      Sign in at {connector.oauthName} and let Montara read the mailbox
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!organization}
                  onClick={() => setMethod('app-password')}
                  className={methodButtonClass}
                >
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <IconKey className="size-1/2" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">App password</span>
                    <span className="text-muted-foreground truncate text-xs">
                      Sign in with your {connector.name} app password over IMAP
                    </span>
                  </span>
                </button>
              </div>
              <AlertDialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </AlertDialogFooter>
            </motion.div>
          ) : (
            <motion.form
              key="app-password"
              {...formViewMotion}
              className="flex flex-col p-6"
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Connect {connector.name}</AlertDialogTitle>
                <AlertDialogDescription>{connector.help}</AlertDialogDescription>
              </AlertDialogHeader>
              <motion.div
                variants={formVariants}
                initial="hidden"
                animate="show"
                className="mt-4 grid gap-4"
              >
                <motion.div variants={fieldVariants}>
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
                </motion.div>
                <motion.div variants={fieldVariants}>
                  <form.AppField
                    name="password"
                    children={(field) => (
                      <field.PasswordField
                        asterisk
                        label="App password"
                        placeholder="xxxx xxxx xxxx xxxx"
                      />
                    )}
                  />
                </motion.div>
                <motion.div variants={fieldVariants}>
                  <form.AppField
                    name="label"
                    children={(field) => <field.TextField label="Label" placeholder="e.g. Work" />}
                  />
                </motion.div>
                <motion.div variants={fieldVariants}>
                  <FieldDescription>
                    The password is stored encrypted and is only used to read this mailbox.
                  </FieldDescription>
                </motion.div>
              </motion.div>
              <AlertDialogFooter className="mt-6">
                <Button type="button" variant="ghost" onClick={() => setMethod('choose')}>
                  <IconArrowLeft />
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={create.isPending || !organization}
                >
                  {create.isPending && (
                    <IconLoader2 className="animate-spin motion-reduce:animate-none" />
                  )}
                  {create.isPending ? 'Connecting...' : 'Connect'}
                </Button>
              </AlertDialogFooter>
            </motion.form>
          )}
        </AnimatePresence>
      </AlertDialogContent>
    </AlertDialog>
  )
}
