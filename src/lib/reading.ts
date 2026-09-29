/**
 * To mo dau cua man doc, tinh tu 0 (spec 5a muc F2). Uu tien ?trang=N hop le (1 toi count). Khong co thi trang dang
 * doc do cua nguoi xem (lastPosition, tinh tu 1) neu con trong cuon, voi ca sach cua minh lan cua nguoi kia. Chua doc do
 * thi voi sach cua nguoi kia la to nho nhat chua tung thay (chuaDoc, tinh tu 1); da thay het (chuaDoc la 0), hoac la sach
 * cua minh, thi to 1. count la so to, lon hon 0.
 */
export function startSheet(
  trang: string | string[] | undefined, count: number, lastPosition: number | null, chuaDoc: number, mine: boolean,
): number {
  if (typeof trang === "string" && /^[0-9]+$/.test(trang)) {
    const n = Number(trang);
    if (n >= 1 && n <= count) return n - 1;
  }
  if (lastPosition !== null && lastPosition >= 1 && lastPosition <= count) return lastPosition - 1;
  if (!mine && chuaDoc >= 1 && chuaDoc <= count) return chuaDoc - 1;
  return 0;
}
