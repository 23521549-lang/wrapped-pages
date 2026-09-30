import { isStorable } from "@/lib/storable";

/*
 * Sach viet cung "Hai Ngòi Bút" (dot nam 5c): cac luat thuan dung chung cho may chu va giao dien. Khong import react,
 * next hay drizzle.
 */

/** Ten luot dai toi da, dem theo ky tu. Phai khop CHECK rounds_ten cua bang rounds. */
export const TEN_LUOT_TOI_DA = 60;

/**
 * Ba loai de nghi cua mot cuon: chu cuon moi nguoi kia viet cung, nguoi kia xin viet vao cuon cua chu, va mot nguoi viet
 * de nghi xoa sach viet cung. Phai khop CHECK de_nghi_loai, cung thu tu (co test).
 */
export const LOAI_DE_NGHI = ["moi-viet", "xin-viet", "xoa-sach"] as const;
export type LoaiDeNghi = (typeof LOAI_DE_NGHI)[number];

/**
 * Ten luot da gom moi khoang trang thua ve mot dau cach (nhu ten sach); null la khong dung duoc: khong phai chuoi, rong,
 * dai qua TEN_LUOT_TOI_DA ky tu hay co ky tu Postgres khong luu duoc. Dem theo ky tu (code point), dung cach char_length
 * cua Postgres dem.
 */
export function parseTenLuot(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const ten = raw.trim().replace(/\s+/g, " ");
  const dai = [...ten].length;
  return dai < 1 || dai > TEN_LUOT_TOI_DA || !isStorable(ten) ? null : ten;
}

/** Ten hien cua mot luot: ten da dat, khong thi "Lượt N" (luot cu cua cuon chuyen sang, hay sach mot nguoi viet). */
export function tenHienLuot(ten: string | null, ordinal: number): string {
  return ten ?? `Lượt ${ordinal}`;
}

/** Chu cai dau (viet hoa) cua mot biet danh, cho hai o tron o goc bia sach viet cung; biet danh rong thi chuoi rong. */
export function chuCaiDau(ten: string): string {
  const dau = [...ten.trim()][0];
  return dau === undefined ? "" : dau.toLocaleUpperCase("vi-VN");
}
