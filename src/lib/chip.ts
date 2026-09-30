import { normalizeReplyBody, replyLength } from "@/lib/round-reply";
import { isStorable } from "@/lib/storable";
import { dayKey, momentLabel, timeLabel } from "@/lib/when";

/*
 * Chip biet noi (dot nam 5e): luat chu va loi dan dung chung cho may chu va to tro chuyen. Ham thuan, khong import
 * react, next hay drizzle; now luon la tham so.
 */

/** Tin nguoi dung go toi da (ky tu, dem nhu char_length). */
export const NHAP_TOI_DA = 500;
/** Moi tin luu toi da; khop CHECK chip_tin_noi_dung (co test). */
export const TIN_TOI_DA = 2000;
/** So tin giu moi nguoi; cu hon tu xoa khi ghi tin moi. */
export const GIU_TIN = 200;
/** So tin gan nhat gui AI lam ngu canh. */
export const NGU_CANH_TIN = 16;
/** Hai tin cua cung mot nguoi cach nhau it nhat chung nay (may chu chan). */
export const CACH_HOI_MS = 3000;
/** Vang it nhat chung nay thi Chip chao "ve roi". */
export const VANG_LAU_MS = 6 * 3600_000;
/** Het han muc ngan hon chung nay (han muc phut) thi khong ngu, chi xin cho vai giay. */
export const NGU_TU_MS = 10 * 60_000;

export type KiemTin = { ok: true; noiDung: string } | { ok: false };

/** Kiem tin nguoi dung go: chuoi luu duoc, chuan hoa nhu loi hoi dap, 1 toi NHAP_TOI_DA ky tu. */
export function kiemTinChip(raw: unknown): KiemTin {
  if (typeof raw !== "string" || !isStorable(raw)) return { ok: false };
  const noiDung = normalizeReplyBody(raw);
  const n = replyLength(noiDung);
  return n === 0 || n > NHAP_TOI_DA ? { ok: false } : { ok: true, noiDung };
}

/**
 * Loi dan he thong cho Chip: ten, tinh cach, luat giu bi mat, chi noi dua tren ngu canh, do dai va cach viet. nguCanh la
 * chuoi may chu dung tu du lieu nguoi hoi von thay (src/server/chip/ngu-canh.ts).
 */
export function loiDanChip(tenMinh: string, tenKia: string, nguCanh: string): string {
  return [
    `Bạn là Chíp, một chú gà con 3D sống trong web nhật ký riêng "Món Quà Của Em" của đúng hai người: ${tenMinh} và ${tenKia}.`,
    `Người đang nói chuyện với bạn là ${tenMinh}. Xưng "Chíp", gọi ${tenMinh} bằng tên, gọi người kia là ${tenKia}.`,
    "Tính cách: hiền, ấm áp, hơi tinh nghịch, quan tâm thật lòng. Nói tiếng Việt tự nhiên như một người bạn nhỏ.",
    "Trả lời ngắn: thường 1 tới 3 câu, tối đa khoảng 120 từ. Không dùng tiêu đề, danh sách dài, bảng, liên kết hay mã.",
    "Chỉ được in đậm bằng **hai dấu sao**. Không dùng dấu gạch dài. Ít biểu tượng cảm xúc (nhiều nhất một).",
    "Chỉ nói dựa trên NGỮ CẢNH bên dưới và cuộc trò chuyện. Không bịa việc chưa xảy ra. Không biết thì nói thẳng là Chíp không biết,",
    "và gợi chỗ trên web để xem (Kệ sách, Lịch hoa, Dấu thời gian, Bản nháp, Cài đặt).",
    `Giữ bí mật hai phía: không kể lại cho ${tenMinh} những gì ${tenKia} tâm sự riêng với Chíp (bạn cũng không được biết chúng).`,
    "Trang niêm phong chưa mở, bản nháp và sách riêng tư của người kia là bí mật: bạn không biết nội dung của chúng và không đoán.",
    "",
    "NGỮ CẢNH (chỉ những gì người đang nói chuyện vốn thấy trên web):",
    nguCanh,
  ].join("\n");
}

/**
 * Lam sach cau Chip tra loi truoc khi luu: bo the suy nghi con sot, bo tieu de va dau danh sach markdown, doi lien ket
 * [chu](url) thanh chu, doi dau gach dai thanh dau phay, gom dong trong, cat TIN_TOI_DA ky tu. Chi con **dam** cua markdown.
 */
/** Dau gach dai va gach ngang (em dash, en dash) kem khoang trang quanh no; viet bang ma so de tep nguon khong chua ky tu do. */
const GACH_DAI = new RegExp(`\\s*[${String.fromCharCode(0x2014, 0x2013)}]\\s*`, "g");

export function lamSachTraLoi(raw: string): string {
  const s = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/`+/g, "")
    .replace(GACH_DAI, ", ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [...s].slice(0, TIN_TOI_DA).join("");
}

/** Doan cua mot tin: chu thuong hay chu dam (tu **...**), o la vi tri trong tin (khoa duy nhat). Giao dien tu ve, khong bao gio dung HTML. */
export type DoanTin = { chu: string; dam: boolean; o: number };

/** Tach **dam** trong tin Chip thanh cac doan; dau sao le loi thi giu nguyen la chu. */
export function tachDam(tin: string): DoanTin[] {
  const ra: DoanTin[] = [];
  const re = /\*\*([^*\n]+)\*\*/g;
  let cuoi = 0;
  for (let m = re.exec(tin); m !== null; m = re.exec(tin)) {
    if (m.index > cuoi) ra.push({ chu: tin.slice(cuoi, m.index), dam: false, o: cuoi });
    ra.push({ chu: m[1], dam: true, o: m.index });
    cuoi = m.index + m[0].length;
  }
  if (cuoi < tin.length) ra.push({ chu: tin.slice(cuoi), dam: false, o: cuoi });
  return ra;
}

/** Luc Chip day, noi bang chu: "7 giờ sáng mai", "lúc 14:30", hay ngay gio cu the (gio Viet Nam). */
export function lucDay(den: Date, now: Date): string {
  const gio = timeLabel(den);
  const homNay = dayKey(now) === dayKey(den);
  const mai = dayKey(new Date(now.getTime() + 86_400_000)) === dayKey(den);
  const [h] = gio.split(":").map(Number);
  const buoi = h < 11 ? "sáng" : h < 14 ? "trưa" : h < 18 ? "chiều" : "tối";
  const tron = gio.endsWith(":00");
  if (homNay) return tron ? `${h} giờ ${buoi} nay` : `lúc ${gio}`;
  if (mai) return tron ? `${h} giờ ${buoi} mai` : `${gio} ${buoi} mai`;
  return `lúc ${momentLabel(den, now)}`;
}

/** Moc day mac dinh khi dich vu AI khong noi luc hoi: 07:00 sang hom sau, gio Viet Nam (UTC+7, khong doi gio mua he). */
export function bayGioSangMai(now: Date): Date {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1, 0, 0, 0));
}

/** Cau Chip tra loi khi het han muc ngay. */
export const cauDiNgu = (den: Date, now: Date) => `Chíp mệt rồi, đi ngủ chút nha. ${viHoaDau(lucDay(den, now))} Chíp dậy nói chuyện tiếp.`;
/** Cau khi het han muc phut. */
export const cauThoChut = (giay: number) => `Chíp thở một chút đã, ${Math.max(1, Math.ceil(giay))} giây nữa hỏi lại nhé.`;
/** Cau khi dich vu AI loi khac (mang, may chu). */
export const CAU_NGHE_CHUA_RO = "Chíp nghe chưa rõ, nói lại giúp Chíp nhé.";
/** Cau khi chua co chia khoa AI. */
export const CAU_CHUA_DANH_THUC = "Chíp chưa được đánh thức nên chưa trò chuyện được. Thả cảm xúc thì vẫn được nhé.";

function viHoaDau(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
