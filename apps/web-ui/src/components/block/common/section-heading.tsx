/** A section's title and description, above its card, with an optional action. */
export default function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end gap-4">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <h2 className="text-2xl font-bold tracking-[-0.4px]">{title}</h2>
        <p className="text-muted-foreground text-[13px] text-pretty">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
