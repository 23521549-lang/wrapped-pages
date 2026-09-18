/**
 * Mot don vi xep trang: mot dong chu (cat duoc giua cac dong) hoac mot khoi nguyen nhu anh, ghi am
 * (khong cat duoc). top/bottom la toa do doc lien mach tu dau tai lieu, don vi px logic.
 * pos la vi tri trong tai lieu noi to moi bat dau neu ngat truoc don vi nay.
 */
export type Unit = { top: number; bottom: number; pos: number };

/**
 * Mot to: cac don vi [from, to). top la toa do cua don vi dau tien. spaceLeft la cho trong con lai
 * o day to, tinh toi dinh don vi dau cua to sau; am khi mot khoi nguyen cao hon ca to.
 */
export type Sheet = { from: number; to: number; top: number; spaceLeft: number };

/**
 * Xep cac don vi da do thanh cac to co chieu cao vung chu co dinh. Ham thuan: khong biet gi ve
 * React, database hay mang. Don vi dau tien cua moi to luon o lai to do.
 */
export function paginate(units: readonly Unit[], contentHeight: number): Sheet[] {
  if (!(contentHeight > 0)) throw new RangeError("contentHeight phai lon hon 0");
  if (units.length === 0) return [{ from: 0, to: 0, top: 0, spaceLeft: contentHeight }];

  const sheets: Sheet[] = [];
  let from = 0;
  let top = units[0].top;
  for (let i = 1; i < units.length; i++) {
    if (units[i].bottom - top > contentHeight) {
      sheets.push({ from, to: i, top, spaceLeft: contentHeight - (units[i].top - top) });
      from = i;
      top = units[i].top;
    }
  }
  const last = units[units.length - 1];
  sheets.push({ from, to: units.length, top, spaceLeft: contentHeight - (last.bottom - top) });
  return sheets;
}
