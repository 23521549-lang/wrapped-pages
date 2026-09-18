"use client";

import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";

type Kieu = "bold" | "italic" | "underline" | "bulletList" | "blockquote";

function IconDanhSach() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <g fill="currentColor"><circle cx="4" cy="6" r="1.6" /><circle cx="4" cy="14" r="1.6" /></g>
      <path d="M8 6h9M8 14h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTrichDan() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M5 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7h7M9 10h7M9 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const NUT: { kieu: Kieu; nhan: string; chay: (e: Editor) => boolean; hinh: React.ReactNode }[] = [
  { kieu: "bold", nhan: "Đậm", chay: (e) => e.chain().focus().toggleBold().run(), hinh: <b>B</b> },
  { kieu: "italic", nhan: "Nghiêng", chay: (e) => e.chain().focus().toggleItalic().run(), hinh: <i>I</i> },
  { kieu: "underline", nhan: "Gạch chân", chay: (e) => e.chain().focus().toggleUnderline().run(), hinh: <u>U</u> },
  { kieu: "bulletList", nhan: "Danh sách", chay: (e) => e.chain().focus().toggleBulletList().run(), hinh: <IconDanhSach /> },
  { kieu: "blockquote", nhan: "Trích dẫn", chay: (e) => e.chain().focus().toggleBlockquote().run(), hinh: <IconTrichDan /> },
];

/** Nam nut bat tat dinh dang. children la cho cho them nut khac (vd nut Tap trung). */
export function Toolbar({ editor, children }: { editor: Editor | null; children?: React.ReactNode }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            bulletList: e.isActive("bulletList"),
            blockquote: e.isActive("blockquote"),
          }
        : null,
  });

  return (
    <div className="thanh-dinh-dang" role="toolbar" aria-label="Công cụ viết">
      {NUT.map((n) => (
        <button
          key={n.kieu}
          type="button"
          className="nut-dinh-dang"
          aria-label={n.nhan}
          title={n.nhan}
          aria-pressed={active?.[n.kieu] ?? false}
          disabled={!editor}
          onClick={() => {
            if (editor) n.chay(editor);
          }}
        >
          {n.hinh}
        </button>
      ))}
      {children}
    </div>
  );
}
