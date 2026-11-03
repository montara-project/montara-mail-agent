import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Link } from 'lucide-react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsPage } from '@/components/block/common/settings-card'
import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

// The design's denser fields, for this form only: the shared fields stay as they
// are elsewhere, and touch screens keep their larger targets and 16px text.
const FIELDS =
  'grid gap-4 [&_[data-slot=field]]:gap-1.5 [&_[data-slot=field-label]]:text-xs [&_[data-slot=field-label]]:leading-4 [&_[data-slot=field-label]]:font-semibold pointer-fine:[&_[data-slot=input-wrapper]]:h-9.5 pointer-fine:[&_[role=combobox]]:h-9.5 pointer-fine:[&_[role=combobox]]:text-[0.84375rem] pointer-fine:[&_input]:text-[0.84375rem]'
const HINT = 'text-ink-3 text-[0.71875rem] leading-[0.875rem]'
const CARD_GRID = 'grid gap-6 sm:grid-cols-[11.25rem_minmax(0,1fr)]'

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
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <Card className="rounded-lg shadow-none">
        <CardContent className="p-4 sm:p-6">
          <div className={CARD_GRID}>
            <div className="flex items-center justify-center gap-3 self-start sm:flex-col sm:gap-2.5">
              <Avatar className="size-16 sm:size-22">
                {/^https:\/\/\S+$/.test(image) && <AvatarImage src={image} alt="" />}
                <AvatarFallback className="border-accent-ink/25 bg-accent-tint text-accent-ink text-2xl font-bold sm:text-[1.75rem]">
                  {mailInitials(name || user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-2.5 sm:justify-items-center sm:text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="bg-muted text-muted-foreground gap-1.5 rounded-md px-2.5 text-[0.78125rem] font-medium"
                  onClick={() => document.getElementById('image')?.focus()}
                >
                  <Link className="size-3" />
                  Edit avatar URL
                </Button>
              </div>
            </div>
            <div className={FIELDS}>
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField asterisk label="Display name" autoComplete="name" />
                )}
              />
              <div className="grid gap-1.5">
                <Field>
                  <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
                  <InputWrapper className="h-10 pointer-coarse:h-11">
                    <Input
                      id="profile-email"
                      name="email"
                      value={mask(user.email)}
                      readOnly
                      aria-describedby="profile-email-hint"
                      className="[&[readonly]]:bg-transparent"
                    />
                  </InputWrapper>
                </Field>
                <FieldDescription id="profile-email-hint" className={HINT}>
                  Changing this requires verifying the new address.
                </FieldDescription>
              </div>
              <div className="grid gap-1.5">
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
                <FieldDescription id="avatar-url-hint" className={HINT}>
                  Leave empty to show your initials.
                </FieldDescription>
              </div>
              <div className="grid gap-1.5">
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
                <FieldDescription className={HINT}>
                  The clock in the header shows the time here.
                </FieldDescription>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-3 text-[0.75rem]">
          Last saved on {monthDay(new Date(user.updated_at), true)} at{' '}
          {clock(new Date(user.updated_at))}
        </p>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="text-muted-foreground h-8.5 bg-transparent px-3.5 text-xs font-semibold shadow-none pointer-coarse:h-11"
            onClick={() => form.reset()}
          >
            Cancel
          </Button>
          <form.AppForm>
            <form.SubmitButton
              label="Save changes"
              icon={Check}
              className="h-8.5 gap-[0.4375rem] px-4 text-xs font-semibold pointer-coarse:h-11 [&_svg]:size-3.5"
            />
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
    <SettingsPage>
      {/* The page head sits above the card, as the design wires it. */}
      <SectionHeading
        title="My Profile"
        description="How you appear across Montara Mail and to the agents that read your mail."
      />
      {isPending || !me?.user ? (
        <Card className="rounded-lg shadow-none">
          <CardContent className="p-4 sm:p-6">
            <div className={CARD_GRID}>
              <Skeleton className="size-22 justify-self-center rounded-full" />
              <div className="grid gap-4">
                <Skeleton className="h-15" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Remounted when the saved profile changes, so the fields start from it.
        <ProfileForm key={me.user.updated_at} user={me.user} />
      )}
    </SettingsPage>
  )
}
