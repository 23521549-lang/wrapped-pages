// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { editorCharCount } from "@/components/editor/charCount";
import { editorExtensions } from "@/components/editor/extensions";
import { docCharCount } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";

/*
 * editorCharCount phai dem dung nhu docCharCount, vi bo dem o man viet bao "khong luu duoc" theo
 * dung tran ma actionSaveDraft dung. Kiem tren mot TipTap Editor that, so voi docCharCount(editor.getJSON()).
 */

const MAU: DocJson = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Mưa ", marks: [{ type: "bold" }] },
        { type: "text", text: "đầu tháng", marks: [{ type: "italic" }, { type: "underline" }] },
        { type: "hardBreak" },
        { type: "hardBreak" },
        { type: "text", text: "chín 🌧" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "hai" }, { type: "hardBreak" }] }] },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "trích" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "lồng" }] }] }] },
      ],
    },
    { type: "paragraph" },
  ],
};

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("editorCharCount", () => {
  it("bang docCharCount(editor.getJSON()) tren doan, danh sach, trich dan, xuong dong va emoji", () => {
    editor = new Editor({ extensions: editorExtensions("Mạnh"), content: MAU });
    const json = editor.getJSON() as DocJson;
    expect(editorCharCount(editor.state.doc)).toBe(docCharCount(json));
    // "Mưa " 4 + "đầu tháng" 9 + 2 xuong dong + "chín 🌧" 7 (emoji la hai don vi UTF-16) + "một" 3 + "hai" 3
    // + 1 xuong dong + "trích" 5 + "lồng" 4.
    expect(editorCharCount(editor.state.doc)).toBe(38);
  });

  it("tai lieu chi co doan trong thi dem 0, go them chu thi dem theo", () => {
    editor = new Editor({ extensions: editorExtensions("Mạnh"), content: { type: "doc", content: [{ type: "paragraph" }] } });
    expect(editorCharCount(editor.state.doc)).toBe(0);
    editor.commands.insertContent("Em tới sớm");
    editor.commands.setHardBreak();
    expect(editorCharCount(editor.state.doc)).toBe(11);
    expect(editorCharCount(editor.state.doc)).toBe(docCharCount(editor.getJSON() as DocJson));
  });
});
