import SectionCard from '@/components/block/common/section-card'
import { OrganizationSettings } from '@/components/block/settings/general-settings'
import LLMProviderSettings from '@/components/block/settings/llm-provider-form'
import OrganizationList from '@/components/block/settings/organization-list'
import PasswordSettings from '@/components/block/settings/password-form'
import ServerSettings from '@/components/block/settings/server-url-form'
import TOTPSettings from '@/components/block/settings/totp-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
      <SoonCard
        title="Session management"
        description="See where you're signed in and sign out other devices."
      />
      <SoonCard title="API keys" description="Keys that let your scripts call the Montara API." />
      <SoonCard title="Connected apps" description="Apps you've given access to your account." />
      <SoonCard title="Activity log" description="Sign-ins and changes to your account." />
    </div>
  )
}

export function OrganizationPageSettings() {
  return (
    <div className="grid gap-4">
      <OrganizationSettings />
      <OrganizationList />
      {/* The Community Edition has one user and is its own server. */}
      {!COMMUNITY && (
        <>
          <SoonCard
            title="Members"
            description="Invite people and manage who's in the organization."
          />
          <SoonCard title="Roles & permissions" description="What each member is allowed to do." />
          <ServerSettings />
        </>
      )}
      <LLMProviderSettings />
      <SoonCard title="Audit logs" description="Every change made in the organization." />
    </div>
  )
}

export function BillingSettings() {
  return (
    <div className="grid gap-4">
      <SoonCard title="Billing" description="Who pays for the organization and how." />
      <SoonCard title="Plan & usage" description="Your plan and how much of it is used." />
      <SoonCard title="Payment methods" description="Cards and accounts you pay with." />
      <SoonCard title="Invoices" description="Download the invoices for each payment." />
      <SoonCard title="Usage reports" description="What was used in each billing period." />
      <SoonCard title="Billing history" description="Every charge and refund." />
    </div>
  )
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
