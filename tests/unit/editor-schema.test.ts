import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions, TEXT_EXTENSIONS } from "@/components/editor/extensions";
import { cleanDoc } from "@/lib/doc/validate";
import type { DocJson } from "@/lib/doc/types";
import { PEAK_COUNT } from "@/lib/media/kinds";

const schema = getSchema(editorExtensions("Mạnh"));
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";

const MAU: DocJson = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Mưa ", marks: [{ type: "bold" }] },
        { type: "text", text: "đầu tháng", marks: [{ type: "italic" }, { type: "underline" }] },
        { type: "hardBreak" },
        { type: "text", text: "chín" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "một" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "hai" }] }] },
      ],
    },
    { type: "anh", attrs: { id: ID, w: 1200, h: 900 } },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "trích" }] }] },
    { type: "ghi-am", attrs: { id: ID_2, ms: 84_000, peaks: Array.from({ length: PEAK_COUNT }, (_, i) => (i * 7) % 101) } },
    { type: "paragraph" },
  ],
};

const KHOI_CHU = ["blockquote", "bulletList", "doc", "hardBreak", "listItem", "paragraph", "text"];

describe("so do cua trinh soan thao khop cleanDoc", () => {
  it("chi co dung cac loai khoi va dinh dang ma cleanDoc chap nhan, ke ca anh va ghi am", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([...KHOI_CHU, "anh", "ghi-am"].sort());
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic", "underline"]);
  });

  it("muc danh sach chi chua dung mot doan", () => {
    expect(schema.nodes.listItem.spec.content).toBe("paragraph");
  });

  it("tai lieu mau hop le voi ca hai ben va di mot vong khong doi", () => {
    const node = PMNode.fromJSON(schema, MAU);
    expect(() => node.check()).not.toThrow();
    expect(cleanDoc(node.toJSON())).toEqual(MAU);
  });

  it("khoi media la khoi nguyen: nguyen tu, chon duoc, khong keo tha, thuoc tinh dung mo hinh tai lieu", () => {
    for (const [ten, thuocTinh] of [["anh", ["h", "id", "w"]], ["ghi-am", ["id", "ms", "peaks"]]] as const) {
      const loai = schema.nodes[ten];
      expect([loai.isAtom, loai.spec.selectable, loai.spec.draggable, loai.spec.group], ten).toEqual([true, true, false, "media"]);
      expect(Object.keys(loai.spec.attrs ?? {}).sort(), ten).toEqual([...thuocTinh]);
    }
  });

  it("khoi media chi o cap cao nhat: trong trich dan hay muc danh sach thi ca so do lan cleanDoc deu tu choi", () => {
    const anh = { type: "anh", attrs: { id: ID, w: 1200, h: 900 } };
    const trongTrichDan = { type: "doc", content: [{ type: "blockquote", content: [anh] }] };
    const trongDanhSach = { type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [anh] }] }] };
    for (const doc of [trongTrichDan, trongDanhSach]) {
      expect(() => PMNode.fromJSON(schema, doc).check()).toThrow();
      expect(cleanDoc(doc)).toBeNull();
    }
  });

  it("trang tra loi chi co khoi chu: so do khong co anh, ghi am", () => {
    const text = getSchema(TEXT_EXTENSIONS);
    expect(Object.keys(text.nodes).sort()).toEqual(KHOI_CHU);
    expect(text.nodes.doc.spec.content).toBe("block+");
  });
});
