import type { Node as PMNode } from "@tiptap/pm/model";
import { toPlainJson } from "@/lib/doc/plain";
import type { DocJson } from "@/lib/doc/types";

/**
 * Vi tri an toan de ngat truoc mot doan: lui ra truoc cac khoi bao ngoai ma doan nay la con dau tien
 * (muc danh sach, danh sach, trich dan). Cat o day thi hai phan deu con nguyen cau truc hop le.
 */
export function blockBoundary(doc: PMNode, textblockPos: number): number {
  const $pos = doc.resolve(textblockPos);
  let pos = textblockPos;
  for (let d = $pos.depth; d > 0 && $pos.index(d) === 0; d--) pos = $pos.before(d);
  return pos;
}

/**
 * Cat tai lieu thanh cac to tai cac vi tri ngat (tang dan, lay tu bo xep trang). Moi phan duoc kiem lai
 * bang so do: check() nem loi neu mot vi tri ngat lam rong mot khoi, de khong bao
 * gio luu mot to hong. Cho ngat nam ben trong khoi nao thi moi khoi do (doan, muc danh sach, danh sach, trich dan)
 * tren nhanh dau cua phan sau mang dau noiTiep: man doc bo dau cham cua muc noi tiep, va joinSheets
 * (src/lib/doc/join.ts) noi lai dung cac to cua mot luot khi sua.
 */
export function splitDoc(doc: PMNode, breaks: readonly number[]): DocJson[] {
  const bounds = [0, ...breaks, doc.content.size];
  const out: DocJson[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to <= from) continue;
    const part = doc.cut(from, to);
    part.check();
    // toPlainJson: attrs cua khoi media trong toJSON() khong co prototype (xem src/lib/doc/plain.ts), phai ep ve
    // JSON thuan ngay o day: cac to nay se roi trinh duyet di toi actionPublish (Server Action) qua PublishBar.
    const json = toPlainJson(part.toJSON() as DocJson);
    if (i > 0) danhDauNoiTiep(json, doc.resolve(from).depth);
    out.push(json);
  }
  return out;
}

/** Danh dau sau nut dau tien tren nhanh dau cua phan cat: sau la so khoi bao quanh cho ngat, deu bi cat ngang. */
function danhDauNoiTiep(doc: DocJson, sau: number): void {
  let node: { type: string; content?: unknown[]; noiTiep?: true } = doc;
  for (let d = 0; d < sau && node.content && node.content.length > 0; d++) {
    node = node.content[0] as typeof node;
    node.noiTiep = true;
  }
}
