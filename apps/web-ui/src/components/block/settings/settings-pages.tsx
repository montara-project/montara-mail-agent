import SectionHeading from '@/components/block/common/section-heading'
import { SettingsPage } from '@/components/block/common/settings-card'
import ActivityLogList from '@/components/block/settings/activity-log'
import OrganizationList from '@/components/block/settings/organization-list'
import PasskeyList from '@/components/block/settings/passkey-list'
import PasswordSettings from '@/components/block/settings/password-form'
import ServerSettings from '@/components/block/settings/server-url-form'
import SessionList from '@/components/block/settings/session-list'
import TOTPSettings from '@/components/block/settings/totp-settings'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { COMMUNITY } from '@/lib/constants/edition'

export function SecuritySettings() {
  return (
    <SettingsPage>
      <SectionHeading
        title="Security"
        description="Password, passkeys, two-factor authentication, where you are signed in and the activity on your account."
      />
      <div className="grid gap-5">
        <PasswordSettings />
        <PasskeyList />
        <TOTPSettings />
        <SessionList />
        <ActivityLogList title="Activity log" description="Sign-ins and changes to your account" />
      </div>
    </SettingsPage>
  )
}

export function OrganizationPageSettings() {
  const { organization } = useActiveOrganization()

  return (
    <SettingsPage>
      <SectionHeading
        title="Organization"
        description="Every organization you belong to, plus the audit trail of what changed."
      />
      <div className="grid gap-5">
        <OrganizationList />
        {/* The Community Edition has one user; only it can choose its server. */}
        {COMMUNITY && <ServerSettings />}
        {organization && (
          <ActivityLogList
            title="Audit log"
            description="Every change made in the organization"
            organizationId={organization.id}
          />
        )}
      </div>
    </SettingsPage>
  )
}
