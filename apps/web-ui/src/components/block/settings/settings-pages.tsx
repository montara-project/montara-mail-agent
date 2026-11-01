import { Trash2, TriangleAlert } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import ActivityLogList from '@/components/block/settings/activity-log'
import OrganizationList from '@/components/block/settings/organization-list'
import PasswordSettings from '@/components/block/settings/password-form'
import ServerSettings from '@/components/block/settings/server-url-form'
import TOTPSettings from '@/components/block/settings/totp-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { COMMUNITY } from '@/lib/constants/edition'

/** A settings section that has no backend yet: a quiet tile, not a full card. */
function SoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-secondary rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" appearance="light" size="sm">
          Soon
        </Badge>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      <p className="text-ink-3 mt-2 text-xs">This isn't available yet.</p>
    </div>
  )
}

export function SecuritySettings() {
  return (
    <div className="grid gap-4">
      <SectionHeading
        title="Security"
        description="Password, two-factor authentication and the activity on your account."
      />
      <div className="grid gap-5">
        <PasswordSettings />
        <TOTPSettings />
        <ActivityLogList title="Activity log" description="Sign-ins and changes to your account." />
      </div>
    </div>
  )
}

export function OrganizationPageSettings() {
  const { organization } = useActiveOrganization()

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-bold">Organization</h1>
        <p className="text-muted-foreground text-[13px]">
          Every organization you belong to, plus the audit trail of what changed in it.
        </p>
      </div>
      <OrganizationList />
      {/* The Community Edition has one user; only it can choose its server. */}
      {COMMUNITY ? (
        <ServerSettings />
      ) : (
        <>
          <SoonCard
            title="Members"
            description="Invite people and manage who's in the organization."
          />
          <SoonCard title="Roles & permissions" description="What each member is allowed to do." />
        </>
      )}
      {organization && (
        <ActivityLogList
          title="Audit log"
          description="Every change made in the organization."
          organizationId={organization.id}
        />
      )}
    </div>
  )
}

export function DeleteAccountSettings() {
  return (
    <div className="grid gap-4">
      <SectionHeading
        title="Delete account"
        description="Permanently remove your account and all of its data. This can't be undone."
      />
      <div className="grid gap-5">
        <div className="border-destructive/20 bg-destructive/5 flex items-start gap-3.5 rounded-lg border p-4.5">
          <span className="bg-destructive/10 text-danger-soft grid size-9 shrink-0 place-items-center rounded-md">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <div className="grid gap-1">
            <h2 className="text-[13px] font-bold text-danger-soft">This action is permanent</h2>
            <p className="text-muted-foreground text-[11.5px] text-pretty">
              Deleting your account removes all mailboxes, messages, API keys, agent bots and
              billing history. Domains and mail delivered elsewhere stay untouched.
            </p>
          </div>
        </div>
        <SectionCard
          title="Confirm deletion"
          description="Type your account email to enable the button."
          toolbar={
            <Badge variant="secondary" appearance="light" size="sm">
              Soon
            </Badge>
          }
        >
          <div className="grid gap-3">
            <p className="text-ink-3 text-xs">This isn't available yet.</p>
            <div>
              <Button variant="destructive" disabled className="w-fit">
                <Trash2 />
                Delete account
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
