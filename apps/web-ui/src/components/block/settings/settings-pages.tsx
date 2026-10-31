import SectionCard from '@/components/block/common/section-card'
import ActivityLogList from '@/components/block/settings/activity-log'
import OrganizationList from '@/components/block/settings/organization-list'
import PasswordSettings from '@/components/block/settings/password-form'
import QuotaSettings from '@/components/block/settings/quota-settings'
import ServerSettings from '@/components/block/settings/server-url-form'
import TOTPSettings from '@/components/block/settings/totp-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { COMMUNITY } from '@/lib/constants/edition'

/** A settings section that has no backend yet. */
function SoonCard({ title, description }: { title: string; description: string }) {
  return (
    <SectionCard
      title={title}
      description={description}
      toolbar={
        <Badge variant="secondary" appearance="light">
          Soon
        </Badge>
      }
    >
      <p className="text-muted-foreground text-sm">This isn't available yet.</p>
    </SectionCard>
  )
}

export function SecuritySettings() {
  return (
    <div className="grid gap-4">
      <PasswordSettings />
      <TOTPSettings />
      <ActivityLogList title="Activity log" description="Sign-ins and changes to your account." />
    </div>
  )
}

export function OrganizationPageSettings() {
  const { organization } = useActiveOrganization()

  return (
    <div className="grid gap-4">
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

export function BillingSettings() {
  return <QuotaSettings />
}

export function DeleteAccountSettings() {
  return (
    <SectionCard
      title="Delete account"
      description="Permanently remove your account and its data. This can't be undone."
      toolbar={
        <Badge variant="secondary" appearance="light">
          Soon
        </Badge>
      }
    >
      <Button variant="destructive" disabled>
        Delete account
      </Button>
    </SectionCard>
  )
}
