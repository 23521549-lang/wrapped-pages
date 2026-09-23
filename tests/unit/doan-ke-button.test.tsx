// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { DoanKeButton } from "@/components/editor/DoanKeButton";
import { editorExtensions } from "@/components/editor/extensions";
import { markedExcerpt } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";

/*
 * Nut chon doan tren ke tren mot trinh soan thao that: chua boi den gi thi mo di, boi den roi thi danh dau dung vung
 * do, bam lan nua thi bo.
 */

const DOC: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hôm ấy mưa" }] }] };

let editor: Editor | null = null;

afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = null;
});

function dung() {
  editor = new Editor({ extensions: editorExtensions("Linh"), content: DOC });
  const noi = vi.fn();
  render(<DoanKeButton editor={editor} announce={noi} />);
  return { noi, ed: editor };
}

const doc = (ed: Editor) => ed.getJSON() as DocJson;

describe("nut chon doan tren ke", () => {
  it("chua boi den gi thi nut mo di va khong danh dau duoc", () => {
    const { ed, noi } = dung();
    const nut = screen.getByRole("button", { name: "Chọn làm đoạn trên kệ" });
    expect([nut.getAttribute("aria-disabled"), nut.getAttribute("aria-pressed")]).toEqual(["true", "false"]);
    fireEvent.click(nut);
    expect([markedExcerpt(doc(ed)), noi.mock.calls.length]).toEqual([null, 0]);
  });

  it("boi den roi bam thi danh dau dung vung do va bao cho trinh doc man hinh", () => {
    const { ed, noi } = dung();
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 7 });
    });
    const nut = screen.getByRole("button", { name: "Chọn làm đoạn trên kệ" });
    expect(nut.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(nut);
    expect(markedExcerpt(doc(ed))).toBe("Hôm ấy");
    expect(noi).toHaveBeenCalledWith("Đã chọn đoạn trên kệ.");
    expect(screen.getByRole("button", { name: "Bỏ đoạn trên kệ" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("bam lan nua thi bo dau", () => {
    const { ed, noi } = dung();
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 7 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Chọn làm đoạn trên kệ" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ đoạn trên kệ" }));
    expect(markedExcerpt(doc(ed))).toBeNull();
    expect(noi).toHaveBeenLastCalledWith("Đã bỏ đoạn trên kệ.");
    expect(screen.getByRole("button", { name: "Chọn làm đoạn trên kệ" }).getAttribute("aria-pressed")).toBe("false");
  });
});
