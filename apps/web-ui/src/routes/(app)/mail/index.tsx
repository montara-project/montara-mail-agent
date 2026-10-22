import { createFileRoute } from '@tanstack/react-router'

type MailSearch = {
  folder?: string
}

/** The mail list lives in the sidebar (see AppSidebar); this is the reading pane. */
export const Route = createFileRoute('/(app)/mail/')({
  validateSearch: (search): MailSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
      Select an email to read it.
    </div>
  )
}
