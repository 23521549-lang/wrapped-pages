import type { AudioMime, ImageMime } from "./kinds";

/** Mime that doc tu byte dau tep; anh kem kich thuoc that tinh bang diem anh. */
export type Sniffed = { mime: ImageMime; width: number; height: number } | { mime: AudioMime };

type Size = { width: number; height: number };

const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const VP8 = [0x56, 0x50, 0x38, 0x20];
const VP8L = [0x56, 0x50, 0x38, 0x4c];
const VP8X = [0x56, 0x50, 0x38, 0x58];
const VP8_START_CODE = [0x9d, 0x01, 0x2a];
const VP8L_SIGNATURE = 0x2f;
/** Du lieu chunk dau tien cua WebP bat dau sau RIFF, kich thuoc, WEBP, ma chunk va kich thuoc chunk. */
const WEBP_CHUNK_DATA = 20;

const JPEG_SOI = [0xff, 0xd8, 0xff];
const JPEG_SOF0 = 0xc0;
const JPEG_SOF2 = 0xc2;
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;
const JPEG_TEM = 0x01;
const JPEG_RST0 = 0xd0;
const JPEG_RST7 = 0xd7;

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const EBML_DOCTYPE = 0x4282;
const WEBM_DOCTYPE = [0x77, 0x65, 0x62, 0x6d];

const MP4_FTYP = [0x66, 0x74, 0x79, 0x70];
/** Hop ftyp nho nhat: kich thuoc, ma hop, nhan chinh va phien ban phu, moi thu 4 byte. */
const MP4_FTYP_MIN = 16;

/**
 * Nhan dien tep tai len bang byte that, khong tin mime hay ten tep cua trinh duyet. Chi nhan WebP, JPEG (SOF0 hoac
 * SOF2), WebM va MP4/M4A; anh phai doc duoc kich thuoc that. Tep sai dang, cat cut hay loai khac (PNG, GIF, SVG,
 * HTML) thi null.
 */
export function sniffMedia(bytes: Uint8Array): Sniffed | null {
  return sniffWebp(bytes) ?? sniffJpeg(bytes) ?? sniffWebm(bytes) ?? sniffMp4(bytes);
}

function matches(bytes: Uint8Array, at: number, signature: readonly number[]): boolean {
  return at + signature.length <= bytes.length && signature.every((b, i) => bytes[at + i] === b);
}

function u16le(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function u16be(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

function u24le(bytes: Uint8Array, at: number): number {
  return u16le(bytes, at) | (bytes[at + 2] << 16);
}

function u32le(bytes: Uint8Array, at: number): number {
  return (u24le(bytes, at) | (bytes[at + 3] << 24)) >>> 0;
}

function u32be(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | u16be(bytes, at + 2)) >>> 0;
}

function positiveSize(width: number, height: number): Size | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

/** RIFF phai dai dung bang tep va chunk dau phai nam tron trong tep. */
function sniffWebp(bytes: Uint8Array): Sniffed | null {
  if (!matches(bytes, 0, RIFF) || !matches(bytes, 8, WEBP) || bytes.length < WEBP_CHUNK_DATA) return null;
  if (u32le(bytes, 4) + 8 !== bytes.length || WEBP_CHUNK_DATA + u32le(bytes, 16) > bytes.length) return null;
  const size = webpSize(bytes);
  return size && { mime: "image/webp", ...size };
}

function webpSize(bytes: Uint8Array): Size | null {
  if (matches(bytes, 12, VP8)) return vp8Size(bytes);
  if (matches(bytes, 12, VP8L)) return vp8lSize(bytes);
  if (matches(bytes, 12, VP8X)) return vp8xSize(bytes);
  return null;
}

/** VP8 (nen mat du lieu): khung khoa co bit 0 cua the khung bang 0, ma bat dau 9d 01 2a, kich thuoc 14 bit thap. */
function vp8Size(bytes: Uint8Array): Size | null {
  const at = WEBP_CHUNK_DATA;
  if (bytes.length < at + 10 || (bytes[at] & 1) !== 0 || !matches(bytes, at + 3, VP8_START_CODE)) return null;
  return positiveSize(u16le(bytes, at + 6) & 0x3fff, u16le(bytes, at + 8) & 0x3fff);
}

/** VP8L (khong mat du lieu): chu ky 2f, roi 14 bit rong - 1, 14 bit cao - 1 va 3 bit phien ban phai bang 0. */
function vp8lSize(bytes: Uint8Array): Size | null {
  const at = WEBP_CHUNK_DATA;
  if (bytes.length < at + 5 || bytes[at] !== VP8L_SIGNATURE) return null;
  const bits = u32le(bytes, at + 1);
  if (bits >>> 29 !== 0) return null;
  return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
}

/** VP8X (mo rong): co, 3 byte du tru, roi rong - 1 va cao - 1 moi thu 24 bit. */
function vp8xSize(bytes: Uint8Array): Size | null {
  const at = WEBP_CHUNK_DATA;
  if (bytes.length < at + 10) return null;
  return { width: u24le(bytes, at + 4) + 1, height: u24le(bytes, at + 7) + 1 };
}

function sniffJpeg(bytes: Uint8Array): Sniffed | null {
  if (!matches(bytes, 0, JPEG_SOI)) return null;
  const size = jpegSize(bytes);
  return size && { mime: "image/jpeg", ...size };
}

/** Moi ma SOF khac SOF0 va SOF2; C4, C8, CC cung dai ma nhung khong phai khung. */
function isOtherStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![JPEG_SOF0, JPEG_SOF2, 0xc4, 0xc8, 0xcc].includes(marker);
}

/**
 * Di qua cac segment sau SOI toi SOF0 hoac SOF2 va doc cao, rong. Gap SOS, EOI hay mot kieu khung khac truoc do,
 * hoac segment hong, thi null.
 */
function jpegSize(bytes: Uint8Array): Size | null {
  let at = 2;
  while (at + 2 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
    } else if (marker === JPEG_TEM || (marker >= JPEG_RST0 && marker <= JPEG_RST7)) {
      at += 2;
    } else {
      if (marker === JPEG_SOS || marker === JPEG_EOI || isOtherStartOfFrame(marker) || at + 4 > bytes.length) return null;
      const length = u16be(bytes, at + 2);
      if (length < 2 || at + 2 + length > bytes.length) return null;
      if (marker === JPEG_SOF0 || marker === JPEG_SOF2) return length >= 8 ? positiveSize(u16be(bytes, at + 7), u16be(bytes, at + 5)) : null;
      at += 2 + length;
    }
  }
  return null;
}

type Vint = { length: number; value: number };

/** So nguyen do dai thay doi cua EBML: so bit 0 dung dau byte dau cho biet do dai 1-8 byte, bit danh dau bi bo. */
function readVint(bytes: Uint8Array, at: number): Vint | null {
  if (at >= bytes.length || bytes[at] === 0) return null;
  const length = Math.clz32(bytes[at]) - 23;
  if (at + length > bytes.length) return null;
  let value = bytes[at] & (0xff >> length);
  for (let i = 1; i < length; i++) value = value * 256 + bytes[at + i];
  return { length, value };
}

/** Id cua mot phan tu EBML giu ca bit danh dau, vd DocType la 0x4282. */
function elementId(bytes: Uint8Array, at: number, length: number): number {
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + bytes[at + i];
  return id;
}

/** Header EBML phai nam tron trong tep va co DocType dung "webm"; Matroska thuong thi khong nhan. */
function sniffWebm(bytes: Uint8Array): Sniffed | null {
  if (!matches(bytes, 0, EBML_MAGIC)) return null;
  const header = readVint(bytes, EBML_MAGIC.length);
  if (!header) return null;
  const from = EBML_MAGIC.length + header.length;
  const end = from + header.value;
  return end <= bytes.length && hasWebmDocType(bytes, from, end) ? { mime: "audio/webm" } : null;
}

function hasWebmDocType(bytes: Uint8Array, from: number, end: number): boolean {
  let at = from;
  while (at < end) {
    const id = readVint(bytes, at);
    const size = id && readVint(bytes, at + id.length);
    if (!id || !size) return false;
    const data = at + id.length + size.length;
    if (data + size.value > end) return false;
    if (elementId(bytes, at, id.length) === EBML_DOCTYPE) {
      return size.value === WEBM_DOCTYPE.length && matches(bytes, data, WEBM_DOCTYPE);
    }
    at = data + size.value;
  }
  return false;
}

/** Hop ftyp o dau tep: kich thuoc tu 16 byte, nam tron trong tep, danh sach nhan tuong thich chia het cho 4. */
function sniffMp4(bytes: Uint8Array): Sniffed | null {
  if (!matches(bytes, 4, MP4_FTYP)) return null;
  const size = u32be(bytes, 0);
  return size >= MP4_FTYP_MIN && size <= bytes.length && size % 4 === 0 ? { mime: "audio/mp4" } : null;
}
