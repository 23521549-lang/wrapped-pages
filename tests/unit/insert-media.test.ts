import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { editorExtensions } from "@/components/editor/extensions";
import { insertMediaTr } from "@/components/editor/insertMedia";
import { mediaAnnouncement } from "@/components/editor/mediaAnnounce";
import { cleanDoc } from "@/lib/doc/validate";
import { PEAK_COUNT } from "@/lib/media/kinds";
import type { MediaNode } from "@/lib/media/node";

const schema = getSchema(editorExtensions("Mạnh"));
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ANH: MediaNode = { type: "anh", attrs: { id: ID, w: 640, h: 480 } };
const GHI_AM: MediaNode = { type: "ghi-am", attrs: { id: ID, ms: 3_000, peaks: Array.from({ length: PEAK_COUNT }, () => 10) } };

const p = (text?: string) => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const doc = (...content: unknown[]) => PMNode.fromJSON(schema, { type: "doc", content });

function voiConTro(d: PMNode, pos: number): EditorState {
  return EditorState.create({ schema, doc: d, selection: TextSelection.create(d, pos) });
}

/** Chen roi tra loai tung khoi cap cao nhat, khoi dang chua con tro va chu cua doan do. */
function chen(state: EditorState, block: MediaNode) {
  const next = state.apply(insertMediaTr(state, block));
  const $con = next.selection.$from;
  expect(cleanDoc(next.doc.toJSON())).not.toBeNull();
  const loai: string[] = [];
  next.doc.forEach((node) => loai.push(node.type.name));
  return { loai, khoiConTro: $con.index(0), chu: $con.parent.textContent, dauDoan: $con.parentOffset === 0, rong: next.selection.empty };
}

describe("insertMediaTr", () => {
  it("con tro trong doan co chu: khoi dung ngay sau doan, con tro sang doan trong moi tao", () => {
    expect(chen(voiConTro(doc(p("Sáng")), 3), ANH)).toEqual({ loai: ["paragraph", "anh", "paragraph"], khoiConTro: 2, chu: "", dauDoan: true, rong: true });
  });

  it("khoi sau da la doan thi con tro vao dau doan do, khong tao them", () => {
    expect(chen(voiConTro(doc(p("a"), p("b")), 1), ANH)).toEqual({ loai: ["paragraph", "anh", "paragraph"], khoiConTro: 2, chu: "b", dauDoan: true, rong: true });
  });

  it("con tro o doan trong thi khoi thay doan trong", () => {
    expect(chen(voiConTro(doc(p("a"), p(), p("b")), 4), GHI_AM)).toEqual({ loai: ["paragraph", "ghi-am", "paragraph"], khoiConTro: 2, chu: "b", dauDoan: true, rong: true });
  });

  it("con tro trong danh sach thi khoi dung sau ca danh sach, khong long vao trong", () => {
    const d = doc({ type: "bulletList", content: [{ type: "listItem", content: [p("x")] }, { type: "listItem", content: [p("y")] }] }, p("z"));
    const r = chen(voiConTro(d, 3), GHI_AM);
    expect(r.loai).toEqual(["bulletList", "ghi-am", "paragraph"]);
    expect([r.khoiConTro, r.chu]).toEqual([2, "z"]);
  });

  it("con tro trong trich dan o cuoi tai lieu thi khoi dung sau trich dan, tao doan trong de go tiep", () => {
    const r = chen(voiConTro(doc({ type: "blockquote", content: [p("trích")] }), 3), ANH);
    expect(r.loai).toEqual(["blockquote", "anh", "paragraph"]);
    expect([r.khoiConTro, r.chu]).toEqual([2, ""]);
  });

  it("khoi media dang chon thi khoi moi dung ngay sau no", () => {
    const d = doc(p("a"), { type: "anh", attrs: ANH.attrs }, p("b"));
    const state = EditorState.create({ schema, doc: d, selection: NodeSelection.create(d, 3) });
    expect(chen(state, GHI_AM).loai).toEqual(["paragraph", "anh", "ghi-am", "paragraph"]);
  });
});

describe("mediaAnnouncement", () => {
  const coAnh = doc(p("a"), { type: "anh", attrs: ANH.attrs }, { type: "ghi-am", attrs: GHI_AM.attrs }, p("b"));

  it("chon khoi media thi doc cach bo khoi", () => {
    expect(mediaAnnouncement(coAnh, coAnh, NodeSelection.create(coAnh, 3))).toBe("Đã chọn ảnh. Bấm Delete hoặc nút Bỏ ảnh để bỏ.");
    expect(mediaAnnouncement(coAnh, coAnh, NodeSelection.create(coAnh, 4))).toBe("Đã chọn ghi âm. Bấm Delete hoặc nút Bỏ ghi âm để bỏ.");
  });

  it("bot mot khoi media thi doc da bo dung loai", () => {
    const khongAnh = doc(p("a"), { type: "ghi-am", attrs: GHI_AM.attrs }, p("b"));
    const khongGhiAm = doc(p("a"), { type: "anh", attrs: ANH.attrs }, p("b"));
    expect(mediaAnnouncement(coAnh, khongAnh, TextSelection.create(khongAnh, 1))).toBe("Đã bỏ ảnh.");
    expect(mediaAnnouncement(coAnh, khongGhiAm, TextSelection.create(khongGhiAm, 1))).toBe("Đã bỏ ghi âm.");
  });

  it("con lai thi chuoi rong", () => {
    expect(mediaAnnouncement(coAnh, coAnh, TextSelection.create(coAnh, 1))).toBe("");
  });
});
