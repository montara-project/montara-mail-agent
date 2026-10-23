import {
  boldExtension,
  createEditorSystem,
  historyExtension,
  htmlExtension,
  italicExtension,
  listExtension,
  markdownExtension,
  RichText,
  underlineExtension,
} from '@lexkit/editor'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import {
  ArrowUp,
  AudioLines,
  Bold,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  Plus,
  Underline,
} from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Lexical and LexKit are large; ReplyComposer loads this module only when a reply is opened.

const extensions = [
  boldExtension,
  italicExtension,
  underlineExtension,
  listExtension,
  historyExtension,
  markdownExtension,
  htmlExtension,
] as const

const { Provider, useEditor } = createEditorSystem<typeof extensions>()

// Tailwind's preflight strips list and text styles, so Lexical's nodes get them back here.
const theme = {
  list: { ul: 'list-disc pl-5', ol: 'list-decimal pl-5' },
  text: { bold: 'font-semibold', italic: 'italic', underline: 'underline' },
}

/** An unsent reply: the Lexical state, so formatting survives, plus its text for the one-line view. */
export type Draft = { state: string; preview: string }

/** A reply ready to send: Markdown for the text part, HTML for the formatted one. */
export type Reply = { text: string; html: string }

export type EditorBodyProps = {
  /** A saved draft, or a picked suggestion to start from. */
  initial: { state?: string; text?: string }
  onMinimize: (draft: Draft | null) => void
  onSend: (reply: Reply) => void
  /** True while a reply is on its way; sending is off meanwhile. */
  sending?: boolean
  /** The empty editor's hint; the reply box's by default. */
  placeholder?: string
}

function EditorBody({
  initial,
  onMinimize,
  onSend,
  sending,
  placeholder = 'Write your reply...',
}: EditorBodyProps) {
  const { commands, activeStates, lexical: editor } = useEditor()
  const [empty, setEmpty] = React.useState(!(initial.state || initial.text))

  // Load the draft or suggestion once, then put the caret at the end. The
  // composer remounts the editor on every open, so this runs per open.
  React.useEffect(() => {
    if (!editor) return
    if (initial.state) {
      editor.setEditorState(editor.parseEditorState(initial.state))
    } else if (initial.text) {
      const text = initial.text
      editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode(text)))
      })
    }
    editor.focus(undefined, { defaultSelection: 'rootEnd' })
    return editor.registerUpdateListener(({ editorState }) =>
      editorState.read(() => setEmpty($getRoot().getTextContent().trim() === ''))
    )
  }, [editor, initial])

  const minimize = () => {
    if (!editor) return onMinimize(null)
    const state = editor.getEditorState()
    const preview = state.read(() => $getRoot().getTextContent().trim())
    onMinimize(preview ? { state: JSON.stringify(state.toJSON()), preview } : null)
  }

  const format = [
    { label: 'Bold', icon: Bold, active: activeStates.bold, run: commands.toggleBold },
    { label: 'Italic', icon: Italic, active: activeStates.italic, run: commands.toggleItalic },
    { label: 'Underline', icon: Underline, active: activeStates.underline, run: commands.toggleUnderline },
    { label: 'Bullet list', icon: List, active: activeStates.unorderedList, run: commands.toggleUnorderedList },
    { label: 'Numbered list', icon: ListOrdered, active: activeStates.orderedList, run: commands.toggleOrderedList },
  ]

  const send = () => {
    if (!empty && !sending) onSend({ text: commands.exportToMarkdown(), html: commands.exportToHTML() })
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send()
        if (event.key === 'Escape') minimize()
      }}
    >
      <div className="flex items-center gap-0.5 border-b px-1 pb-1.5">
        {format.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-7', item.active && 'bg-accent')}
            aria-label={item.label}
            aria-pressed={item.active}
            title={item.label}
            onClick={() => item.run()}
          >
            <item.icon />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label="Minimize, keeping the draft"
          title="Minimize (Esc)"
          onClick={minimize}
        >
          <ChevronDown />
        </Button>
      </div>
      {/* Placed by hand: richTextExtension would render it after the footer. */}
      <RichText
        placeholder={placeholder}
        classNames={{
          container: 'relative pt-1.5',
          contentEditable: 'max-h-60 min-h-24 overflow-y-auto px-2 py-1.5 text-sm outline-none',
          placeholder: 'text-muted-foreground pointer-events-none absolute top-3 left-2 text-sm',
        }}
      />
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Attach file" title="Attach file">
          <Plus />
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Voice input" title="Voice input">
            <AudioLines />
          </Button>
          <Button
            type="button"
            size="icon"
            className="size-8"
            aria-label="Send"
            title="Send (Ctrl+Enter)"
            aria-busy={sending}
            disabled={empty || sending}
            onClick={send}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The opened reply editor: LexKit's provider around the toolbar, editable area and footer. */
export default function ReplyEditor(props: EditorBodyProps) {
  return (
    <Provider extensions={extensions} config={{ theme }}>
      <EditorBody {...props} />
    </Provider>
  )
}
