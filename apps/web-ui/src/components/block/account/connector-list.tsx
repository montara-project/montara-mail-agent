import { IconServer } from '@tabler/icons-react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import gmailLogo from '@/assets/connectors/gmail.svg'
import icloudLogo from '@/assets/connectors/icloud.svg'
import outlookLogo from '@/assets/connectors/outlook.svg'
import yahooLogo from '@/assets/connectors/yahoo.svg'

// Brand logos from thesvg.org; IMAP has no brand, so it keeps a generic icon.
const CONNECTORS = [
  { id: 'gmail', name: 'Gmail', description: 'Google and Workspace mail', logo: gmailLogo },
  { id: 'outlook', name: 'Outlook', description: 'Outlook.com and Microsoft 365', logo: outlookLogo },
  { id: 'yahoo', name: 'Yahoo', description: 'Yahoo Mail', logo: yahooLogo },
  { id: 'icloud', name: 'iCloud', description: 'iCloud Mail', logo: icloudLogo },
  { id: 'imap', name: 'IMAP', description: 'Any provider with IMAP/SMTP' },
]

/** Providers a mailbox can be connected from. */
export default function ConnectorList() {
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
          // ponytail: no endpoint to connect a mailbox yet; open the provider's OAuth/IMAP flow once it exists.
          <button
            key={connector.id}
            type="button"
            onClick={() => toast.info(`Connecting ${connector.name} is not available yet`)}
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]"
          >
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              {connector.logo ? (
                <img src={connector.logo} alt="" className="size-6 object-contain" />
              ) : (
                <IconServer className="size-5" />
              )}
            </div>
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-semibold">{connector.name}</span>
              <span className="text-muted-foreground truncate text-xs">{connector.description}</span>
            </div>
            <Plus className="text-muted-foreground size-4" />
          </button>
        ))}
      </div>
    </section>
  )
}
