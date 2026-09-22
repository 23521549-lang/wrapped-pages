// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSourceImage } from "@/components/book/coverFile";
import { jpegDau, tepTu } from "../helpers/anh-mau";

/*
 * readSourceImage giai ma anh goc (ImageBitmap) roi ve lai anh xem truoc bang canvas. Ve (paintCanvas/drawImage) hay ma
 * hoa (canvasBlob/toBlob) thuong tra null khi khong lam duoc, nhung co the nem loi thang (vd ImageBitmap bi dong o noi
 * khac giua chung) - luc do anh goc van phai duoc giai phong ngay, khong duoc ro ri bo nho toi khi component unmount.
 */

describe("readSourceImage: giai phong anh goc khi ve hay ma hoa xem truoc nem loi", () => {
  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bitmap = { width: 2000, height: 1500, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("paintCanvas (drawImage) nem loi: dong ImageBitmap roi nem tiep dung loi do", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
      imageSmoothingQuality: "low",
      drawImage: () => {
        throw new Error("khong ve duoc");
      },
    })) as never);
    const tep = tepTu(jpegDau(2000, 1500), "a.jpg", "image/jpeg");
    await expect(readSourceImage(tep)).rejects.toThrow("khong ve duoc");
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("canvasBlob (toBlob) nem loi: dong ImageBitmap roi nem tiep dung loi do", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
      imageSmoothingQuality: "low",
      drawImage: () => {},
    })) as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => {
      throw new Error("khong ma hoa duoc");
    });
    const tep = tepTu(jpegDau(2000, 1500), "a.jpg", "image/jpeg");
    await expect(readSourceImage(tep)).rejects.toThrow("khong ma hoa duoc");
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});
