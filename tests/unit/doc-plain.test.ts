import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions } from "@/components/editor/extensions";
import { toPlainJson } from "@/lib/doc/plain";
import type { BlockNode, DocJson } from "@/lib/doc/types";

/*
 * Ghim lai loi null-prototype cua attrs ProseMirror (xem src/lib/doc/plain.ts): ProseMirror dung
 * Object.create(null) cho attrs cua moi node, nen editor.getJSON()/node.toJSON() tra ve mot doi tuong
 * khong co prototype cho khoi media - dung dieu ma bo ma hoa doi so cua Server Action (react-server-dom-webpack)
 * am tham thay bang chuoi "$T" rong khong kem du lieu. Bai kiem nay khong the ghim thang bien Server Action (do
 * chi lo trong e2e, xem tests/e2e/media-anh.spec.ts ca (e) "cho ngat trung nhau"); no ghim dung ham toPlainJson.
 *
 * Bai "chung minh loi co that" (o duoi) pin mot chi tiet thi cong cua prosemirror-model, khong phai cua chinh
 * du an nay: no khang dinh thang Object.getPrototypeOf(...) === null tren toJSON() CHUA qua toPlainJson. Bai do
 * hong khong co nghia app hong - no chi co nghia prosemirror-model da doi cach tinh attrs (khong con dung
 * Object.create(null) nua). Gap luc do thi xem lai xem src/lib/doc/plain.ts (va hai diem goi no) con can nua
 * khong, dung xoa thang bai kiem hay loi giai thich cua no de bai qua xanh tro lai.
 */

const schema = getSchema(editorExtensions("Mạnh"));
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";

const MAU: DocJson = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "chữ" }] },
    { type: "anh", attrs: { id: ID, w: 1200, h: 900 } },
  ],
};

function khoiAnh(doc: DocJson): Extract<BlockNode, { type: "anh" }> {
  const khoi = doc.content.find((b): b is Extract<BlockNode, { type: "anh" }> => b.type === "anh");
  if (!khoi) throw new Error("khong tim thay khoi anh trong tai lieu mau");
  return khoi;
}

describe("toPlainJson: ghim loi null-prototype cua attrs ProseMirror", () => {
  it("chung minh loi co that: attrs cua khoi anh tu node.toJSON() that su khong co prototype", () => {
    const json = PMNode.fromJSON(schema, MAU).toJSON() as DocJson;
    expect(Object.getPrototypeOf(khoiAnh(json).attrs)).toBeNull();
  });

  it("sau toPlainJson: attrs la doi tuong Object.prototype binh thuong, con noi dung giu nguyen", () => {
    const json = toPlainJson(PMNode.fromJSON(schema, MAU).toJSON() as DocJson);
    expect(Object.getPrototypeOf(khoiAnh(json).attrs)).toBe(Object.prototype);
    expect(json).toEqual(MAU);
  });

  it("tai lieu chi co chu (khong khoi media nao) di qua khong doi: doan/chu khong co attrs de dinh loi nay", () => {
    const chiChu: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "chỉ chữ, không ảnh" }] }] };
    expect(toPlainJson(PMNode.fromJSON(schema, chiChu).toJSON() as DocJson)).toEqual(chiChu);
  });
});
