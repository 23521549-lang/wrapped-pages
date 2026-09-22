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

/** Nut bat ky tren cay tai lieu, du de doc va dat dau noiTiep. */
type Khoi = { type: string; content?: Khoi[]; noiTiep?: true };

/** Cac nut tren nhanh con dau tien, tu tang 1 xuong toi het khoi (khong tinh chu va xuong dong). */
function nhanhDau(goc: Khoi): Khoi[] {
  const out: Khoi[] = [];
  for (let n = goc.content?.[0]; n && n.type !== "text" && n.type !== "hardBreak"; n = n.content?.[0]) out.push(n);
  return out;
}

function boMoiDau(n: Khoi): void {
  delete n.noiTiep;
  for (const k of n.content ?? []) boMoiDau(k);
}

/**
 * Dau noiTiep hop le tren cac to cua mot lan dang hay mot luot vua sua: to dau khong co dau nao (luot bat dau tu dau
 * tai lieu); to sau chi giu dau tren nhanh dau, dung noi splitDoc dat. Dau o moi cho khac (goi tu dung, hay trinh soan
 * thao chep nham) bi bo, de joinSheets khong bao gio noi sai. Thuan, tra ban moi.
 */
export function normalizeSheets(sheets: readonly DocJson[]): DocJson[] {
  return sheets.map((sheet, i) => {
    const out = structuredClone(sheet) as unknown as Khoi;
    const giu = i > 0 ? nhanhDau(out).filter((n) => n.noiTiep === true) : [];
    boMoiDau(out);
    for (const n of giu) n.noiTiep = true;
    return out as unknown as DocJson;
  });
}
