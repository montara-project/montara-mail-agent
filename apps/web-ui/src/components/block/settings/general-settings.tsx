import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { UpdateProfileSchema } from '@/lib/api/dtos/settings/profile/schema'
import { queries } from '@/lib/api/queries'
import { DEFAULT_TIMEZONE, TIMEZONES, timezoneLabel } from '@/lib/constants/timezones'
import { clock, monthDay } from '@/lib/date'

// Built once: the labels carry each zone's offset as of page load.
const TIMEZONE_OPTIONS = TIMEZONES.map((zone) => ({ value: zone, label: timezoneLabel(zone) }))

function ProfileForm({ user }: { user: Models.User }) {
  const update = useMutation(queries.profile.update())
  const { mask } = useHideEmails()

  const form = useAppForm({
    defaultValues: {
      name: user.name,
      image: user.image ?? '',
      timezone: user.metadata?.timezone ?? DEFAULT_TIMEZONE,
    },
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
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid gap-6 sm:grid-cols-[11.25rem_minmax(0,1fr)]">
        <div className="flex items-center justify-center gap-3 sm:flex-col">
          <Avatar className="size-16 sm:size-22">
            {/^https:\/\/\S+$/.test(image) && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="border-accent-ink/25 bg-accent-tint text-accent-ink text-2xl sm:text-[28px]">
              {mailInitials(name || user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1 sm:text-center">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="bg-muted text-muted-foreground rounded-md"
              onClick={() => document.getElementById('image')?.focus()}
            >
              <Upload className="size-3" />
              Change photo
            </Button>
            <p className="text-ink-3 text-xs">PNG or JPG, up to 2 MB.</p>
          </div>
        </div>
        <div className="grid gap-4">
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField asterisk label="Display name" autoComplete="name" />
            )}
          />
          <Field>
            <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
            <InputWrapper className="h-9.5 pointer-coarse:h-11">
              <Input id="profile-email" name="email" value={mask(user.email)} readOnly />
            </InputWrapper>
            <FieldDescription>Changing this requires verifying the new address.</FieldDescription>
          </Field>
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
          <div className="grid gap-2">
            <form.AppField
              name="timezone"
              children={(field) => (
                <field.ComboboxField
                  label="Timezone"
                  placeholder="Pick a timezone"
                  searchPlaceholder="Search timezones..."
                  emptyText="No timezone matches."
                  options={TIMEZONE_OPTIONS}
                />
              )}
            />
            <FieldDescription>The clock in the header shows the time here.</FieldDescription>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-3 text-[11px]">
          Last saved on {monthDay(new Date(user.updated_at), true)} at{' '}
          {clock(new Date(user.updated_at))}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Cancel
          </Button>
          <form.AppForm>
            <form.SubmitButton label="Save changes" />
          </form.AppForm>
        </div>
      </div>
    </form>
  )
}

/** The signed-in user's name and avatar. */
export default function GeneralSettings() {
  const { data: me, isPending } = useQuery(queries.auth.profile())

  return (
    <div className="grid gap-4">
      {/* The page head sits above the card, as the design wires it. */}
      <SectionHeading
        title="My Profile"
        description="How you appear across Montara Mail and to the agents that read your mail."
      />
      <SectionCard>
        {isPending || !me?.user ? (
          <div className="grid gap-6 sm:grid-cols-[11.25rem_minmax(0,1fr)]">
            <Skeleton className="size-24 justify-self-center" />
            <div className="grid gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : (
          // Remounted when the saved profile changes, so the fields start from it.
          <ProfileForm key={me.user.updated_at} user={me.user} />
        )}
      </SectionCard>
    </div>
  )
}
