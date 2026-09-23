import { isWeather, type Weather } from "./troi";

/*
 * Kiem dau vao cua lan tha tam trang, dung chung cho server action va hop chon. Ham thuan.
 * Do dai dem theo CODE POINT (khong phai don vi UTF-16), khop char_length cua Postgres trong CHECK moods_note
 * va khop bo dem o giao dien (khong dat maxLength tren o nhap, de 80 bieu tuong cam xuc thuc su go duoc).
 */
export const NOTE_MAX = 80;
/**
 * Nguong tu choi som truoc khi chuan hoa. Moi code point toi da chiem 2 don vi UTF-16 (`.length`), va dang
 * tach roi NFD co the nhan doi so ky tu cho mot chu co dau (vd "a" + dau sac rieng): nhan 4 la du du dia cho
 * ca hai truong hop trong khi van chan duoc chuoi cuc dai truoc khi chuan hoa no (chuanNhan la O(n)).
 */
const TRAN_THO = NOTE_MAX * 4;
export const CHON_TROI = "Chọn một kiểu trời trước đã.";
export const NHAN_DAI = `Lời nhắn tối đa ${NOTE_MAX} ký tự.`;
export const NHAN_HONG = "Lời nhắn không đọc được.";

export type MoodInput = { weather: Weather; note: string | null };

/** O nhap mot dong: ky tu dieu khien (xuong dong, tab) thanh dau cach, gop ve NFC, gop dau cach, cat hai dau. */
export function chuanNhan(s: string): string {
  const motDong = [...s].map((c) => {
    const ma = c.codePointAt(0) ?? 0;
    return ma < 32 || ma === 127 ? " " : c;
  }).join("");
  return motDong.normalize("NFC").replace(/ {2,}/g, " ").trim();
}

export function parseMoodInput(weather: unknown, note: unknown): MoodInput | { error: string } {
  if (!isWeather(weather)) return { error: CHON_TROI };
  if (note !== null && note !== undefined && typeof note !== "string") return { error: NHAN_HONG };
  const tho = note ?? "";
  // Chuoi goc dai hon moi cach viet hop le cua 80 chu thi tu choi ngay, khong chuan hoa ca mot chuoi khong lo.
  if (tho.length > TRAN_THO) return { error: NHAN_DAI };
  const gon = chuanNhan(tho);
  if ([...gon].length > NOTE_MAX) return { error: NHAN_DAI };
  return { weather, note: gon === "" ? null : gon };
}
