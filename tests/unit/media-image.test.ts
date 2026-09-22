import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkImageSource, chooseEncoded, decodeResizeWidth, DECODE_MAX_PIXELS, encodingOf, FIRST_ENCODE, fitImage, IMAGE_ACCEPT, IMAGE_ENCODINGS,
  IMAGE_ERRORS, IMAGE_HINTS, IMAGE_LOWER_QUALITIES, IMAGE_SOURCE_MAX_BYTES, imageErrorText, imageRetryable,
} from "@/lib/media/image";
import { IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, MEDIA_MAX_BYTES } from "@/lib/media/kinds";

describe("fitImage", () => {
  it.each<[string, number, number, number, number]>([
    ["anh ngang lon thu ve rong 1200", 4000, 3000, 1200, 900],
    ["anh doc lon thu ve vua ca hai tran", 3000, 4000, 1200, 1600],
    ["anh doc hep cham tran cao truoc", 1000, 4000, 400, 1600],
    ["anh nho giu nguyen, khong phong to", 640, 480, 640, 480],
    ["anh det rat dai van cao it nhat 1", 10000, 2, 1200, 1],
  ])("%s", (_ten, w, h, rong, cao) => {
    expect(fitImage(w, h)).toEqual({ width: rong, height: cao });
  });

  it("moi ket qua nam trong tran ma may chu kiem lai", () => {
    for (const [w, h] of [[1201, 1601], [9999, 7], [7, 9999], [4032, 3024], [1599, 1200]]) {
      const r = fitImage(w, h);
      expect(r.width, `${w}x${h}`).toBeLessThanOrEqual(IMAGE_MAX_WIDTH_PX);
      expect(r.height, `${w}x${h}`).toBeLessThanOrEqual(IMAGE_MAX_HEIGHT_PX);
    }
  });
});

describe("checkImageSource", () => {
  it("tep goc toi 40 MB thi qua, lon hon thi lon qua (tran rieng cua tep goc)", () => {
    expect(IMAGE_SOURCE_MAX_BYTES).toBe(40 * 1024 * 1024);
    expect(checkImageSource({ size: IMAGE_SOURCE_MAX_BYTES })).toBeNull();
    expect(checkImageSource({ size: IMAGE_SOURCE_MAX_BYTES + 1 })).toBe("source-too-large");
  });
});

describe("decodeResizeWidth", () => {
  it("khong biet kich thuoc, hoac chua qua tran diem anh, thi giai ma nguyen co", () => {
    expect(DECODE_MAX_PIXELS).toBe(4096 * 4096);
    expect(decodeResizeWidth(null)).toBeNull();
    expect(decodeResizeWidth({ width: 4096, height: 4096 })).toBeNull();
    expect(decodeResizeWidth({ width: 4032, height: 3024 })).toBeNull();
  });

  it.each([[8000, 6000, 4729], [6000, 8000, 3547], [12000, 9000, 4729]])("%ix%i thu ve rong %i, dien tich nam trong tran", (w, h, rong) => {
    expect(decodeResizeWidth({ width: w, height: h })).toBe(rong);
    expect(rong * Math.round((rong * h) / w)).toBeLessThanOrEqual(DECODE_MAX_PIXELS);
  });

  it("anh det rat dai van rong it nhat 1", () => {
    expect(decodeResizeWidth({ width: 1, height: 20_000_000 })).toBe(1);
  });
});

describe("chooseEncoded", () => {
  const blob = (type: string, size = 1000) => ({ type, size });

  it("ra WebP 0.82 trong tran thi dung ngay", () => {
    expect(FIRST_ENCODE).toEqual({ format: 0, lowered: 0 });
    expect(encodingOf(FIRST_ENCODE)).toEqual({ type: "image/webp", quality: 0.82 });
    const b = blob("image/webp");
    expect(chooseEncoded(FIRST_ENCODE, b, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "ok", blob: b });
  });

  it("trinh duyet khong ma hoa duoc WebP (null hoac tra PNG) thi thu JPEG 0.85", () => {
    const next = { format: 1, lowered: 0 };
    expect(chooseEncoded(FIRST_ENCODE, null, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next });
    expect(chooseEncoded(FIRST_ENCODE, blob("image/png"), MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next });
    expect(encodingOf(next)).toEqual({ type: IMAGE_ENCODINGS[1].type, quality: 0.85 });
  });

  it("vuot tran thi ha chat luong hai bac, giu nguyen kieu, roi moi bao lon qua", () => {
    expect(IMAGE_LOWER_QUALITIES).toEqual([0.72, 0.6]);
    const lon = blob("image/webp", MEDIA_MAX_BYTES.anh + 1);
    expect(chooseEncoded(FIRST_ENCODE, lon, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next: { format: 0, lowered: 1 } });
    expect(encodingOf({ format: 0, lowered: 1 })).toEqual({ type: "image/webp", quality: 0.72 });
    expect(chooseEncoded({ format: 0, lowered: 1 }, lon, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next: { format: 0, lowered: 2 } });
    expect(encodingOf({ format: 0, lowered: 2 })).toEqual({ type: "image/webp", quality: 0.6 });
    expect(chooseEncoded({ format: 0, lowered: 2 }, lon, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "too-large" });
    expect([0, 1, 2].map((lowered) => encodingOf({ format: 1, lowered }).quality)).toEqual([0.85, 0.72, 0.6]);
  });

  it("JPEG cung khong ra thi anh hong", () => {
    expect(chooseEncoded({ format: 1, lowered: 0 }, null, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "broken" });
    expect(chooseEncoded({ format: 1, lowered: 0 }, blob("image/png"), MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "broken" });
  });

  it("dung tran may chu cua loai thi qua", () => {
    const vua = blob("image/jpeg", MEDIA_MAX_BYTES.anh);
    expect(chooseEncoded({ format: 1, lowered: 0 }, vua, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "ok", blob: vua });
  });
});

describe("image.ts", () => {
  /*
   * image.ts di vao tu component cua trinh duyet; truoc khi sua no import
   * UPLOAD_RETRY_MESSAGE tu upload.ts, ma upload.ts keo theo sniffMedia (gan 200 dong doc byte) va parseUploadForm cua
   * may chu. Hom nay chi la vai KB ma chi con toi uu cua bo dong goi bo di, nhung huong phu thuoc thi nguoc: ngay nguoi
   * dau tien them mot import "node:" vao upload.ts, ban dung cho trinh duyet se hong hoac phinh ra, va nguyen nhan nam
   * cach do ba file. Tap mo dun duoi day co dinh: them mot cai ten vao la co nguoi phai doc lai.
   */
  it("image.ts khong cham toi bo doc byte cua may chu (upload.ts, sniff.ts), ke ca gian tiep", () => {
    const NHAP = /from ["'][.][/]([a-zA-Z0-9-]+)["']/g;
    const den = new Set<string>();
    const cho = ["image"];
    while (cho.length > 0) {
      const ten = cho.pop() as string;
      if (den.has(ten)) continue;
      den.add(ten);
      for (const m of readFileSync(`src/lib/media/${ten}.ts`, "utf8").matchAll(NHAP)) cho.push(m[1]);
    }
    expect([...den].sort()).toEqual(["image", "kinds", "messages"]);
  });
});

describe("cau bao loi anh", () => {
  it("dung chu spec muc 2.4; loai khong nhan co dong goi y, vung doc doc lien ca hai", () => {
    expect(IMAGE_ERRORS).toEqual({
      unsupported: "Chưa đọc được loại ảnh này.",
      "source-too-large": "Ảnh lớn quá (tối đa 40 MB), chọn ảnh khác.",
      broken: "Ảnh này bị hỏng hoặc không mở được, thử ảnh khác.",
      "heif-loader": "Chưa tải được bộ đọc ảnh iPhone, thử lại.",
      "too-large": "Ảnh lớn quá, chọn ảnh khác.",
      upload: "Chưa tải được, thử lại.",
    });
    expect(IMAGE_HINTS).toEqual({ unsupported: "Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP." });
    expect(imageErrorText("unsupported")).toBe("Chưa đọc được loại ảnh này. Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP.");
    expect(imageErrorText("broken")).toBe(IMAGE_ERRORS.broken);
  });
});

describe("o chon anh va loi thu lai duoc", () => {
  it("o chon tep nhan image/* kem duoi HEIC, HEIF, AVIF (Windows khong xep .heic vao image/*)", () => {
    expect(IMAGE_ACCEPT).toBe("image/*,.heic,.heif,.avif");
  });

  it("chi loi tai len va loi nap bo doc anh iPhone co Thu lai", () => {
    expect((["unsupported", "source-too-large", "broken", "heif-loader", "too-large", "upload"] as const).filter(imageRetryable))
      .toEqual(["heif-loader", "upload"]);
  });
});
