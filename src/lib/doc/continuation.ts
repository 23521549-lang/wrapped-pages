import type { DocJson } from "./types";

type Nut = { type: string; content?: Nut[]; noiTiep?: true };

/** Muc danh sach dau tien tren nhanh con dau tien, cung duong danhDauNoiTiep trong split.ts di; khong co thi null. */
function mucDau(doc: Nut): Nut | null {
  let node = doc;
  while (node.content && node.content.length > 0) {
    node = node.content[0];
    if (node.type === "listItem") return node;
  }
  return null;
}

function boDau(node: Nut): void {
  if (node.type === "listItem") delete node.noiTiep;
  for (const con of node.content ?? []) boDau(con);
}

/**
 * Dau noiTiep chi hop le o mot cho: muc danh sach dau tien tren nhanh con dau tien cua to (dung cho splitDoc dat no,
 * xem src/components/editor/split.ts). Nhan Enter o muc noi tiep co the lam trinh soan thao chep thuoc tinh sang muc
 * moi; ham nay bo moi dau o cho khac. Thuan, tra ban moi.
 */
export function normalizeContinuation(doc: DocJson): DocJson {
  const out = structuredClone(doc);
  const goc = out as Nut;
  const giu = mucDau(goc)?.noiTiep === true;
  boDau(goc);
  const dau = mucDau(goc);
  if (giu && dau) dau.noiTiep = true;
  return out;
}
