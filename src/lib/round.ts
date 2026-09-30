/** Mau chat cho so trang hay so luot tren duong dan: khong nhan 1e3, 0x10, khoang trang hay so 0 dau. */
export const SO_TRANG = /^[1-9][0-9]{0,4}$/;

/** Duong dan man sua luot thu ordinal cua mot cuon, mo ngay to thu sheet cua luot (tu 1; to 1 thi khong can tham so). */
export function roundEditPath(bookId: string, ordinal: number, sheet = 1): string {
  return sheet > 1 ? `/sach/${bookId}/sua-luot/${ordinal}?trang=${sheet}` : `/sach/${bookId}/sua-luot/${ordinal}`;
}

/**
 * Duong sua cua tung to cho man doc. To cua luot do nguoi xem viet (mine; sach mot nguoi viet thi moi luot cua chu sach,
 * sach viet cung thi luot cua ai nguoi do sua, 5c): tro toi man sua luot chua no, mo ngay to do, ke ca to cua luot niem
 * phong con dong (chu du an 28/09). To cua nguoi kia, hay to khong thuoc luot nao: null.
 */
export function editHrefs(
  bookId: string, sheets: readonly { roundId: string; position: number }[],
  rounds: readonly { id: string; ordinal: number; first: number; mine: boolean }[],
): (string | null)[] {
  const luotCua = new Map(rounds.map((r) => [r.id, r]));
  return sheets.map((s) => {
    const r = luotCua.get(s.roundId);
    return r?.mine ? roundEditPath(bookId, r.ordinal, s.position - r.first + 1) : null;
  });
}

/**
 * To mo dau cua man sua luot tu ?trang=N (tu 1). Mau chat nhu so trang tren duong dan (khong nhan 1e3, 0x10, so 0 dau);
 * sai dang thi to 1, vuot so to cua luot (lien ket cu, luot vua duoc thu gon) thi to cuoi.
 */
export function roundSheetParam(trang: string | string[] | undefined, count: number): number {
  if (typeof trang !== "string" || !SO_TRANG.test(trang)) return 1;
  return Math.min(Number(trang), Math.max(1, count));
}

/** Luot chua to position, neu co. Ham thuan: may chu (sua luot) va man doc (khung hoi dap) dung chung. */
export function roundAt<T extends { first: number; last: number }>(list: readonly T[], position: number): T | undefined {
  return list.find((r) => r.first <= position && position <= r.last);
}
