import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { OrganizationFormSchema } from '@/lib/api/dtos/organization/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { UpdateProfileSchema } from '@/lib/api/dtos/settings/profile/schema'
import { queries } from '@/lib/api/queries'

function ProfileForm({ user }: { user: Models.User }) {
  const update = useMutation(queries.profile.update())
  const { mask } = useHideEmails()

  const form = useAppForm({
    defaultValues: { name: user.name, image: user.image ?? '' },
    validators: { onSubmit: UpdateProfileSchema, onChange: UpdateProfileSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync(parseDto(UpdateProfileSchema, value))
        toast.success('Profile saved')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })
  const { name, image } = useStore(form.store, (state) => state.values)

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid gap-6 sm:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="flex items-center justify-center gap-3 sm:flex-col sm:text-center">
          <Avatar className="size-14 sm:size-20">
            {/^https:\/\/\S+$/.test(image) && <AvatarImage src={image} alt="" />}
            <AvatarFallback>{mailInitials(name || user.email)}</AvatarFallback>
          </Avatar>
          <div className="grid w-full min-w-0 text-sm">
            <span className="truncate font-medium">{name || mask(user.email)}</span>
            <span className="text-muted-foreground truncate">{mask(user.email)}</span>
          </div>
        </div>
        <div className="grid gap-4">
          <form.AppField
            name="name"
            children={(field) => <field.TextField asterisk label="Name" autoComplete="name" />}
          />
          <div className="grid gap-2">
            <form.AppField
              name="image"
              children={(field) => (
                <field.TextField
                  label="Avatar URL"
                  placeholder="https://example.com/me.png"
                  inputMode="url"
                  aria-describedby="avatar-url-hint"
                />
              )}
            />
            <FieldDescription id="avatar-url-hint">
              Leave empty to show your initials.
            </FieldDescription>
          </div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <form.AppForm>
          <form.SubmitButton label="Save" />
        </form.AppForm>
      </div>
    </form>
  )
}

function OrganizationForm({ organization }: { organization: Models.Organization }) {
  const update = useMutation(queries.organizations.update(organization.id))

  const form = useAppForm({
    defaultValues: { name: organization.name },
    validators: { onSubmit: OrganizationFormSchema, onChange: OrganizationFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync(parseDto(OrganizationFormSchema, value))
        toast.success('Organization renamed')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="name"
        children={(field) => <field.TextField asterisk label="Organization name" />}
      />
      <FieldDescription>Only the organization's owner can rename it.</FieldDescription>
      <div>
        <form.AppForm>
          <form.SubmitButton label="Save" />
        </form.AppForm>
      </div>
    </form>
  )
}

/** The signed-in user's name and avatar. */
export default function GeneralSettings() {
  const { data: me, isPending } = useQuery(queries.auth.profile())

  return (
    <div className="grid gap-4">
      <SectionCard title="Profile" description="How you appear in Montara.">
        {isPending || !me?.user ? (
          <div className="grid max-w-xl gap-4">
            <Skeleton className="h-14 w-60" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          // Remounted when the saved profile changes, so the fields start from it.
          <ProfileForm key={me.user.updated_at} user={me.user} />
        )}
      </SectionCard>
      <PrivacySettings />
    </div>
  )
}

/** Per browser: masks email addresses on screen, for screen sharing and demos. */
function PrivacySettings() {
  const { hidden, setHidden } = useHideEmails()

  return (
    <SectionCard title="Privacy" description="What this browser shows on screen.">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1 text-sm">
          <Label htmlFor="hide-emails">Hide email addresses</Label>
          <FieldDescription>
            Masks your addresses in the sidebar and the mail account switcher, so they stay private
            when you share your screen.
          </FieldDescription>
        </div>
        <Switch id="hide-emails" checked={hidden} onCheckedChange={setHidden} />
      </div>
    </SectionCard>
  )
}

/** The active organization's name. */
export function OrganizationSettings() {
  const { organization } = useActiveOrganization()

  return (
    <SectionCard title="Organization" description={organization?.name}>
      {organization ? (
        <OrganizationForm
          key={`${organization.id}:${organization.updated_at}`}
          organization={organization}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Create an organization first.</p>
      )}
    </SectionCard>
  )
}
