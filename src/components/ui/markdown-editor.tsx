'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

export function MarkdownEditor({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      // html: false — inkommande text tolkas aldrig som HTML, bara som markdown-syntax.
      // Håller redigeringen fri från XSS-risk utan att det kostar någon av de
      // funktioner (rubriker, fetstil, listor, länkar) vi faktiskt vill stödja.
      Markdown.configure({ html: false, linkify: true, breaks: false }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'md-editor min-h-[4.5rem] text-sm focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown())
    },
  })

  return (
    <div className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/40">
      <EditorContent editor={editor} />
    </div>
  )
}
