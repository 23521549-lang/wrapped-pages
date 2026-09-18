import { describe, it, expect } from "vitest";
import { sniffMedia } from "@/lib/media/sniff";

// Moi byte viet bang so, khong dung chuoi thoat.
const u16le = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u16be = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const u24le = (n: number) => [...u16le(n & 0xffff), (n >>> 16) & 0xff];
const u32le = (n: number) => [...u16le(n & 0xffff), ...u16le(n >>> 16)];
const u32be = (n: number) => [...u16be(n >>> 16), ...u16be(n & 0xffff)];
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const VP8 = [0x56, 0x50, 0x38, 0x20];
const VP8L = [0x56, 0x50, 0x38, 0x4c];
const VP8X = [0x56, 0x50, 0x38, 0x58];
const ALPH = [0x41, 0x4c, 0x50, 0x48];

/** Tep WebP mot chunk, kich thuoc RIFF va kich thuoc chunk dung that. */
function webp(chunk: number[], data: number[]) {
  const body = [...WEBP, ...chunk, ...u32le(data.length), ...data];
  return bytes(RIFF, u32le(body.length), body);
}
/** VP8 khung khoa: the khung (bit 0 bang 0), ma bat dau, rong va cao 16 bit (2 bit cao la ti le). */
const vp8 = (w: number, h: number, the = 0x50) => webp(VP8, [the, 0x2a, 0x00, 0x9d, 0x01, 0x2a, ...u16le(w), ...u16le(h)]);
const vp8l = (w: number, h: number, phienBan = 0) => webp(VP8L, [0x2f, ...u32le(((w - 1) | ((h - 1) << 14) | (phienBan << 29)) >>> 0)]);
const vp8x = (w: number, h: number) => webp(VP8X, [0x10, 0x00, 0x00, 0x00, ...u24le(w - 1), ...u24le(h - 1)]);

const SOI = [0xff, 0xd8];
const APP0 = [0xff, 0xe0, ...u16be(16), 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const DQT = [0xff, 0xdb, ...u16be(4), 0x00, 0x01];
const RST0 = [0xff, 0xd0];
const SOS = [0xff, 0xda, ...u16be(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
const EOI = [0xff, 0xd9];
/** Segment SOF: do chinh xac 8, cao, rong, ba thanh phan mau. */
const sof = (marker: number, w: number, h: number) =>
  [0xff, marker, ...u16be(17), 0x08, ...u16be(h), ...u16be(w), 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
const jpeg = (...segments: number[][]) => bytes(SOI, ...segments, EOI);

const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const SEGMENT = [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const DOC_WEBM = [0x77, 0x65, 0x62, 0x6d];
const DOC_MATROSKA = [0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61];
/** Phan tu EBML du lieu ngan: id, kich thuoc mot byte, du lieu. */
const el = (id: number[], data: number[]) => [...id, 0x80 | data.length, ...data];
/** Header EBML nhu MediaRecorder cua Chrome ghi, kich thuoc header viet bang vint 1 hoac 2 byte. */
function webm(docType: number[] | null, vint2 = false) {
  const header = [
    ...el([0x42, 0x86], [0x01]), ...el([0x42, 0xf7], [0x01]), ...el([0x42, 0xf2], [0x04]), ...el([0x42, 0xf3], [0x08]),
    ...(docType ? el([0x42, 0x82], docType) : []), ...el([0x42, 0x87], [0x04]), ...el([0x42, 0x85], [0x02]),
  ];
  return bytes(EBML, vint2 ? [0x40, header.length] : [0x80 | header.length], header, SEGMENT);
}

const FTYP = [0x66, 0x74, 0x79, 0x70];
const M4A = [0x4d, 0x34, 0x41, 0x20];
const ISOM = [0x69, 0x73, 0x6f, 0x6d];
const MDAT = [0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74];
const mp4 = (size: number) => bytes(u32be(size), FTYP, M4A, u32be(0), ISOM, MDAT);

describe("sniffMedia: WebP", () => {
  it("doc kich thuoc that cua VP8, VP8L va VP8X", () => {
    expect(sniffMedia(vp8(1200, 900))).toEqual({ mime: "image/webp", width: 1200, height: 900 });
    expect(sniffMedia(vp8l(1200, 1600))).toEqual({ mime: "image/webp", width: 1200, height: 1600 });
    expect(sniffMedia(vp8x(1200, 720))).toEqual({ mime: "image/webp", width: 1200, height: 720 });
  });

  it("VP8 bo 2 bit ti le; VP8L va VP8X doc tron 14 va 24 bit", () => {
    expect(sniffMedia(vp8(0xc000 | 1200, 0x4000 | 900))).toEqual({ mime: "image/webp", width: 1200, height: 900 });
    expect(sniffMedia(vp8l(16384, 1))).toEqual({ mime: "image/webp", width: 16384, height: 1 });
    expect(sniffMedia(vp8x(1 << 24, 1))).toEqual({ mime: "image/webp", width: 1 << 24, height: 1 });
  });

  it.each<[string, Uint8Array]>([
    ["VP8 khong phai khung khoa", vp8(1200, 900, 0x51)],
    ["VP8 sai ma bat dau", webp(VP8, [0x50, 0x2a, 0x00, 0x9d, 0x01, 0x2b, ...u16le(10), ...u16le(10)])],
    ["VP8 rong 0", vp8(0, 900)],
    ["VP8 thieu byte kich thuoc", webp(VP8, [0x50, 0x2a, 0x00, 0x9d, 0x01, 0x2a, ...u16le(10)])],
    ["VP8L sai chu ky", webp(VP8L, [0x2e, ...u32le(0)])],
    ["VP8L phien ban khac 0", vp8l(10, 10, 1)],
    ["chunk dau khong phai anh", webp(ALPH, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])],
    ["RIFF khai ngan hon tep", bytes([...vp8(10, 10)], [0x00])],
    ["tep bi cat cut", vp8x(10, 10).subarray(0, 25)],
    ["chunk khai dai hon tep", bytes(RIFF, u32le(22), WEBP, VP8X, u32le(100), [0x00, 0x00])],
  ])("tu choi: %s", (_ten, tep) => {
    expect(sniffMedia(tep)).toBeNull();
  });
});

describe("sniffMedia: JPEG", () => {
  it("doc cao, rong o SOF0 va SOF2 sau cac segment khac", () => {
    expect(sniffMedia(jpeg(APP0, DQT, sof(0xc0, 1200, 900), SOS))).toEqual({ mime: "image/jpeg", width: 1200, height: 900 });
    expect(sniffMedia(jpeg(APP0, sof(0xc2, 800, 1600), SOS))).toEqual({ mime: "image/jpeg", width: 800, height: 1600 });
  });

  it("bo qua byte dem 0xff va marker dung mot minh", () => {
    expect(sniffMedia(jpeg(APP0, [0xff], RST0, sof(0xc0, 640, 480)))).toEqual({ mime: "image/jpeg", width: 640, height: 480 });
  });

  it.each<[string, Uint8Array]>([
    ["SOF1 khong ho tro", jpeg(APP0, sof(0xc1, 10, 10))],
    ["SOF3 khong ho tro", jpeg(sof(0xc3, 10, 10))],
    ["gap SOS truoc SOF", jpeg(APP0, SOS, sof(0xc0, 10, 10))],
    ["chi co SOI va EOI", jpeg()],
    ["rong 0", jpeg(sof(0xc0, 0, 10))],
    ["cao 0", jpeg(sof(0xc0, 10, 0))],
    ["segment dai 1 byte", jpeg([0xff, 0xe0, 0x00, 0x01], sof(0xc0, 10, 10))],
    ["byte rac giua hai segment", jpeg(APP0, [0x00], sof(0xc0, 10, 10))],
    ["SOF bi cat cut", bytes(SOI, APP0, sof(0xc0, 10, 10).slice(0, 8))],
    ["SOF qua ngan de chua kich thuoc", jpeg([0xff, 0xc0, ...u16be(7), 0x08, 0x00, 0x0a, 0x00, 0x0a])],
  ])("tu choi: %s", (_ten, tep) => {
    expect(sniffMedia(tep)).toBeNull();
  });
});

describe("sniffMedia: WebM va MP4", () => {
  it("WebM co DocType webm, kich thuoc header vint 1 hay 2 byte", () => {
    expect(sniffMedia(webm(DOC_WEBM))).toEqual({ mime: "audio/webm" });
    expect(sniffMedia(webm(DOC_WEBM, true))).toEqual({ mime: "audio/webm" });
  });

  it("MP4/M4A co hop ftyp dung dang", () => {
    expect(sniffMedia(mp4(24))).toEqual({ mime: "audio/mp4" });
    expect(sniffMedia(mp4(16))).toEqual({ mime: "audio/mp4" });
  });

  it.each<[string, Uint8Array]>([
    ["Matroska thuong", webm(DOC_MATROSKA)],
    ["khong co DocType", webm(null)],
    ["DocType ngan hon webm", webm(DOC_WEBM.slice(0, 3))],
    ["header khai dai hon tep", webm(DOC_WEBM).subarray(0, 20)],
    ["vint bat dau bang byte 0", bytes(EBML, [0x00, 0x00])],
    ["ftyp ngan hon 16 byte", mp4(12)],
    ["ftyp khai dai hon tep", mp4(64)],
    ["ftyp khong chia het cho 4", mp4(18)],
  ])("tu choi: %s", (_ten, tep) => {
    expect(sniffMedia(tep)).toBeNull();
  });
});

describe("sniffMedia: loai khac", () => {
  it.each<[string, Uint8Array]>([
    ["tep rong", bytes()],
    ["PNG", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], u32be(13), [0x49, 0x48, 0x44, 0x52], u32be(10), u32be(10))],
    ["GIF", bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], u16le(10), u16le(10))],
    ["SVG", bytes([0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c, 0x6e, 0x73, 0x3d, 0x22, 0x22, 0x3e])],
    ["HTML", bytes([0x3c, 0x21, 0x64, 0x6f, 0x63, 0x74, 0x79, 0x70, 0x65, 0x20, 0x68, 0x74, 0x6d, 0x6c, 0x3e])],
    ["WAV cung la RIFF", bytes(RIFF, u32le(12), [0x57, 0x41, 0x56, 0x45], [0x66, 0x6d, 0x74, 0x20], u32le(0))],
  ])("tu choi: %s", (_ten, tep) => {
    expect(sniffMedia(tep)).toBeNull();
  });
});
