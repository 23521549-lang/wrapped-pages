/*
 * Nhan dien tep anh goc chon tu may bang byte that o dau tep, khong tin file.type hay duoi tep: anh chuyen qua Zalo,
 * Messenger hay Google Drive hay mat hoac sai type. Chay o trinh duyet truoc khi giai ma. Khac sniff.ts (may chu chi
 * nhan WebP va JPEG da ve lai, kiem ca tep): o day chi can biet loai va kich thuoc de chon cach giai ma.
 */

/** Cac loai anh goc nhan (spec muc 2.3). RAW, DNG, TIFF, PSD, SVG, PDF va moi thu khac la null. */
export type SourceKind = "jpeg" | "png" | "gif" | "webp" | "bmp" | "avif" | "heif";
export type SourceSize = { width: number; height: number };
/** Loai tep va kich thuoc da xoay theo huong chup; size null khi phan dau tep khong noi. */
export type SourceHeader = { kind: SourceKind; size: SourceSize | null };

/** So byte dau dung de nhan dien loai tep. */
export const KIND_BYTES = 64;
/**
 * So byte dau doc de tim kich thuoc: JPEG de khoi EXIF (toi 64 KB) va ICC truoc khung SOF, HEIF va AVIF de hop ispe
 * trong hop meta o dau tep. Khong thay trong doan nay thi coi nhu khong biet kich thuoc.
 */
export const HEADER_BYTES = 256 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOI = [0xff, 0xd8, 0xff];
/** Kich thuoc header DIB hop le cua BMP: nho vay mot tep chu bat dau bang "BM" khong bi nhan nham la anh. */
const BMP_DIB_SIZES = new Set([12, 40, 52, 56, 64, 108, 124]);
const AVIF_BRANDS = new Set(["avif", "avis"]);
/** Nhan HEIF ma HEVC: tep co mot trong cac nhan nay la HEIC du co ghi them nhan avif. */
const HEVC_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs"];
const HEIF_BRANDS = new Set([...HEVC_BRANDS, "mif1", "msf1"]);
const EXIF_ORIENTATION = 0x0112;

function matches(bytes: Uint8Array, at: number, signature: readonly number[]): boolean {
  return at + signature.length <= bytes.length && signature.every((b, i) => bytes[at + i] === b);
}

/** length ky tu ASCII tu vi tri at; thieu byte thi chuoi rong. */
function ascii(bytes: Uint8Array, at: number, length: number): string {
  if (at < 0 || at + length > bytes.length) return "";
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[at + i]);
  return s;
}

const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | (b[at + 2] << 16);
const u32le = (b: Uint8Array, at: number) => (u24le(b, at) | (b[at + 3] << 24)) >>> 0;
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | u16be(b, at + 2)) >>> 0;
const i32le = (b: Uint8Array, at: number) => u32le(b, at) | 0;

function positive(width: number, height: number): SourceSize | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

function turn(size: SourceSize | null, turned: boolean): SourceSize | null {
  return size && turned ? { width: size.height, height: size.width } : size;
}

/** Loai anh goc theo byte dau. Khong nhan thi null. */
export function sourceKind(bytes: Uint8Array): SourceKind | null {
  if (matches(bytes, 0, JPEG_SOI)) return "jpeg";
  if (matches(bytes, 0, PNG_SIGNATURE)) return "png";
  const head = ascii(bytes, 0, 6);
  if (head === "GIF87a" || head === "GIF89a") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 0, 2) === "BM" && bytes.length >= 18 && BMP_DIB_SIZES.has(u32le(bytes, 14))) return "bmp";
  return isoKind(bytes);
}

/**
 * Tep ISO BMFF: nhan chinh quyet truoc (avif, avis la AVIF; nhan HEVC la HEIF); nhan chinh chung chung (mif1, msf1)
 * thi xem danh sach tuong thich. Video MP4, CR3 cua Canon cung la ISO BMFF nhung khong co nhan nao o day.
 */
function isoKind(bytes: Uint8Array): SourceKind | null {
  if (ascii(bytes, 4, 4) !== "ftyp" || u32be(bytes, 0) < 16) return null;
  const end = Math.min(u32be(bytes, 0), bytes.length);
  const brands = [ascii(bytes, 8, 4)];
  for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(bytes, at, 4));
  const hevc = brands.some((b) => HEVC_BRANDS.includes(b));
  if (AVIF_BRANDS.has(brands[0]) || (!hevc && brands.some((b) => AVIF_BRANDS.has(b)))) return "avif";
  return brands.some((b) => HEIF_BRANDS.has(b)) ? "heif" : null;
}

/** Loai tep kem kich thuoc da xoay. bytes la HEADER_BYTES byte dau (hoac ca tep neu nho hon). */
export function readSourceHeader(bytes: Uint8Array): SourceHeader | null {
  const kind = sourceKind(bytes.subarray(0, KIND_BYTES));
  return kind && { kind, size: sourceSize(kind, bytes) };
}

function sourceSize(kind: SourceKind, bytes: Uint8Array): SourceSize | null {
  switch (kind) {
    case "jpeg":
      return jpegSize(bytes);
    case "png":
      return bytes.length >= 24 && ascii(bytes, 12, 4) === "IHDR" ? positive(u32be(bytes, 16), u32be(bytes, 20)) : null;
    case "gif":
      return bytes.length >= 10 ? positive(u16le(bytes, 6), u16le(bytes, 8)) : null;
    case "bmp":
      return bmpSize(bytes);
    case "webp":
      return webpSize(bytes);
    case "avif":
    case "heif":
      return isoSize(bytes);
  }
}

/** Moi ma SOF (C0 toi CF) tru C4 (bang Huffman), C8 (du tru) va CC (bang so hoc). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/**
 * Di qua cac segment sau SOI toi khung SOF dau tien va doc cao, rong. Khoi APP1 Exif co Orientation 5 toi 8 (anh luu
 * ngang ma hien doc, hoac nguoc lai) thi doi rong va cao. Gap SOS, EOI, segment hong hay het doan byte thi null.
 */
function jpegSize(bytes: Uint8Array): SourceSize | null {
  let at = 2;
  let turned = false;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null;
    const length = u16be(bytes, at + 2);
    if (length < 2) return null;
    const data = at + 4;
    if (marker === 0xe1 && exifTurned(bytes, data, at + 2 + length)) turned = true;
    if (isStartOfFrame(marker)) {
      return data + 5 <= bytes.length ? turn(positive(u16be(bytes, data + 3), u16be(bytes, data + 1)), turned) : null;
    }
    at += 2 + length;
  }
  return null;
}

/** Khoi APP1 bat dau tu from co the Orientation 5 toi 8 khong. Doc dung IFD0, theo thu tu byte cua TIFF (II hay MM). */
function exifTurned(bytes: Uint8Array, from: number, end: number): boolean {
  if (ascii(bytes, from, 4) !== "Exif" || bytes[from + 4] !== 0 || bytes[from + 5] !== 0) return false;
  const tiff = from + 6;
  const order = ascii(bytes, tiff, 2);
  if (order !== "II" && order !== "MM") return false;
  const le = order === "II";
  const u16 = (at: number) => (le ? u16le(bytes, at) : u16be(bytes, at));
  const u32 = (at: number) => (le ? u32le(bytes, at) : u32be(bytes, at));
  const limit = Math.min(end, bytes.length);
  if (tiff + 8 > limit) return false;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > limit) return false;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > limit) return false;
    if (u16(entry) === EXIF_ORIENTATION) {
      const orientation = u16(entry + 8);
      return orientation >= 5 && orientation <= 8;
    }
  }
  return false;
}

/** BMP: header 12 byte (OS/2) dung so 16 bit; con lai 32 bit co dau, cao am la anh luu tu tren xuong. */
function bmpSize(bytes: Uint8Array): SourceSize | null {
  if (bytes.length < 26) return null;
  if (u32le(bytes, 14) === 12) return positive(u16le(bytes, 18), u16le(bytes, 20));
  return positive(Math.abs(i32le(bytes, 18)), Math.abs(i32le(bytes, 22)));
}

/** WebP: chunk dau la VP8X (mo rong), VP8L (khong mat du lieu) hoac VP8 (nen mat du lieu). */
function webpSize(bytes: Uint8Array): SourceSize | null {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = u32le(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 " && bytes.length >= 30) return positive(u16le(bytes, 26) & 0x3fff, u16le(bytes, 28) & 0x3fff);
  return null;
}

/**
 * HEIF va AVIF: hop ispe lon nhat trong phan dau tep (anh luoi co nhieu o nho, anh chinh la cai lon nhat), doi rong va
 * cao khi co hop irot goc le (90 hoac 270 do). Tim theo ma hop chu khong di het cay hop meta, va dung o hop mdat (du
 * lieu anh): du de quyet co thu nho luc giai ma hay khong, sai thi chi mat buoc thu nho som.
 */
function isoSize(bytes: Uint8Array): SourceSize | null {
  let best: SourceSize | null = null;
  let turned = false;
  for (let at = 8; at + 4 <= bytes.length; at++) {
    const type = bytes[at] === 0x69 || bytes[at] === 0x6d ? ascii(bytes, at, 4) : "";
    if (type === "mdat") break;
    if (type === "ispe" && at + 16 <= bytes.length) {
      const size = positive(u32be(bytes, at + 8), u32be(bytes, at + 12));
      if (size && (!best || size.width * size.height > best.width * best.height)) best = size;
    } else if (type === "irot" && at + 5 <= bytes.length) {
      turned = (bytes[at + 4] & 3) % 2 === 1;
    }
  }
  return turn(best, turned);
}
