/**
 * To mo dau cua man doc, tinh tu 0. Uu tien ?trang=N hop le (1 toi count). Khong co thi voi sach cua
 * nguoi kia la to dau chua doc (moc + 1, tuc chi so mark); doc het roi, hoac la sach cua minh, thi to 1.
 * count la so to, lon hon 0.
 */
export function startSheet(trang: string | string[] | undefined, count: number, mark: number, mine: boolean): number {
  if (typeof trang === "string" && /^[0-9]+$/.test(trang)) {
    const n = Number(trang);
    if (n >= 1 && n <= count) return n - 1;
  }
  if (!mine && mark >= 0 && mark < count) return mark;
  return 0;
}
