/**
 * Loc Khoang Lang tap trung (task 2): MOT diem duy nhat quyet dinh noi dung doi phuong co hien khong.
 *
 * Ham thuan, khong doc DB, khong import next/server-only: nhan co tu `Me` da load (loadMe, mot cau select
 * duoc cache() theo request) de de test. Loader nao loc duoc trong SQL thi them dieu kien SQL thay vi goi
 * helper o day; helper nay dung cho cac loader chi loc duoc sau khi doc (vd listShelf can logic sau khi doc).
 *
 * Web chi co hai cho ngoi, nen "khong phai cua doi phuong" = "cua chinh nguoi xem": loc theo id tac gia,
 * khong bao gio loc theo ten.
 */

/** Loc chung theo mot truong id tac gia. Tat co thi tra nguyen mang; bat co thi chi giu dong cua minh. */
function locTheo<T, K extends keyof T>(rows: readonly T[], key: K, viewerId: string, khoangLang: boolean): T[] {
  if (!khoangLang) return [...rows];
  return rows.filter((r) => r[key] === viewerId);
}

/** Loc theo rounds.tacGiaId / tac gia cua luot, to. */
export function locTheoTacGia<T extends { tacGiaId: string }>(
  rows: readonly T[], viewerId: string, khoangLang: boolean,
): T[] {
  return locTheo(rows, "tacGiaId", viewerId, khoangLang);
}

/** Loc theo activity.actorId / nguoi lam. */
export function locTheoActor<T extends { actorId: string }>(
  rows: readonly T[], viewerId: string, khoangLang: boolean,
): T[] {
  return locTheo(rows, "actorId", viewerId, khoangLang);
}

/** Loc theo accountId (moods, thu_thang, seal_replies, round_replies...). */
export function locTheoTaiKhoan<T extends { accountId: string }>(
  rows: readonly T[], viewerId: string, khoangLang: boolean,
): T[] {
  return locTheo(rows, "accountId", viewerId, khoangLang);
}

/** Loc theo tuId (de_nghi, cam_xuc). */
export function locTheoTuId<T extends { tuId: string }>(
  rows: readonly T[], viewerId: string, khoangLang: boolean,
): T[] {
  return locTheo(rows, "tuId", viewerId, khoangLang);
}

/**
 * Ten doi phuong de hien (Q2, quyet dinh §0b): tat co thi tra dung ten; bat co thi tra chuoi rong - noi goi
 * tu bo khe ten (vd "Luot moi" thay vi "Luot moi cua Linh"). Khong co nhanh tra "nguoi kia": §0b cam cu the,
 * vi "nguoi kia" van chi thang doi phuong. Cho nao cau chu bat buoc can chu ngu thi dung cach dien dat chung
 * khong neu ten (vd "nguoi doc"), viet truc tiep o noi goi, khong qua ham nay.
 */
export function tenAnDanh(khoangLang: boolean, tenKia: string): string {
  return khoangLang ? "" : tenKia;
}
