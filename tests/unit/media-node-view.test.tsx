// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { generateJSON, type Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions, TEXT_EXTENSIONS } from "@/components/editor/extensions";
import type { DocJson } from "@/lib/doc/types";
import { PEAK_COUNT } from "@/lib/media/kinds";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
const PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => i % 101);

/** Doan "Sang" o 0 (co 6), anh o 6, ghi am o 7, doan trong o 8. */
const DOC: DocJson = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Sáng" }] },
    { type: "anh", attrs: { id: ID, w: 1200, h: 900 } },
    { type: "ghi-am", attrs: { id: ID_2, ms: 84_000, peaks: PEAKS } },
    { type: "paragraph" },
  ],
};
const VI_TRI_ANH = 6;
const VI_TRI_GHI_AM = 7;

function Viet({ onEditor }: { onEditor: (editor: TiptapEditor) => void }) {
  const editor = useEditor({ extensions: editorExtensions("Mạnh"), content: DOC, immediatelyRender: true });
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return <EditorContent editor={editor} />;
}

async function veEditor(): Promise<{ editor: TiptapEditor; container: HTMLElement }> {
  let editor: TiptapEditor | undefined;
  const { container } = render(<Viet onEditor={(e) => { editor = e; }} />);
  // ReactRenderer cua TipTap ve node view sau mot microtask khi editor chua bao khoi tao xong: cho qua luot do.
  await act(async () => {});
  if (!editor) throw new Error("editor chua tao");
  return { editor, container };
}

const loaiKhoi = (editor: TiptapEditor) => (editor.getJSON() as DocJson).content.map((b) => b.type);

afterEach(() => {
  cleanup();
});

describe("node view anh va ghi am o man viet", () => {
  it("ve bang chinh khoi cua man doc: dung hinh hoc, ten nguoi viet, khong keo tha", async () => {
    const { container } = await veEditor();
    const img = screen.getByRole("img", { name: "Ảnh Mạnh đăng" });
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["304", "228"]);
    expect(screen.getByRole("figure", { name: "Mạnh ghi âm, dài 1:24" })).not.toBeNull();
    for (const nut of [".node-anh", ".node-ghi-am"]) {
      const khoi = container.querySelector<HTMLElement>(nut);
      // ProseMirror gan thuoc tinh contentEditable cua node view la; jsdom giu gia tri do nhu thuoc tinh JS.
      expect(khoi?.contentEditable, nut).toBe("false");
      expect(khoi?.getAttribute("draggable"), nut).not.toBe("true");
    }
  });

  it("chon khoi thi node view mang lop dang chon; bam Bo anh thi bo dung khoi do", async () => {
    const { editor, container } = await veEditor();
    act(() => {
      editor.commands.setNodeSelection(VI_TRI_ANH);
    });
    expect(container.querySelector(".node-anh")?.classList.contains("ProseMirror-selectednode")).toBe(true);
    expect(container.querySelector(".node-ghi-am")?.classList.contains("ProseMirror-selectednode")).toBe(false);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh" }));
    });
    expect(loaiKhoi(editor)).toEqual(["paragraph", "ghi-am", "paragraph"]);
  });

  it("ban phim: Delete bo ghi am dang chon, Backspace bo anh dang chon", async () => {
    const { editor } = await veEditor();
    act(() => {
      editor.commands.setNodeSelection(VI_TRI_GHI_AM);
    });
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: "Delete" });
    });
    expect(loaiKhoi(editor)).toEqual(["paragraph", "anh", "paragraph"]);
    act(() => {
      editor.commands.setNodeSelection(VI_TRI_ANH);
    });
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: "Backspace" });
    });
    expect(loaiKhoi(editor)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("HTML cua khoi media (cat roi dan)", () => {
  it("HTML man viet sinh ra doc lai dung tung khoi, ke ca song am", async () => {
    const { editor } = await veEditor();
    expect(generateJSON(editor.getHTML(), editorExtensions("Mạnh"))).toEqual(editor.getJSON());
  });

  it("thuoc tinh sai thi khoi bi bo, khong lot vao tai lieu", () => {
    const html = [
      `<figure data-khoi="anh" data-id="${ID}" data-w="640" data-h="480"></figure>`,
      `<figure data-khoi="anh" data-id="${ID}" data-w="0" data-h="480"></figure>`,
      `<figure data-khoi="anh" data-id="khong-phai-uuid" data-w="640" data-h="480"></figure>`,
      `<figure data-khoi="ghi-am" data-id="${ID}" data-ms="1000" data-peaks="[1,2]"></figure>`,
      `<figure data-khoi="ghi-am" data-id="${ID}" data-ms="1000" data-peaks="khong-phai-json"></figure>`,
    ].join("");
    const doc = generateJSON(html, editorExtensions("Mạnh")) as DocJson;
    expect(doc.content.filter((b) => b.type === "anh" || b.type === "ghi-am")).toEqual([{ type: "anh", attrs: { id: ID, w: 640, h: 480 } }]);
  });

  it("trang tra loi khong nhan khoi media dan vao", () => {
    const html = `<p>Chữ</p><figure data-khoi="anh" data-id="${ID}" data-w="640" data-h="480"></figure>`;
    expect(generateJSON(html, TEXT_EXTENSIONS)).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Chữ" }] }] });
  });
});
