import { describe, expect, it, vi } from "vitest";
import { decodeImage, type DecodedImage, type DecodeTiers } from "@/components/media/decodeImage";
import { IMAGE_SOURCE_MAX_BYTES } from "@/lib/media/image";
import { isoDau, ispe, jpegDau, KHONG_NHAN, tepTu } from "../helpers/anh-mau";

/*
 * Thu tu thu cua ham giai ma, voi cac tang gia: moi tang ghi ten vao nhat ky roi tra hoac nem theo kich ban. Tang that
 * cua trinh duyet (createImageBitmap, the img, heic-to) do e2e chay tren Chromium.
 */

type Bitmap = { width: number; height: number; close: ReturnType<typeof vi.fn> };
const bitmap = (width: number, height: number): Bitmap => ({ width, height, close: vi.fn() });
const LOI = () => new DOMException("khong giai ma duoc", "InvalidStateError");

type KichBan = { bitmap?: (Bitmap | Error)[]; element?: DecodedImage | Error; heif?: "mat-mang" | Error | Bitmap };

function tang(kb: KichBan = {}) {
  const nhatKy: string[] = [];
  const luot = [...(kb.bitmap ?? [LOI(), LOI()])];
  const decodeHeif = vi.fn(async (_tep: Blob) => {
    nhatKy.push("heif");
    if (kb.heif instanceof Error || kb.heif === undefined) throw kb.heif ?? LOI();
    return kb.heif as unknown as ImageBitmap;
  });
  const tiers: DecodeTiers = {
    bitmap: vi.fn(async (_tep: Blob, tuyChon?: ImageBitmapOptions) => {
      nhatKy.push(tuyChon ? "bitmap-tuy-chon" : "bitmap");
      const r = luot.shift() ?? LOI();
      if (r instanceof Error) throw r;
      return r as unknown as ImageBitmap;
    }),
    element: vi.fn(async (_tep: Blob) => {
      nhatKy.push("img");
      const e = kb.element ?? LOI();
      if (e instanceof Error) throw e;
      return e;
    }),
    heif: vi.fn(async () => {
      nhatKy.push("nap-heif");
      if (kb.heif === "mat-mang") throw new TypeError("Failed to fetch dynamically imported module");
      return decodeHeif;
    }),
  };
  const onHeif = vi.fn(() => {
    nhatKy.push("dang-doc");
  });
  return { tiers, nhatKy, decodeHeif, onHeif };
}

const jpeg = (w: number, h: number, orientation?: number) => tepTu(jpegDau(w, h, { orientation }), "anh.jpg", "image/jpeg");
const heic = () => tepTu(isoDau("heic", ["mif1", "heic"], ispe(4032, 3024)), "IMG_0001.HEIC");
const avif = () => tepTu(isoDau("avif", ["avif", "mif1"], ispe(1200, 900)), "anh.avif");

describe("decodeImage: chan truoc khi giai ma", () => {
  it("tep goc qua 40 MB: lon qua, khong giai ma", async () => {
    const t = tang();
    expect(await decodeImage(tepTu(jpegDau(10, 10), "a.jpg", "", IMAGE_SOURCE_MAX_BYTES + 1), t)).toBe("source-too-large");
    expect(t.nhatKy).toEqual([]);
  });

  it.each(["TIFF II", "PSD", "SVG", "PDF", "CR3"])("loai khong nhan (%s): chua doc duoc loai anh, khong giai ma", async (ten) => {
    const t = tang();
    expect(await decodeImage(tepTu(KHONG_NHAN[ten], "anh", "image/jpeg"), t)).toBe("unsupported");
    expect(t.nhatKy).toEqual([]);
  });

  it("doc byte dau that bai (tep vua bi xoa khoi may): anh hong", async () => {
    const t = tang();
    const tep = jpeg(10, 10);
    Object.defineProperty(tep, "slice", { value: () => { throw new DOMException("mat tep", "NotFoundError"); } });
    expect(await decodeImage(tep, t)).toBe("broken");
    expect(t.nhatKy).toEqual([]);
  });
});

describe("decodeImage: thu tu cac tang", () => {
  it("anh vua tran: tang dau xoay theo EXIF, khong thu nho; release dong bitmap", async () => {
    const b = bitmap(4000, 3000);
    const t = tang({ bitmap: [b] });
    const tep = jpeg(4000, 3000);
    const r = await decodeImage(tep, t);
    if (typeof r === "string") throw new Error(r);
    expect(t.tiers.bitmap).toHaveBeenCalledWith(tep, { imageOrientation: "from-image" });
    expect([r.source, r.width, r.height]).toEqual([b, 4000, 3000]);
    r.release();
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon"]);
  });

  it("anh 48 MP: thu nho ngay luc giai ma, chat luong cao", async () => {
    const t = tang({ bitmap: [bitmap(4729, 3547)] });
    const tep = jpeg(8000, 6000);
    await decodeImage(tep, t);
    expect(t.tiers.bitmap).toHaveBeenCalledWith(tep, { imageOrientation: "from-image", resizeWidth: 4729, resizeQuality: "high" });
  });

  it("anh luu ngang co Orientation 6: rong thu nho tinh tren anh da xoay", async () => {
    const t = tang({ bitmap: [bitmap(3547, 4729)] });
    const tep = jpeg(8000, 6000, 6);
    await decodeImage(tep, t);
    expect(t.tiers.bitmap).toHaveBeenCalledWith(tep, { imageOrientation: "from-image", resizeWidth: 3547, resizeQuality: "high" });
  });

  it("trinh duyet nem voi tui tuy chon: thu lai khong tuy chon", async () => {
    const b = bitmap(800, 600);
    const t = tang({ bitmap: [LOI(), b] });
    const tep = jpeg(800, 600);
    const r = await decodeImage(tep, t);
    expect(typeof r === "string" ? r : r.source).toBe(b);
    expect(vi.mocked(t.tiers.bitmap).mock.calls[1]).toEqual([tep]);
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon", "bitmap"]);
  });

  it("hai lan createImageBitmap deu hong: the img", async () => {
    const anh: DecodedImage = { source: {} as CanvasImageSource, width: 640, height: 480, release: vi.fn() };
    const t = tang({ element: anh });
    expect(await decodeImage(jpeg(640, 480), t)).toBe(anh);
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon", "bitmap", "img"]);
  });

  it("JPEG hong o moi tang: anh hong, khong nap bo doc HEIF, khong bao dang doc", async () => {
    const t = tang();
    expect(await decodeImage(jpeg(640, 480), { tiers: t.tiers, onHeif: t.onHeif })).toBe("broken");
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon", "bitmap", "img"]);
  });

  it("AVIF hong o moi tang goc: anh hong; bo doc HEIF chi co HEVC nen khong nap", async () => {
    const t = tang();
    expect(await decodeImage(avif(), { tiers: t.tiers, onHeif: t.onHeif })).toBe("broken");
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon", "bitmap", "img"]);
  });
});

describe("decodeImage: tang HEIF", () => {
  it("trinh duyet tu doc duoc HEIC (Safari): khong nap bo doc HEIF", async () => {
    const t = tang({ bitmap: [bitmap(3024, 4032)] });
    const r = await decodeImage(heic(), { tiers: t.tiers, onHeif: t.onHeif });
    expect(typeof r === "string" ? r : [r.width, r.height]).toEqual([3024, 4032]);
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon"]);
  });

  it("ba tang goc hong: bao dang doc, nap bo doc, giai ma dung tep; release dong bitmap", async () => {
    const b = bitmap(3024, 4032);
    const t = tang({ heif: b });
    const tep = heic();
    const r = await decodeImage(tep, { tiers: t.tiers, onHeif: t.onHeif });
    if (typeof r === "string") throw new Error(r);
    expect(t.nhatKy).toEqual(["bitmap-tuy-chon", "bitmap", "img", "dang-doc", "nap-heif", "heif"]);
    expect(t.decodeHeif).toHaveBeenCalledWith(tep);
    r.release();
    expect(b.close).toHaveBeenCalledTimes(1);
  });

  it("khong nap duoc bo doc (mat mang): heif-loader, khong giai ma", async () => {
    const t = tang({ heif: "mat-mang" });
    expect(await decodeImage(heic(), { tiers: t.tiers, onHeif: t.onHeif })).toBe("heif-loader");
    expect(t.decodeHeif).not.toHaveBeenCalled();
  });

  it("bo doc nem khi giai ma (tep hong): anh hong", async () => {
    const t = tang({ heif: new Error("Error: Invalid input") });
    expect(await decodeImage(heic(), { tiers: t.tiers, onHeif: t.onHeif })).toBe("broken");
  });
});
