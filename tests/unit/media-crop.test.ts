import { describe, it, expect } from "vitest";
import { COVER_RATIO, IMAGE_MAX_WIDTH_PX } from "@/lib/media/kinds";
import {
  COVER_ZOOM, CROP_STEP, CROP_STEP_FAR, coverOutputSize, cropRect, dragCrop, initialCrop, keyCrop, zoomCrop,
  type CropState, type ImageSize,
} from "@/lib/media/crop";

const NGANG: ImageSize = { width: 2000, height: 1500 };
const DOC: ImageSize = { width: 600, height: 2400 };
const DET: ImageSize = { width: 900, height: 300 };

/** Khung luon nam tron trong anh va dung ti le COVER_RATIO. */
function hopLe(size: ImageSize, crop: CropState): boolean {
  const r = cropRect(size, crop);
  const eps = 1e-9;
  return r.x >= -eps && r.y >= -eps && r.x + r.width <= size.width + eps && r.y + r.height <= size.height + eps
    && Math.abs(r.width * COVER_RATIO.height - r.height * COVER_RATIO.width) < 1e-6;
}

describe("initialCrop", () => {
  it.each<[string, ImageSize, { x: number; y: number; width: number; height: number }]>([
    ["anh ngang 4:3: rong het anh, giua theo chieu doc", NGANG, { x: 0, y: 150, width: 2000, height: 1200 }],
    ["anh doc: rong het anh, giua theo chieu doc", DOC, { x: 0, y: 1020, width: 600, height: 360 }],
    ["anh det 3:1: cao het anh, giua theo chieu ngang", DET, { x: 200, y: 0, width: 500, height: 300 }],
    ["anh dung 5:3: khung trung anh", { width: 1200, height: 720 }, { x: 0, y: 0, width: 1200, height: 720 }],
  ])("%s", (_ten, size, khung) => {
    const crop = initialCrop(size);
    expect(crop.zoom).toBe(COVER_ZOOM.min);
    expect(cropRect(size, crop)).toEqual(khung);
  });
});

describe("zoomCrop", () => {
  it("thu phong thu nho khung quanh tam cu, van 5:3", () => {
    const vua = zoomCrop(NGANG, initialCrop(NGANG), 200);
    expect(cropRect(NGANG, vua)).toEqual({ x: 500, y: 450, width: 1000, height: 600 });
    expect(cropRect(NGANG, zoomCrop(NGANG, vua, COVER_ZOOM.max))).toEqual({ x: 600, y: 510, width: 800, height: 480 });
    expect(cropRect(NGANG, zoomCrop(NGANG, vua, COVER_ZOOM.min))).toEqual({ x: 0, y: 150, width: 2000, height: 1200 });
  });

  it("phong to lai khi khung dang sat mep thi khung bi day vao trong anh", () => {
    const satGoc: CropState = { x: 1200, y: 1020, zoom: 250 };
    expect(cropRect(NGANG, zoomCrop(NGANG, satGoc, COVER_ZOOM.min))).toEqual({ x: 0, y: 300, width: 2000, height: 1200 });
  });

  it("muc thu phong ngoai thanh truot hay khong phai so thi kep ve trong khoang", () => {
    const goc = initialCrop(NGANG);
    expect(zoomCrop(NGANG, goc, 50).zoom).toBe(COVER_ZOOM.min);
    expect(zoomCrop(NGANG, goc, 400).zoom).toBe(COVER_ZOOM.max);
    expect(zoomCrop(NGANG, goc, Number.NaN).zoom).toBe(COVER_ZOOM.min);
  });
});

describe("keyCrop", () => {
  const giua: CropState = { x: 500, y: 450, zoom: 200 };

  it("mui ten doi CROP_STEP canh dai cua anh, Shift doi CROP_STEP_FAR", () => {
    const buoc = 2000 * CROP_STEP;
    const xa = 2000 * CROP_STEP_FAR;
    expect([buoc, xa]).toEqual([40, 200]);
    expect(keyCrop(NGANG, giua, "ArrowRight", false)).toEqual({ ...giua, x: 540 });
    expect(keyCrop(NGANG, giua, "ArrowLeft", true)).toEqual({ ...giua, x: 300 });
    expect(keyCrop(NGANG, giua, "ArrowUp", false)).toEqual({ ...giua, y: 410 });
    expect(keyCrop(NGANG, giua, "ArrowDown", true)).toEqual({ ...giua, y: 650 });
  });

  it("anh doc dung canh dai la chieu cao, nen doi doc van nhanh", () => {
    expect(keyCrop(DOC, initialCrop(DOC), "ArrowDown", false)?.y).toBe(1020 + 2400 * CROP_STEP);
  });

  it("khung khong ra ngoai mep du bam bao nhieu lan", () => {
    let crop = giua;
    for (let i = 0; i < 30; i++) crop = keyCrop(NGANG, crop, "ArrowLeft", true)!;
    expect(crop).toEqual({ ...giua, x: 0 });
    for (let i = 0; i < 30; i++) crop = keyCrop(NGANG, crop, "ArrowDown", true)!;
    expect(crop).toEqual({ ...giua, x: 0, y: 900 });
    expect(keyCrop(NGANG, initialCrop(NGANG), "ArrowRight", true)).toEqual(initialCrop(NGANG));
  });

  it("phim khac mui ten tra null de trinh duyet xu ly nhu thuong", () => {
    expect(["Enter", "Tab", " ", "a", "toString", "constructor"].map((k) => keyCrop(NGANG, giua, k, false))).toEqual([null, null, null, null, null, null]);
  });
});

describe("dragCrop", () => {
  const giua: CropState = { x: 500, y: 450, zoom: 200 };

  it("doi diem man hinh ra diem anh theo ti le hien cua san cat", () => {
    expect(dragCrop(NGANG, giua, { width: 500, height: 375 }, 50, -25)).toEqual({ ...giua, x: 700, y: 350 });
  });

  it("san rong hon anh (anh canh giua trong san) thi dung ti le cua chieu bi chan", () => {
    expect(dragCrop(NGANG, giua, { width: 800, height: 375 }, 50, 0)).toEqual({ ...giua, x: 700 });
    expect(dragCrop(DOC, initialCrop(DOC), { width: 600, height: 600 }, 0, 10)?.y).toBe(1060);
  });

  it("keo qua mep thi khung dung o mep; san chua co kich thuoc thi khung dung yen", () => {
    expect(dragCrop(NGANG, giua, { width: 500, height: 375 }, 9999, 9999)).toEqual({ ...giua, x: 1000, y: 900 });
    expect(dragCrop(NGANG, giua, { width: 0, height: 0 }, 50, 50)).toEqual(giua);
  });

  it("moi thao tac deu giu khung trong anh va dung 5:3", () => {
    const sizes: ImageSize[] = [NGANG, DOC, DET, { width: 7, height: 3 }, { width: 1, height: 1 }];
    for (const size of sizes) {
      let crop = initialCrop(size);
      for (const zoom of [100, 135, 250]) {
        crop = zoomCrop(size, crop, zoom);
        for (const [dx, dy] of [[-1e6, 0], [1e6, 1e6], [3, -7]]) {
          crop = dragCrop(size, crop, { width: 320, height: 200 }, dx, dy);
          expect(hopLe(size, crop), `${size.width}x${size.height} zoom ${zoom}`).toBe(true);
        }
      }
    }
  });
});

describe("coverOutputSize", () => {
  it.each<[number, number, number]>([
    [2000, 1200, 720],
    [1200, 1200, 720],
    [1203.7, 1200, 720],
    [1000, 1000, 600],
    [997, 995, 597],
    [3, 5, 3],
  ])("khung rong %s diem anh: bia %sx%s", (rong, w, h) => {
    expect(coverOutputSize({ x: 0, y: 0, width: rong, height: (rong * 3) / 5 })).toEqual({ width: w, height: h });
  });

  it("moi be rong khung cho bia dung 5:3, rong toi da IMAGE_MAX_WIDTH_PX va khong phong to", () => {
    for (let rong = 1; rong <= 3000; rong++) {
      const { width, height } = coverOutputSize({ x: 0, y: 0, width: rong, height: (rong * 3) / 5 });
      expect(width * COVER_RATIO.height === height * COVER_RATIO.width && width <= IMAGE_MAX_WIDTH_PX && width <= Math.max(COVER_RATIO.width, rong)).toBe(true);
    }
  });
});
