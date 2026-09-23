import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { getSchema, type Editor } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { boDoanKeTr, chonDuocDoanKe, dangTrongDoanKe, datDoanKeTr, doiDoanKe } from "@/components/editor/doanKe";
import { editorExtensions } from "@/components/editor/extensions";
import { markedExcerpt } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { cleanDoc } from "@/lib/doc/validate";
import { boComment, THU_MUC_CSS } from "../helpers/bang-token";

const schema = getSchema(editorExtensions("Mạnh"));
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: unknown[]) => PMNode.fromJSON(schema, { type: "doc", content });

/** Trang thai voi vung dang boi den tu from toi to (vi tri cua ProseMirror). */
function chon(d: PMNode, from: number, to: number): EditorState {
  return EditorState.create({ schema, doc: d, selection: TextSelection.create(d, from, to) });
}

const sau = (state: EditorState) => state.apply(datDoanKeTr(state)).doc.toJSON() as DocJson;

/** Danh dau vung from toi to roi tra ve trang thai moi, de ca kiem sau con doc tiep. */
function danhDau(d: PMNode, from: number, to: number): EditorState {
  const state = chon(d, from, to);
  return state.apply(datDoanKeTr(state));
}

describe("dau doan tren ke", () => {
  it("danh dau dung vung dang boi den", () => {
    const state = chon(doc(p("Hôm ấy mưa")), 1, 7);
    expect(markedExcerpt(sau(state))).toBe("Hôm ấy");
  });

  it("dau trai qua nhieu nut chu co dinh dang khac nhau", () => {
    const d = doc({
      type: "paragraph",
      content: [{ type: "text", text: "Mưa ", marks: [{ type: "bold" }] }, { type: "text", text: "rất nhẹ" }],
    });
    expect(markedExcerpt(sau(chon(d, 1, 12)))).toBe("Mưa rất nhẹ");
  });

  it("dau trai qua bien cua hai khoi thi moi khoi giu phan cua minh", () => {
    expect(markedExcerpt(sau(chon(doc(p("Hôm ấy"), p("mưa nhẹ")), 4, 12)))).toBe("ấy mưa");
  });

  it("chon lai thi thay cho cu, moi tai lieu chi mot doan", () => {
    const daDanh = danhDau(doc(p("Hôm ấy mưa"), p("Rồi tạnh")), 1, 7);
    const hai = EditorState.create({ schema, doc: daDanh.doc, selection: TextSelection.create(daDanh.doc, 13, 20) });
    expect(markedExcerpt(hai.apply(datDoanKeTr(hai)).doc.toJSON() as DocJson)).toBe("Rồi tạn");
  });

  it("bo chon thi khong con dau nao", () => {
    const daDanh = danhDau(doc(p("Hôm ấy mưa")), 1, 7);
    expect(markedExcerpt(daDanh.apply(boDoanKeTr(daDanh)).doc.toJSON() as DocJson)).toBeNull();
  });

  it("khong boi den gi thi khong danh dau duoc, nhung con tro trong doan da chon thi bo duoc", () => {
    const rong = chon(doc(p("Hôm ấy mưa")), 4, 4);
    expect([chonDuocDoanKe(rong), dangTrongDoanKe(rong)]).toEqual([false, false]);
    expect(markedExcerpt(sau(rong))).toBeNull();
    const daDanh = danhDau(doc(p("Hôm ấy mưa")), 1, 7);
    const trong = EditorState.create({ schema, doc: daDanh.doc, selection: TextSelection.create(daDanh.doc, 4, 4) });
    expect([chonDuocDoanKe(trong), dangTrongDoanKe(trong)]).toEqual([false, true]);
  });

  it("to trong hay to chi co anh thi khong co gi de danh dau", () => {
    const trang = chon(doc({ type: "paragraph" }), 1, 1);
    expect([chonDuocDoanKe(trang), markedExcerpt(sau(trang))]).toEqual([false, null]);
    const chiAnh = doc({ type: "anh", attrs: { id: ID, w: 640, h: 480 } });
    const anh = EditorState.create({ schema, doc: chiAnh, selection: NodeSelection.create(chiAnh, 0) });
    expect([chonDuocDoanKe(anh), markedExcerpt(sau(anh))]).toEqual([false, null]);
  });

  it("bam lai lan nua thi dau bi bo, bam mot lan nua thi dau tro lai", () => {
    const daDanh = danhDau(doc(p("Hôm ấy mưa")), 1, 7);
    let state = EditorState.create({ schema, doc: daDanh.doc, selection: TextSelection.create(daDanh.doc, 1, 7) });
    let focus = 0;
    const editor = {
      get state() { return state; },
      view: { dispatch: (tr: never) => { state = state.apply(tr); }, focus: () => { focus += 1; } },
    } as unknown as Editor;
    doiDoanKe(editor);
    expect(markedExcerpt(state.doc.toJSON() as DocJson)).toBeNull();
    doiDoanKe(editor);
    expect([markedExcerpt(state.doc.toJSON() as DocJson), focus]).toEqual(["Hôm ấy", 2]);
  });

  it("tai lieu mang dau van qua duoc cong kiem cua may chu", () => {
    const state = chon(doc(p("Hôm ấy mưa")), 1, 7);
    expect(cleanDoc(sau(state))).toEqual(sau(state));
  });
});

/*
 * Kieu to cua doan da chon. Bai kiem nay canh giu dieu kien nang nhat cua CLAUDE.md muc 1: diem ngat trang phai tinh
 * ra giong het truoc. Chu mang dau nam ngay trong dong van, nen bat ky thuoc tinh nao dung toi hinh hoc cua dong
 * (dem, le, vien, co chu, gian cach, chieu cao dong, cach hien) deu doi cho ngat trang giua man viet va man doc. Vi
 * vay bai kiem chan theo danh sach TRANG, khong phai danh sach den: chi ba khai bao duoi day duoc phep.
 */
describe("kieu to cua doan tren ke", () => {
  const DUOC_PHEP = ["background-color", "border-radius", "color"];

  /** Moi quy tac trong src/styles co bo chon cham toi lop .doan-ke, kem danh sach ten thuoc tinh cua no. */
  function quyTacDoanKe(): { selector: string; props: string[] }[] {
    const ra: { selector: string; props: string[] }[] = [];
    for (const ten of readdirSync(THU_MUC_CSS).filter((f) => f.endsWith(".css"))) {
      const css = boComment(readFileSync(`${THU_MUC_CSS}/${ten}`, "utf8"));
      for (const m of css.matchAll(/([^{}]*\.doan-ke[^{}]*)\{([^{}]*)\}/g)) {
        const props = m[2].split(";").map((s) => s.split(":")[0].trim()).filter((s) => s.length > 0);
        ra.push({ selector: m[1].trim(), props: props.sort() });
      }
    }
    return ra;
  }

  it("chi mot quy tac, chi mau nen, bo goc va mau chu: khong gi dung toi hinh hoc cua dong chu", () => {
    expect(quyTacDoanKe()).toEqual([{ selector: ".giay-noi-dung .doan-ke", props: DUOC_PHEP }]);
  });

  it("nen lay tu tong xanh co san va chu giu mau muc, khong them token moi", () => {
    const css = boComment(readFileSync(`${THU_MUC_CSS}/viet.css`, "utf8"));
    const than = /\.giay-noi-dung \.doan-ke\{([^{}]*)\}/.exec(css)?.[1] ?? "";
    expect(than).toContain("background-color: var(--blue-2)");
    expect(than).toContain("color: var(--color-ink)");
  });
});
