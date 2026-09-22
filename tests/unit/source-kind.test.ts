import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HEADER_BYTES, KIND_BYTES, readSourceHeader, sourceKind } from "@/lib/media/source-kind";
import { bmpDau, ghep, gifDau, irot, isoDau, ispe, jpegDau, KHONG_NHAN, mdat, pngDau, u16be, webpDau } from "../helpers/anh-mau";

describe("sourceKind: loai tep theo byte dau, khong theo ten hay type", () => {
  it.each<[string, Uint8Array]>([
    ["jpeg", jpegDau(10, 10)],
    ["png", pngDau(10, 10)],
    ["gif", gifDau(10, 10)],
    ["webp", webpDau(10, 10)],
    ["bmp", bmpDau(10, 10)],
    ["avif", isoDau("avif", ["avif", "mif1", "miaf"])],
    ["heif", isoDau("heic", ["mif1", "heic"])],
  ])("%s", (loai, byte) => {
    expect(sourceKind(byte)).toBe(loai);
  });

  it.each(["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"])("nhan chinh %s la HEIF", (nhan) => {
    expect(sourceKind(isoDau(nhan, []))).toBe("heif");
  });

  it("AVIF khai nhan chinh mif1 van la avif; HEIC co them nhan avif van la heif", () => {
    expect(sourceKind(isoDau("mif1", ["avif", "miaf"]))).toBe("avif");
    expect(sourceKind(isoDau("avis", []))).toBe("avif");
    expect(sourceKind(isoDau("heic", ["avif", "mif1"]))).toBe("heif");
    expect(sourceKind(isoDau("mif1", ["heic", "avif"]))).toBe("heif");
  });

  it.each(Object.entries(KHONG_NHAN))("khong nhan: %s", (_ten, byte) => {
    expect(sourceKind(byte)).toBeNull();
    expect(readSourceHeader(byte)).toBeNull();
  });

  it("nhan dien chi dung KIND_BYTES byte dau", () => {
    expect(KIND_BYTES).toBe(64);
    expect(sourceKind(ghep(jpegDau(10, 10).subarray(0, 3)))).toBe("jpeg");
  });
});

describe("readSourceHeader: kich thuoc da xoay theo huong chup", () => {
  it.each<[string, Uint8Array, { width: number; height: number }]>([
    ["png", pngDau(640, 480), { width: 640, height: 480 }],
    ["gif", gifDau(50, 30), { width: 50, height: 30 }],
    ["webp", webpDau(800, 600), { width: 800, height: 600 }],
    ["bmp", bmpDau(300, 200), { width: 300, height: 200 }],
    ["bmp luu tu tren xuong (cao am)", bmpDau(300, -200), { width: 300, height: 200 }],
    ["jpeg SOF0", jpegDau(4000, 3000), { width: 4000, height: 3000 }],
    ["jpeg luy tien SOF2", jpegDau(4000, 3000, { sof: 0xc2 }), { width: 4000, height: 3000 }],
    ["jpeg SOF1", jpegDau(1200, 900, { sof: 0xc1 }), { width: 1200, height: 900 }],
  ])("%s", (_ten, byte, kichThuoc) => {
    expect(readSourceHeader(byte)?.size).toEqual(kichThuoc);
  });

  it("JPEG: Orientation 5 toi 8 doi rong va cao, 1 toi 4 giu nguyen, ca hai thu tu byte", () => {
    for (const order of ["II", "MM"] as const) {
      for (let o = 1; o <= 8; o++) {
        expect(readSourceHeader(jpegDau(4000, 3000, { orientation: o, order }))?.size, `${order} ${o}`)
          .toEqual(o >= 5 ? { width: 3000, height: 4000 } : { width: 4000, height: 3000 });
      }
    }
  });

  it("JPEG: bang ma Huffman (C4) truoc khung khong bi coi la khung", () => {
    const byte = ghep([0xff, 0xd8], [0xff, 0xc4], u16be(4), 0, 0, jpegDau(640, 480).subarray(2));
    expect(readSourceHeader(byte)?.size).toEqual({ width: 640, height: 480 });
  });

  it("JPEG: khung nam sau hai khoi ICC lon van tim thay; bi cat truoc khung thi van la jpeg nhung khong biet kich thuoc", () => {
    const icc = (n: number) => ghep([0xff, 0xe2], u16be(n + 2), Array.from({ length: n }, () => 0));
    const byte = ghep([0xff, 0xd8], icc(60_000), icc(60_000), jpegDau(8000, 6000).subarray(2));
    expect(byte.length).toBeLessThan(HEADER_BYTES);
    expect(readSourceHeader(byte)).toEqual({ kind: "jpeg", size: { width: 8000, height: 6000 } });
    expect(readSourceHeader(byte.subarray(0, 1000))).toEqual({ kind: "jpeg", size: null });
  });

  it("HEIF/AVIF: ispe lon nhat la anh chinh, irot le doi rong va cao, irot chan giu nguyen, ispe sau mdat bi bo qua", () => {
    expect(readSourceHeader(isoDau("heic", ["mif1"], ispe(4032, 3024)))?.size).toEqual({ width: 4032, height: 3024 });
    expect(readSourceHeader(isoDau("heic", ["mif1"], ispe(512, 512), ispe(4032, 3024), ispe(512, 512)))?.size)
      .toEqual({ width: 4032, height: 3024 });
    expect(readSourceHeader(isoDau("heic", [], ispe(4032, 3024), irot(3)))?.size).toEqual({ width: 3024, height: 4032 });
    expect(readSourceHeader(isoDau("heic", [], ispe(4032, 3024), irot(1)))?.size).toEqual({ width: 3024, height: 4032 });
    expect(readSourceHeader(isoDau("heic", [], ispe(4032, 3024), irot(2)))?.size).toEqual({ width: 4032, height: 3024 });
    expect(readSourceHeader(isoDau("avif", ["mif1"], mdat(), ispe(10, 10)))).toEqual({ kind: "avif", size: null });
  });

  it("PNG bi cat truoc IHDR: van la png, khong biet kich thuoc", () => {
    expect(readSourceHeader(pngDau(10, 10).subarray(0, 12))).toEqual({ kind: "png", size: null });
  });

  it("tep mau that trong tests/e2e/fixtures", () => {
    const doc = (ten: string) => readSourceHeader(new Uint8Array(readFileSync(`tests/e2e/fixtures/${ten}`)));
    expect(doc("plain.heic")).toEqual({ kind: "heif", size: { width: 120, height: 80 } });
    expect(doc("orient6.heic")).toEqual({ kind: "heif", size: { width: 80, height: 120 } });
    expect(doc("plain.avif")).toEqual({ kind: "avif", size: { width: 120, height: 80 } });
    expect(doc("plain.png")).toEqual({ kind: "png", size: { width: 120, height: 80 } });
  });
});
