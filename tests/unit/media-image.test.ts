import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { chooseEncoded, checkImageSource, fitImage, IMAGE_ENCODINGS, IMAGE_ERRORS, IMAGE_SOURCE_MAX_BYTES, IMAGE_UNREADABLE_HINT } from "@/lib/media/image";
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
  it("tep goc toi 25 MB thi qua, lon hon thi lon qua", () => {
    expect(checkImageSource({ size: IMAGE_SOURCE_MAX_BYTES })).toBeNull();
    expect(checkImageSource({ size: IMAGE_SOURCE_MAX_BYTES + 1 })).toBe("too-large");
  });
});

describe("chooseEncoded", () => {
  const blob = (type: string, size = 1000) => ({ type, size });

  it("ra WebP trong tran thi dung ngay", () => {
    const b = blob("image/webp");
    expect(chooseEncoded(0, b, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "ok", blob: b });
  });

  it("trinh duyet khong ma hoa duoc WebP (null hoac tra PNG) thi thu JPEG", () => {
    expect(chooseEncoded(0, null, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next: 1 });
    expect(chooseEncoded(0, blob("image/png"), MEDIA_MAX_BYTES.anh)).toEqual({ kind: "retry", next: 1 });
    expect(IMAGE_ENCODINGS[1].type).toBe("image/jpeg");
  });

  it("JPEG cung khong ra thi anh khong doc duoc", () => {
    expect(chooseEncoded(1, null, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "unreadable" });
    expect(chooseEncoded(1, blob("image/png"), MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "unreadable" });
  });

  it("dung tran may chu cua loai thi qua, vuot mot byte thi lon qua", () => {
    const vua = blob("image/jpeg", MEDIA_MAX_BYTES.anh);
    expect(chooseEncoded(1, vua, MEDIA_MAX_BYTES.anh)).toEqual({ kind: "ok", blob: vua });
    expect(chooseEncoded(0, blob("image/webp", MEDIA_MAX_BYTES.anh + 1), MEDIA_MAX_BYTES.anh)).toEqual({ kind: "error", problem: "too-large" });
    expect(chooseEncoded(0, blob("image/webp", 500), 499)).toEqual({ kind: "error", problem: "too-large" });
  });

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

  it("cau loi va dong goi y dung chu da dinh", () => {
    expect(IMAGE_ERRORS).toEqual({
      unreadable: "Ảnh này không đọc được.",
      "too-large": "Ảnh lớn quá, chọn ảnh khác.",
      upload: "Chưa tải được, thử lại.",
    });
    expect(IMAGE_UNREADABLE_HINT).toBe("Chọn ảnh JPG, PNG hoặc WebP.");
  });
});
