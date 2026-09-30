/*
 * Thu thang (dot nam 5b): moi nguoi mot la cho nguoi kia moi thang. Module thuan, khong import react, next hay drizzle.
 */

/** Thang YYYY-MM, 01 toi 12. Khop CHECK thu_thang_thang cua bang thu_thang (co test). */
export const THANG = /^(\d{4})-(0[1-9]|1[0-2])$/;

const TEN_THANG = ["Một", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười", "Mười Một", "Mười Hai"] as const;

/** Nam va thang (1 toi 12) cua mot chuoi YYYY-MM; sai dang thi null. */
export function docThang(v: unknown): { nam: number; thang: number } | null {
  if (typeof v !== "string") return null;
  const m = THANG.exec(v);
  return m ? { nam: Number(m[1]), thang: Number(m[2]) } : null;
}

/** "tháng Chín" cua chuoi YYYY-MM hop le. */
export function tenThang(thang: string): string {
  const t = docThang(thang);
  if (t === null) throw new Error(`thang sai dang: ${thang}`);
  return `tháng ${TEN_THANG[t.thang - 1]}`;
}
