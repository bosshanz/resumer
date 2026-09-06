"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Undo2,
  Redo2,
} from "lucide-react";

export function RichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const change = useRef(onChange);
  const emitted = useRef(value);
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: { openOnClick: false },
      }),
      Markdown,
    ],
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "区块正文",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      const next = editor.getMarkdown();
      emitted.current = next;
      change.current(next);
    },
  });
  useEffect(() => {
    if (editor && value !== emitted.current) {
      emitted.current = value;
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }
  }, [editor, value]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold"),
      italic: editor?.isActive("italic"),
      bullet: editor?.isActive("bulletList"),
      ordered: editor?.isActive("orderedList"),
    }),
  });
  if (!editor)
    return <div className="studio-rich-loading">正在准备编辑器…</div>;
  return (
    <div className="studio-rich">
      <div className="studio-rich-tools" role="toolbar" aria-label="正文格式">
        <button
          type="button"
          aria-label="加粗"
          aria-pressed={!!state?.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          aria-label="斜体"
          aria-pressed={!!state?.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          aria-label="项目列表"
          aria-pressed={!!state?.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          aria-label="编号列表"
          aria-pressed={!!state?.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          aria-label="编辑链接"
          onClick={() => setLink(editor.getAttributes("link").href || "")}
        >
          <Link2 size={15} />
        </button>
        <button
          type="button"
          aria-label="撤销文字编辑"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          aria-label="重做文字编辑"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={15} />
        </button>
      </div>
      {link !== null && (
        <form
          className="studio-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!link)
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else if (/^(https?:\/\/|mailto:|tel:)/i.test(link))
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: link })
                .run();
            else return;
            setLink(null);
          }}
        >
          <input
            aria-label="链接地址"
            placeholder="https:// 或 mailto:"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="submit">应用</button>
          <button type="button" onClick={() => setLink(null)}>
            取消
          </button>
        </form>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
