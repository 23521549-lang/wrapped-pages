const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * So don vi UTF-16 cua ky tu bat dau o vi tri i neu Postgres luu duoc no, 0 neu khong: ky tu NUL (text va
 * jsonb deu bao loi) hoac nua cap surrogate le (jsonb bao loi, text lang le doi thanh U+FFFD).
 */
function storableWidth(s: string, i: number): 0 | 1 | 2 {
  const code = s.charCodeAt(i);
  if (code === 0 || isLow(code)) return 0;
  if (!isHigh(code)) return 1;
  return isLow(s.charCodeAt(i + 1)) ? 2 : 0;
}

/** Chuoi luu nguyen van duoc vao Postgres. Kiem bang ma ky tu de ma nguon khong phai chua chuoi thoat. */
export function isStorable(s: string): boolean {
  for (let i = 0; i < s.length; ) {
    const width = storableWidth(s, i);
    if (width === 0) return false;
    i += width;
  }
  return true;
}

/** Bo moi ky tu Postgres khong luu duoc (xem storableWidth), giu nguyen phan con lai. */
export function toStorable(s: string): string {
  if (isStorable(s)) return s;
  let out = "";
  for (let i = 0; i < s.length; ) {
    const width = storableWidth(s, i);
    if (width > 0) out += s.slice(i, i + width);
    i += width || 1;
  }
  return out;
}

/** Cat s toi da max don vi UTF-16 ma khong xe doi mot cap surrogate o cho cat. */
export function sliceWhole(s: string, max: number): string {
  return s.slice(0, isHigh(s.charCodeAt(max - 1)) ? max - 1 : max);
}
