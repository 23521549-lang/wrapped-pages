/** Mau chat cho so trang hay so luot tren duong dan: khong nhan 1e3, 0x10, khoang trang hay so 0 dau. */
export const SO_TRANG = /^[1-9][0-9]{0,4}$/;

/** Duong dan man sua luot thu ordinal cua mot cuon, mo ngay to thu sheet cua luot (tu 1; to 1 thi khong can tham so). */
export function roundEditPath(bookId: string, ordinal: number, sheet = 1): string {
  return sheet > 1 ? `/sach/${bookId}/sua-luot/${ordinal}?trang=${sheet}` : `/sach/${bookId}/sua-luot/${ordinal}`;
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
