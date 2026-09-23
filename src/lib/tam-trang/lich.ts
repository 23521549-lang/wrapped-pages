import { dateLabel, dayKey, timeLabel } from "@/lib/when";
import type { Weather } from "./troi";

/*
 * Luat thoi gian va lich cua Tha tam trang. Ham thuan: now luon la tham so, nen may chu va test ra cung mot chu.
 * Gio Viet Nam la UTC+7 co dinh (Viet Nam khong dung gio mua he tu 1975), cung quy uoc voi dayKey cua src/lib/when.ts;
 * phia SQL dung `at time zone 'Asia/Ho_Chi_Minh'` cho cung mot ranh gioi ngay.
 */

/** Mot tam trang giu 24 gio ke tu luc tha. */
export const MOOD_TTL_MS = 24 * 60 * 60 * 1000;
const LECH_VN_MS = 7 * 60 * 60 * 1000;

/** Mot thang lich, m tu 1 toi 12. */
export type Thang = { y: number; m: number };

function phanNgay(at: Date): [number, number, number] {
  const [y, m, d] = dayKey(at).split("-").map(Number);
  return [y, m, d];
}

export function thangCua(at: Date): Thang {
  const [y, m] = phanNgay(at);
  return { y, m };
}

/** Ngay trong thang (1 toi 31) theo gio Viet Nam. */
export function ngayTrongThang(at: Date): number {
  return phanNgay(at)[2];
}

export function thangKhoa(t: Thang): string {
  return `${t.y}-${String(t.m).padStart(2, "0")}`;
}

export function thangTruoc(t: Thang): Thang {
  return t.m === 1 ? { y: t.y - 1, m: 12 } : { y: t.y, m: t.m - 1 };
}

export function thangSau(t: Thang): Thang {
  return t.m === 12 ? { y: t.y + 1, m: 1 } : { y: t.y, m: t.m + 1 };
}

function soThang(t: Thang): number {
  return t.y * 12 + t.m - 1;
}

const MAU_THANG = /^([0-9]{4})-(0[1-9]|1[0-2])$/;

/** Tham so ?thang=YYYY-MM. Sai dang, truoc nam 2000 hay o tuong lai thi ve thang hien tai: lich khong co gi de xem o do. */
export function docThang(q: unknown, now: Date): Thang {
  const nay = thangCua(now);
  if (typeof q !== "string") return nay;
  const khop = MAU_THANG.exec(q);
  if (khop === null) return nay;
  const t = { y: Number(khop[1]), m: Number(khop[2]) };
  return t.y < 2000 || soThang(t) > soThang(nay) ? nay : t;
}

export function laThangNay(t: Thang, now: Date): boolean {
  return soThang(t) === soThang(thangCua(now));
}

export function soNgayCua(t: Thang): number {
  return new Date(Date.UTC(t.y, t.m, 0)).getUTCDate();
}

/** Khoang [from, to) cua thang theo gio Viet Nam: loc set_at bang so sanh thang tren cot, dung duoc chi muc. */
export function khoangThang(t: Thang): { from: Date; to: Date } {
  const sau = thangSau(t);
  return {
    from: new Date(Date.UTC(t.y, t.m - 1, 1) - LECH_VN_MS),
    to: new Date(Date.UTC(sau.y, sau.m - 1, 1) - LECH_VN_MS),
  };
}

/** Mot o cua luoi thang; o ngoai thang co ngay = null. key on dinh cho React. */
export type OLich = { key: string; ngay: number | null; tuongLai: boolean; homNay: boolean };
export type TuanLich = { key: string; xa: boolean; o: OLich[] };

/**
 * Luoi thang bat dau tu thu Hai, moi tuan bay o, o ngoai thang co ngay = null. homNay la ngay hom nay khi t la thang nay,
 * con lai null (thang cu khong co ngay tuong lai). Tuan xa: ngay dau tien cua tuan da o tuong lai, chi ve mot dong so.
 */
export function luoiThang(t: Thang, homNay: number | null): TuanLich[] {
  const dau = (new Date(Date.UTC(t.y, t.m - 1, 1)).getUTCDay() + 6) % 7;
  const o: OLich[] = [];
  const trong = (): OLich => ({ key: `trong-${o.length}`, ngay: null, tuongLai: false, homNay: false });
  for (let i = 0; i < dau; i++) o.push(trong());
  for (let d = 1; d <= soNgayCua(t); d++) o.push({ key: `ngay-${d}`, ngay: d, tuongLai: homNay !== null && d > homNay, homNay: d === homNay });
  while (o.length % 7 !== 0) o.push(trong());
  const tuan: TuanLich[] = [];
  for (let w = 0; w < o.length; w += 7) {
    const hang = o.slice(w, w + 7);
    const dauTuan = hang.find((x) => x.ngay !== null);
    tuan.push({ key: `tuan-${w / 7}`, xa: dauTuan?.tuongLai === true, o: hang });
  }
  return tuan;
}

const THU = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** Tieu de khung chi tiet ngay, cung kieu ngay cua ca web (dateLabel): Thu Ba, 22.09; nam khac thi Thu Tu, 31.12.2025. */
export function tenNgay(t: Thang, ngay: number, now: Date): string {
  // 12:00 gio Viet Nam cua ngay do: giua ngay, khong bao gio lech sang ngay ben canh.
  const trua = new Date(Date.UTC(t.y, t.m - 1, ngay, 5));
  return `${THU[trua.getUTCDay()]}, ${dateLabel(trua, now)}`;
}

/** Thoi gian con lai cua tam trang dang giu: con 17 gio, con 40 phut. It nhat 1 phut, vi da het han thi khong con hien. */
export function conLai(endsAt: Date, now: Date): string {
  const phut = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / 60_000));
  return phut < 60 ? `còn ${phut} phút` : `còn ${Math.floor(phut / 60)} giờ`;
}

/** Duoi dai troi: Tha luc 21:40, hoac Tha luc 23:30 hom qua (tam trang chi song 24 gio nen khong xa hon hom qua). */
export function thaLabel(setAt: Date, now: Date): string {
  const gio = `Thả lúc ${timeLabel(setAt)}`;
  return dayKey(setAt) === dayKey(now) ? gio : `${gio} hôm qua`;
}

/** Goc xoay bong hoa tren lich, tat dinh theo id (FNV-1a): tai lai trang thi hoa nam y nguyen, nhu hoa ep that. */
export function xoayHoa(seed: string): number {
  let h = 2_166_136_261;
  for (const c of seed) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16_777_619);
  return ((h >>> 0) % 23) - 11;
}

export type HoaNgay = { weather: Weather; gio: string; note: string | null; xoay: number };
export type NgayLich = { kia: HoaNgay | null; minh: HoaNgay | null };
/** Mot dong lich tu may chu: tam trang cuoi cung cua mot nguoi trong ngay `ngay` (YYYY-MM-DD, gio Viet Nam). */
export type DongLich = { id: string; accountId: string; weather: Weather; note: string | null; setAt: Date; ngay: string };

/** Gom cac dong lich thanh ngay trong thang -> hoa cua nguoi kia va cua minh. Ngay khong ai tha thi khong co khoa. */
export function gomLich(rows: readonly DongLich[], meId: string): Record<number, NgayLich> {
  const ra: Record<number, NgayLich> = {};
  for (const r of rows) {
    const ngay = Number(r.ngay.slice(8, 10));
    const o = ra[ngay] ?? { kia: null, minh: null };
    const hoa: HoaNgay = { weather: r.weather, gio: timeLabel(r.setAt), note: r.note, xoay: xoayHoa(r.id) };
    ra[ngay] = r.accountId === meId ? { ...o, minh: hoa } : { ...o, kia: hoa };
  }
  return ra;
}

/** Tam trang hien tai cua hai nguoi, chia theo nguoi xem. */
export function chiaTamTrang<T extends { accountId: string }>(rows: readonly T[], meId: string): { minh: T | null; kia: T | null } {
  return { minh: rows.find((r) => r.accountId === meId) ?? null, kia: rows.find((r) => r.accountId !== meId) ?? null };
}

/** Mot bau troi dang hien tren ke sach: chu tinh san o may chu theo gio Viet Nam, nen trinh duyet khong can dong ho. */
export type TroiHien = { weather: Weather; note: string | null; tha: string; gio: string };

export function troiHien(m: { weather: Weather; note: string | null; setAt: Date }, now: Date): TroiHien {
  return { weather: m.weather, note: m.note, tha: thaLabel(m.setAt, now), gio: timeLabel(m.setAt) };
}
