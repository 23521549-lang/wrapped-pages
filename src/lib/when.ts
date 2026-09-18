/**
 * Thoi diem hien cho nguoi dung, luon theo gio Viet Nam de may chu va trinh duyet ra cung mot chu.
 * now la tham so, nen ham thuan va kiem thu duoc.
 */
const VUNG = "Asia/Ho_Chi_Minh";
const NGAY = new Intl.DateTimeFormat("en-GB", { timeZone: VUNG, year: "numeric", month: "2-digit", day: "2-digit" });
const GIO = new Intl.DateTimeFormat("en-GB", { timeZone: VUNG, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

type Ngay = { y: number; m: number; d: number };

function phan(fmt: Intl.DateTimeFormat, at: Date): Record<string, string> {
  return Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
}

function ngayCua(at: Date): Ngay {
  const p = phan(NGAY, at);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

/** Doi ngay lich (gio Viet Nam) ra so ngay tuyet doi ke tu moc epoch, de tru duoc voi nhau. */
function soNgay(n: Ngay): number {
  return Date.UTC(n.y, n.m - 1, n.d) / 86_400_000;
}

/** So ngay lich tu at toi now, dem theo gio Viet Nam. */
function soNgayLech(at: Date, now: Date): number {
  return soNgay(ngayCua(now)) - soNgay(ngayCua(at));
}

/** Gio phut theo gio Viet Nam, 24 gio, vd 07:41. */
export function timeLabel(at: Date): string {
  const p = phan(GIO, at);
  return `${p.hour}:${p.minute}`;
}

/** Dem so co it nhat hai chu so, vd 4 -> "04". */
export function haiChuSo(x: number): string {
  return String(x).padStart(2, "0");
}

function ngayThang(at: Date, now: Date): string {
  const a = ngayCua(at);
  const dm = `${haiChuSo(a.d)}.${haiChuSo(a.m)}`;
  return a.y === ngayCua(now).y ? dm : `${dm}.${a.y}`;
}

/** Cho the sach: vua xong, 41 phut truoc, 6 gio truoc, hom qua, 04.09, 04.09.2025. */
export function timeAgo(at: Date, now: Date): string {
  const phut = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (phut < 1) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const lech = soNgayLech(at, now);
  if (lech <= 0) return `${Math.floor(phut / 60)} giờ trước`;
  if (lech === 1) return "hôm qua";
  return ngayThang(at, now);
}

/** Cho ban nhap: Luu luc 21:04, Luu hom qua 23:12, Luu ngay 04.09, Luu ngay 31.12.2025. */
export function savedLabel(at: Date, now: Date): string {
  const lech = soNgayLech(at, now);
  if (lech <= 0) return `Lưu lúc ${timeLabel(at)}`;
  if (lech === 1) return `Lưu hôm qua, ${timeLabel(at)}`;
  return `Lưu ngày ${ngayThang(at, now)}`;
}

const THU = ["chủ nhật", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy"];

/** Cho nhat ky go cua va loi nhan: hom nay, 07:41 / hom qua, 21:02 / 04.09, 21:02 / 31.12.2025, 21:02. */
export function momentLabel(at: Date, now: Date): string {
  const lech = soNgayLech(at, now);
  const ngay = lech <= 0 ? "hôm nay" : lech === 1 ? "hôm qua" : ngayThang(at, now);
  return `${ngay}, ${timeLabel(at)}`;
}

/** Khoa ngay lich theo gio Viet Nam, vd 2026-09-04: hai thoi diem cung ngay thi cung khoa. */
export function dayKey(at: Date): string {
  const n = ngayCua(at);
  return `${n.y}-${haiChuSo(n.m)}-${haiChuSo(n.d)}`;
}

/** Cho dau nhom ngay cua dong Hoat dong: Hom nay, Hom qua, 04.09, 04.09.2025. */
export function dayLabel(at: Date, now: Date): string {
  const lech = soNgayLech(at, now);
  if (lech <= 0) return "Hôm nay";
  if (lech === 1) return "Hôm qua";
  return ngayThang(at, now);
}

/** Cho hen gio: Mo luc 07:00, thu bay 24.10.2026. Luon kem nam, vi hen gio co the xa toi 10 nam. */
export function openLabel(at: Date): string {
  const n = ngayCua(at);
  const thu = THU[new Date(Date.UTC(n.y, n.m - 1, n.d)).getUTCDay()];
  return `Mở lúc ${timeLabel(at)}, ${thu} ${haiChuSo(n.d)}.${haiChuSo(n.m)}.${n.y}`;
}
