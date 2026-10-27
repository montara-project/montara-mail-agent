import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { useActiveAgentBot } from '@/hooks/use-active-agent-bot'

/**
 * The persona choices inside a dropdown menu: the built-in assistant, then
 * the organization's bots. With keepOpen a pick leaves the menu open, so what
 * depends on it (the reply suggestions) reloads in place.
 */
export default function AgentBotRadioGroup({ keepOpen = false }: { keepOpen?: boolean }) {
  const { bots, activeBotId, setActiveBotId } = useActiveAgentBot()
  const onSelect = keepOpen ? (e: Event) => e.preventDefault() : undefined

  return (
    <DropdownMenuRadioGroup value={activeBotId} onValueChange={setActiveBotId}>
      <DropdownMenuRadioItem value="" onSelect={onSelect}>
        Built-in assistant
      </DropdownMenuRadioItem>
      {bots.map((bot) => (
        <DropdownMenuRadioItem key={bot.id} value={bot.id} onSelect={onSelect}>
          <span className="truncate">{bot.name}</span>
          {bot.is_default && <span className="text-muted-foreground ms-auto text-xs">Default</span>}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}
