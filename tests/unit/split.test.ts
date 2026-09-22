import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions } from "@/components/editor/extensions";
import { blockBoundary, splitDoc } from "@/components/editor/split";
import { cleanDoc } from "@/lib/doc/validate";

const schema = getSchema(editorExtensions("Mạnh"));
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const li = (text: string) => ({ type: "listItem", content: [p(text)] });

const DOC = PMNode.fromJSON(schema, {
  type: "doc",
  content: [
    p("Mở đầu"),
    { type: "bulletList", content: [li("một"), li("hai hai hai")] },
    { type: "blockquote", content: [p("trích một"), p("trích hai")] },
  ],
});

/** Vi tri truoc moi doan, theo thu tu tai lieu. */
function doan(doc: PMNode): number[] {
  const out: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      out.push(pos);
      return false;
    }
    return true;
  });
  return out;
}

const sau = (pos: number) => DOC.resolve(pos).nodeAfter?.type.name;

describe("blockBoundary", () => {
  it("doan dau tai lieu ngat o 0", () => {
    expect(blockBoundary(DOC, doan(DOC)[0])).toBe(0);
  });

  it("doan dau cua muc dau danh sach lui ra truoc ca danh sach", () => {
    expect(sau(blockBoundary(DOC, doan(DOC)[1]))).toBe("bulletList");
  });

  it("doan cua muc thu hai lui ra truoc muc do, khong lui qua danh sach", () => {
    const b = blockBoundary(DOC, doan(DOC)[2]);
    expect(sau(b)).toBe("listItem");
    expect(DOC.resolve(b).index(1)).toBe(1);
  });

  it("doan dau trich dan lui ra truoc trich dan; doan thu hai trong trich dan thi khong", () => {
    expect(sau(blockBoundary(DOC, doan(DOC)[3]))).toBe("blockquote");
    expect(sau(blockBoundary(DOC, doan(DOC)[4]))).toBe("paragraph");
  });
});

describe("splitDoc", () => {
  it("khong ngat thi tra lai nguyen tai lieu", () => {
    expect(splitDoc(DOC, [])).toEqual([DOC.toJSON()]);
  });

  it("ngat o bien khoi: hai phan deu nguyen cau truc, khong co dau noi tiep", () => {
    const [a, c] = splitDoc(DOC, [blockBoundary(DOC, doan(DOC)[1])]);
    expect(a.content.map((n) => n.type)).toEqual(["paragraph"]);
    expect(c.content.map((n) => n.type)).toEqual(["bulletList", "blockquote"]);
    expect(JSON.stringify(c)).not.toContain("noiTiep");
    expect(cleanDoc(a)).toEqual(a);
    expect(cleanDoc(c)).toEqual(c);
  });

  it("ngat giua hai muc danh sach: danh sach bi cat ngang mang dau noi tiep, muc sau thi khong", () => {
    const [a, c] = splitDoc(DOC, [blockBoundary(DOC, doan(DOC)[2])]);
    expect(JSON.stringify(a)).toContain("một");
    expect(c.content[0]).toEqual({ type: "bulletList", noiTiep: true, content: [li("hai hai hai")] });
    expect(cleanDoc(a)).toEqual(a);
    expect(cleanDoc(c)).toEqual(c);
  });

  it("ngat giua chu cua mot muc: danh sach, muc va doan deu mang dau noi tiep, ca hai phan hop le", () => {
    const pos = doan(DOC)[2] + 1 + "hai ".length;
    const [a, c] = splitDoc(DOC, [pos]);
    expect(c.content[0]).toEqual({
      type: "bulletList",
      noiTiep: true,
      content: [{ type: "listItem", noiTiep: true, content: [{ ...p("hai hai"), noiTiep: true }] }],
    });
    expect(JSON.stringify(a)).toContain('"hai "');
    expect(cleanDoc(a)).toEqual(a);
    expect(cleanDoc(c)).toEqual(c);
  });

  it("ngat giua chu trong trich dan: trich dan va doan bi cat mang dau noi tiep, doan sau thi khong", () => {
    const pos = doan(DOC)[3] + 1 + "trích ".length;
    const [a, c] = splitDoc(DOC, [pos]);
    expect(c.content[0]).toEqual({ type: "blockquote", noiTiep: true, content: [{ ...p("một"), noiTiep: true }, p("trích hai")] });
    expect(cleanDoc(a)).toEqual(a);
    expect(cleanDoc(c)).toEqual(c);
  });

  it("ngat giua doan cap cao nhat: chi doan do mang dau noi tiep", () => {
    const pos = doan(DOC)[0] + 1 + "Mở ".length;
    const [a, c] = splitDoc(DOC, [pos]);
    expect(a.content).toEqual([p("Mở ")]);
    expect(c.content[0]).toEqual({ ...p("đầu"), noiTiep: true });
    expect(c.content.slice(1).map((n) => n.type)).toEqual(["bulletList", "blockquote"]);
    expect(cleanDoc(c)).toEqual(c);
  });

  it("vi tri lam rong mot danh sach thi bao loi thay vi luu trang hong", () => {
    const truocDanhSach = blockBoundary(DOC, doan(DOC)[1]);
    expect(() => splitDoc(DOC, [truocDanhSach + 1])).toThrow();
  });
});
