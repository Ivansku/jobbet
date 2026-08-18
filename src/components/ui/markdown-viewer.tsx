'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

// Skrivskyddad motsvarighet till MarkdownEditor — samma extensions och samma
// .md-editor-typografi, men editable: false så innehållet visas formaterat
// (rubriker, fetstil, listor) istället för som rå markdown-text.
export function MarkdownViewer({ value, className = '' }: { value: string; className?: string }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown.configure({ html: false, linkify: true, breaks: false })],
    content: value,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `md-editor text-sm ${className}`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.storage.markdown.getMarkdown() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null
  return <EditorContent editor={editor} />
}
