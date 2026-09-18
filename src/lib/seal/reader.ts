import type { ReaderSeal, ReaderSheet } from "./types";

/**
 * Cach ve mot to trong sach lat. "khoa": to nam trong niem phong con khoa voi nguoi xem, chi co dong he lo.
 * "dau": to cua chinh nguoi xem, doc duoc, nhung nguoi kia chua mo.
 */
export type SheetLook = { kind: "thuong" } | { kind: "khoa"; teaser: string | null } | { kind: "dau"; label: string };

const NHAN_DAU = {
  "cau-do": "Đang niêm phong bằng câu đố",
  "trao-doi": "Đang niêm phong bằng trao đổi",
} as const;

/** Cach ve tung to, theo dung thu tu cua sheets. Chi dung du lieu da duoc may chu loc cho nguoi xem. */
export function sheetLooks(
  sheets: readonly Pick<ReaderSheet, "locked" | "sealId" | "teaser">[],
  seals: readonly ReaderSeal[],
): SheetLook[] {
  const byId = new Map(seals.map((s) => [s.id, s]));
  return sheets.map((sheet): SheetLook => {
    if (sheet.locked) return { kind: "khoa", teaser: sheet.teaser };
    const s = sheet.sealId === null ? undefined : byId.get(sheet.sealId);
    if (s && s.mine && s.kind !== "hen-gio" && s.openedAt === null) return { kind: "dau", label: NHAN_DAU[s.kind] };
    return { kind: "thuong" };
  });
}

/** Loai khung thu thach duoi sach cho mot niem phong, theo nguoi xem va trang thai. */
export type PanelKind = "cau-do" | "hen-gio" | "trao-doi" | "cua-toi" | "trang-tra-loi" | "tang-khoa";

/**
 * Khung nao hien duoi sach cho niem phong s, hoac null khi khong can khung. Hen gio chi co dong ho khi con
 * khoa. Trang tra loi da gui thi ca hai nguoi thay no. Chu sach luon co khung cua minh cho cau do va trao
 * doi. Nguoi kia: con khoa thi khung thu thach, mo roi thi chi con loi nhan tang chia khoa neu co.
 */
export function panelOf(s: ReaderSeal): PanelKind | null {
  if (s.kind === "hen-gio") return s.locked ? "hen-gio" : null;
  if (s.reply !== null) return "trang-tra-loi";
  if (s.mine) return "cua-toi";
  if (s.locked) return s.kind;
  return s.giftNote !== null ? "tang-khoa" : null;
}

/** Cac niem phong phu it nhat mot to trong khoang first toi last (vi tri tu 1), theo thu tu cua seals. */
export function sealsInView(seals: readonly ReaderSeal[], first: number, last: number): ReaderSeal[] {
  return seals.filter((s) => s.firstPosition <= last && s.lastPosition >= first);
}

/** "trang 5" hoac "trang 5 toi 7". */
export function pageRange(first: number, last: number): string {
  return first === last ? `trang ${first}` : `trang ${first} tới ${last}`;
}

/** pageRange viet hoa chu dau, dung o dau cau hay dau mot dong: "Trang 5", "Trang 5 toi 7". */
export function pageRangeTitle(first: number, last: number): string {
  const s = pageRange(first, last);
  return s.charAt(0).toLocaleUpperCase("vi") + s.slice(1);
}

/** Noi chay nghi thuc mo: chi so to dau cua niem phong trong sheets, va ma niem phong da duoc kiem. */
export type RevealTarget = { index: number; sealId: string };

/**
 * Noi chay nghi thuc mo, hoac null. Chi khi URL co mo=<sealId>, niem phong do co trong sach va may chu tra
 * ritual: true cho no (chinh nguoi xem vua tu mo trong RITUAL_WINDOW_MS). Man doc khong tu suy tu locked
 * hay kind: tang chia khoa, hen gio, chu sach, tab cu gui dap an sau khi duoc tang va URL cu deu co ritual false.
 * Chay tren to dau cua niem phong: day la to nguoi doc duoc dua toi qua trang=, cac to sau hien thang. Tra kem
 * sealId de man doc dung dung niem phong nay, khong phai suy nguoc tu vi tri to.
 */
export function revealTarget(
  sheets: readonly Pick<ReaderSheet, "position">[],
  seals: readonly ReaderSeal[],
  mo: string | string[] | undefined,
): RevealTarget | null {
  if (typeof mo !== "string") return null;
  const s = seals.find((x) => x.id === mo);
  if (!s || !s.ritual) return null;
  const i = sheets.findIndex((sheet) => sheet.position === s.firstPosition);
  return i >= 0 ? { index: i, sealId: s.id } : null;
}

/** Khoa sessionStorage danh dau nghi thuc mo cua mot niem phong da chay trong tab nay. */
export function ritualKey(sealId: string): string {
  return `mqce:nghi-thuc:${sealId}`;
}
