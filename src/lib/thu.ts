import { normalizeReplyBody, replyLength } from "@/lib/round-reply";
import { isStorable } from "@/lib/storable";
import { tenThang, thangCua, thangTruoc, truocThang, type Thang } from "@/lib/tam-trang/lich";

/*
 * Thu thang (dot nam 5b): moi nguoi mot la cho nguoi kia moi thang da khep. Luat chu dung chung cho may chu (guiThu) va o
 * viet thu, nen hai phia dem cung mot cach. Ham thuan, khong import react, next hay drizzle; now luon la tham so.
 */

/** Tran ky tu cua mot la thu, dem theo code point nhu char_length; khop CHECK thu_thang_noi_dung (co test). */
export const THU_TOI_DA = 1000;

export type KiemThu = { ok: true; noiDung: string } | { ok: false; reason: "empty" | "too-long" | "invalid" };

/**
 * Kiem chu gui len: chuoi Postgres luu duoc nguyen van, chuan hoa nhu loi hoi dap (CRLF ve LF, bo trong o hai dau, toi da
 * hai dong trong lien), con tu 1 toi THU_TOI_DA ky tu. Tra kem chu da chuan hoa, la chu duy nhat duoc luu.
 */
export function kiemThu(raw: unknown): KiemThu {
  if (typeof raw !== "string" || !isStorable(raw)) return { ok: false, reason: "invalid" };
  const noiDung = normalizeReplyBody(raw);
  const n = replyLength(noiDung);
  if (n === 0) return { ok: false, reason: "empty" };
  if (n > THU_TOI_DA) return { ok: false, reason: "too-long" };
  return { ok: true, noiDung };
}

/** Thang vua khep: thang truoc thang hien tai theo gio Viet Nam. Tu ngay 1 thang moi, thu cua thang nay duoc viet. */
export function thangVuaKhep(now: Date): Thang {
  return thangTruoc(thangCua(now));
}

/** Thang da khep (truoc thang hien tai theo gio Viet Nam): chi thang da khep moi viet thu va co tong ket. */
export function thangDaKhep(t: Thang, now: Date): boolean {
  return truocThang(t, thangCua(now));
}

/** Thu cua mot thang nhin tu phia nguoi xem: minh da gui chua, nguoi kia da gui chua. */
export type TrangThaiThu = { minhGui: boolean; kiaGui: boolean };

/**
 * Cho thu cua moi thang luon chi co MOT thu: to giay de viet (minh chua gui, ke ca khi nguoi kia da gui), thu nguoi kia
 * gui minh (ca hai da gui), hay dong cho (minh da gui, nguoi kia chua). Thu cua chinh minh khong bao gio hien.
 */
export function choThu(tt: TrangThaiThu): "viet" | "doc" | "cho" {
  if (!tt.minhGui) return "viet";
  return tt.kiaGui ? "doc" : "cho";
}

const hoaDau = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Dong nhac duoi tieu de Ke sach, voi thang vua khep: chi khi minh chua gui thu thang do. */
export function loiNhacThu(tt: TrangThaiThu, t: Thang, tenKia: string): string | null {
  if (tt.minhGui) return null;
  return tt.kiaGui ? `${tenKia} đã viết thư ${tenThang(t)} cho bạn` : `${hoaDau(tenThang(t))} đã khép, viết thư cho ${tenKia}`;
}

/** Nhan trang thai thu o dong tom tat mot thang; nguoi kia da viet ma minh chua gui thi mang dau Moi. */
export function nhanThu(tt: TrangThaiThu, tenKia: string): { chu: string; moi: boolean } {
  if (tt.minhGui) return { chu: tt.kiaGui ? `Đã có thư của ${tenKia}` : `Đã gửi, chờ thư ${tenKia}`, moi: false };
  return tt.kiaGui ? { chu: `${tenKia} đã viết cho bạn`, moi: true } : { chu: "Chưa ai viết thư", moi: false };
}
