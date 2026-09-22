import type { DocJson } from "./types";

/** Nut bat ky tren cay tai lieu, du de doc va dat dau noiTiep. */
type Khoi = { type: string; content?: Khoi[]; noiTiep?: boolean };

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
 * tai lieu); to sau chi giu dau true tren nhanh dau va dau false tren khoi dau, dung noi splitDoc dat. Dau o moi cho
 * khac (goi tu dung, hay trinh soan thao chep nham) bi bo, de joinSheets khong bao gio noi sai. Thuan, tra ban moi.
 */
export function normalizeSheets(sheets: readonly DocJson[]): DocJson[] {
  return sheets.map((sheet, i) => {
    const out = structuredClone(sheet) as unknown as Khoi;
    const nhanh = i > 0 ? nhanhDau(out) : [];
    const giu = nhanh.filter((n) => n.noiTiep === true);
    const bien = nhanh[0]?.noiTiep === false ? nhanh[0] : undefined;
    boMoiDau(out);
    for (const n of giu) n.noiTiep = true;
    if (bien) bien.noiTiep = false;
    return out as unknown as DocJson;
  });
}
