/*
 * Byte dau cua cac loai tep anh, du de nhan dien loai va doc kich thuoc, khong giai ma duoc. Kiem don vi dung cac
 * manh nay thay cho tep that: repo khong can tep nhi phan cho moi dinh dang (e2e co anh that o tests/e2e/fixtures).
 */

type Manh = number | string | readonly number[] | Uint8Array;

/** Ghep cac manh byte: so la mot byte, chuoi la byte ASCII cua tung ky tu. */
export function ghep(...parts: Manh[]): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "number") out.push(p);
    else if (typeof p === "string") for (const ch of p) out.push(ch.charCodeAt(0));
    else out.push(...p);
  }
  return Uint8Array.from(out);
}

export const u16be = (n: number) => [(n >> 8) & 255, n & 255];
export const u16le = (n: number) => [n & 255, (n >> 8) & 255];
export const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
export const u32le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const u24le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

type JpegTuyChon = { orientation?: number; order?: "II" | "MM"; sof?: number };

/**
 * JPEG: SOI, APP1 Exif chi co the Orientation (khi co orientation), APP0 JFIF, khung SOF (mac dinh SOF0) width x height,
 * EOI. Gia tri SHORT trong the IFD nam o hai byte dau cua o 4 byte, theo thu tu byte cua TIFF.
 */
export function jpegDau(width: number, height: number, { orientation, order = "MM", sof = 0xc0 }: JpegTuyChon = {}): Uint8Array<ArrayBuffer> {
  const u16 = order === "II" ? u16le : u16be;
  const u32 = order === "II" ? u32le : u32be;
  const exif = orientation === undefined
    ? []
    : ghep([0xff, 0xe1], u16be(34), "Exif", 0, 0, order, u16(42), u32(8), u16(1), u16(0x0112), u16(3), u32(1), u16(orientation), 0, 0, u32(0));
  return ghep(
    [0xff, 0xd8],
    exif,
    [0xff, 0xe0], u16be(16), "JFIF", 0, [1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, sof], u16be(17), 8, u16be(height), u16be(width), 3, [1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xd9],
  );
}

export const pngDau = (w: number, h: number) =>
  ghep([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], u32be(13), "IHDR", u32be(w), u32be(h), [8, 6, 0, 0, 0], u32be(0));

export const gifDau = (w: number, h: number) => ghep("GIF89a", u16le(w), u16le(h), [0, 0, 0]);

/** WebP mo rong (VP8X): rong - 1 va cao - 1 moi thu 24 bit. */
export const webpDau = (w: number, h: number) =>
  ghep("RIFF", u32le(22), "WEBP", "VP8X", u32le(10), [0, 0, 0, 0], u24le(w - 1), u24le(h - 1));

/** BMP voi header DIB 40 byte; h am la anh luu tu tren xuong. */
export const bmpDau = (w: number, h: number) =>
  ghep("BM", u32le(54), [0, 0, 0, 0], u32le(54), u32le(40), u32le(w >>> 0), u32le(h >>> 0), u16le(1), u16le(24), Array.from({ length: 24 }, () => 0));

/** Tep ISO BMFF: hop ftyp voi nhan chinh va danh sach nhan tuong thich, roi cac hop them vao sau. */
export function isoDau(major: string, compat: readonly string[], ...hop: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return ghep(u32be(16 + 4 * compat.length), "ftyp", major, u32be(0), ...compat, ...hop);
}

/** Hop ispe: kich thuoc luu cua mot anh trong HEIF/AVIF. */
export const ispe = (w: number, h: number) => ghep(u32be(20), "ispe", u32be(0), u32be(w), u32be(h));
/** Hop irot: goc xoay nguoc chieu kim dong ho, don vi 90 do. */
export const irot = (goc: number) => ghep(u32be(9), "irot", goc);
/** Hop mdat rong: du lieu anh bat dau tu day. */
export const mdat = () => ghep(u32be(8), "mdat");

/** Loai tep khong nhan (spec muc 2.3) va vai tep khong phai anh, theo byte dau. */
export const KHONG_NHAN: Record<string, Uint8Array<ArrayBuffer>> = {
  "TIFF II": ghep("II", 42, 0, u32le(8), Array.from({ length: 16 }, () => 0)),
  "TIFF MM": ghep("MM", 0, 42, u32be(8), Array.from({ length: 16 }, () => 0)),
  "DNG, NEF, ARW, CR2 (TIFF)": ghep("II", 42, 0, u32le(16), "CR", 2, 0, Array.from({ length: 16 }, () => 0)),
  PSD: ghep("8BPS", 0, 1, Array.from({ length: 20 }, () => 0)),
  PDF: ghep("%PDF-1.7", 10, "%", Array.from({ length: 8 }, () => 0)),
  SVG: ghep('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
  "SVG co XML": ghep('<?xml version="1.0"?><svg/>'),
  HTML: ghep("<!doctype html><title>x</title>"),
  CR3: isoDau("crx ", ["crx ", "isom"]),
  RAF: ghep("FUJIFILMCCD-RAW 0201FF383501"),
  ORF: ghep("IIRO", 8, 0, 0, 0, Array.from({ length: 16 }, () => 0)),
  RW2: ghep("IIU", 0, 8, 0, 0, 0, Array.from({ length: 16 }, () => 0)),
  "MP4 video": isoDau("isom", ["isom", "mp41"]),
  "chu bat dau bang BM": ghep("BM chao em, day la mot tep chu"),
  "tep rong": ghep(),
  "ftyp cut": ghep(u32be(8), "ftyp"),
};

/** Tep chon tu may voi dung byte da cho; size ghi de de gia lap tep lon ma khong cap phat that. */
export function tepTu(byte: Uint8Array<ArrayBuffer>, ten: string, type = "", size?: number): File {
  const tep = new File([byte], ten, { type });
  if (size !== undefined) Object.defineProperty(tep, "size", { value: size });
  return tep;
}
