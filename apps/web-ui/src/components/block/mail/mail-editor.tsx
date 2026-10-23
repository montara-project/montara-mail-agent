import {
  boldExtension,
  createEditorSystem,
  historyExtension,
  htmlExtension,
  italicExtension,
  listExtension,
  markdownExtension,
  RichText,
  strikethroughExtension,
  underlineExtension,
} from '@lexkit/editor'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { Bold, Italic, List, ListOrdered, Loader2, Strikethrough, Underline } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Lexical and LexKit are large; the reply and compose views load this module only when opened.

const extensions = [
  boldExtension,
  italicExtension,
  underlineExtension,
  strikethroughExtension,
  listExtension,
  historyExtension,
  markdownExtension,
  htmlExtension,
] as const

const { Provider, useEditor } = createEditorSystem<typeof extensions>()

// Tailwind's preflight strips list and text styles, so Lexical's nodes get them back here.
const theme = {
  list: { ul: 'list-disc pl-5', ol: 'list-decimal pl-5' },
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
  },
}

/** An unsent mail: the Lexical state, so formatting survives, plus its text for a one-line view. */
export type Draft = { state: string; preview: string }

/** A mail ready to send: Markdown for the text part, HTML for the formatted one. */
export type Reply = { text: string; html: string }

export type MailEditorProps = {
  /** A saved draft, or text to start from (a picked suggestion). A new object reloads it. */
  initial: { state?: string; text?: string }
  onSend: (reply: Reply) => void
  /** Cancel or Escape, with what was written so far (null when empty). */
  onCancel: (draft: Draft | null) => void
  /** True while the mail is on its way; sending is off meanwhile. */
  sending?: boolean
  placeholder?: string
  cancelLabel?: string
  /** Above the text, e.g. the recipients. */
  header?: React.ReactNode
  /** First in the bottom bar, before the formatting buttons, e.g. the AI menu. */
  leading?: React.ReactNode
  /** Fill the parent's height, the text growing to meet the bottom bar (compose). */
  fill?: boolean
}

function EditorBody({
  initial,
  onSend,
  onCancel,
  sending,
  placeholder = 'Write your message...',
  cancelLabel = 'Cancel',
  header,
  leading,
  fill,
}: MailEditorProps) {
  const { commands, activeStates, lexical: editor } = useEditor()
  const [empty, setEmpty] = React.useState(!(initial.state || initial.text))

  // Load the draft or the starting text, then put the caret at the end.
  React.useEffect(() => {
    if (!editor) return
    if (initial.state) {
      editor.setEditorState(editor.parseEditorState(initial.state))
    } else if (initial.text) {
      const text = initial.text
      editor.update(() => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode(text)))
      })
    }
    editor.focus(undefined, { defaultSelection: 'rootEnd' })
    return editor.registerUpdateListener(({ editorState }) =>
      editorState.read(() => setEmpty($getRoot().getTextContent().trim() === ''))
    )
  }, [editor, initial])

  const cancel = () => {
    if (!editor) return onCancel(null)
    const state = editor.getEditorState()
    const preview = state.read(() => $getRoot().getTextContent().trim())
    onCancel(preview ? { state: JSON.stringify(state.toJSON()), preview } : null)
  }

  const send = () => {
    if (!empty && !sending)
      onSend({ text: commands.exportToMarkdown(), html: commands.exportToHTML() })
  }

  const format = [
    { label: 'Bold', icon: Bold, active: activeStates.bold, run: commands.toggleBold },
    { label: 'Italic', icon: Italic, active: activeStates.italic, run: commands.toggleItalic },
    {
      label: 'Underline',
      icon: Underline,
      active: activeStates.underline,
      run: commands.toggleUnderline,
    },
    {
      label: 'Strikethrough',
      icon: Strikethrough,
      active: activeStates.strikethrough,
      run: commands.toggleStrikethrough,
    },
    {
      label: 'Bullet list',
      icon: List,
      active: activeStates.unorderedList,
      run: commands.toggleUnorderedList,
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      active: activeStates.orderedList,
      run: commands.toggleOrderedList,
    },
  ]

  return (
    <div
      className={cn('flex flex-col gap-3', fill && 'h-full')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send()
        if (event.key === 'Escape') cancel()
      }}
    >
      {header}
      {/* Placed by hand: richTextExtension would render it after the footer. */}
      <RichText
        placeholder={placeholder}
        classNames={{
          container: cn('relative', fill && 'min-h-0 flex-1'),
          contentEditable: cn(
            'overflow-y-auto py-1 text-sm leading-relaxed outline-none',
            fill ? 'h-full' : 'max-h-80 min-h-32'
          ),
          // Same padding, size and line height as the text, so the hint sits
          // exactly where the first typed line and the caret appear.
          placeholder:
            'text-muted-foreground pointer-events-none absolute inset-x-0 top-0 truncate py-1 text-sm leading-relaxed select-none',
        }}
        // LexKit sets top, left and color inline, which would beat the
        // classes above; undefined drops them.
        styles={{ placeholder: { top: undefined, left: undefined, color: undefined } }}
      />
      <div className="flex flex-wrap items-center gap-1">
        {leading && <div className="mr-2">{leading}</div>}
        {format.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground size-8',
              item.active && 'bg-accent text-foreground'
            )}
            aria-label={item.label}
            aria-pressed={item.active}
            title={item.label}
            onClick={() => item.run()}
          >
            <item.icon />
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={cancel} title="Esc">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            title="Send (Ctrl+Enter)"
            aria-busy={sending}
            disabled={empty || sending}
            onClick={send}
          >
            {sending && <Loader2 className="animate-spin motion-reduce:animate-none" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The rich-text mail editor: LexKit's provider around the optional header, the text and the bottom bar. */
export default function MailEditor(props: MailEditorProps) {
  return (
    <Provider extensions={extensions} config={{ theme }}>
      <EditorBody {...props} />
    </Provider>
  )
}
