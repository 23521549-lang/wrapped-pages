import { describe, it, expect } from "vitest";
import { CONTENT_HEIGHT, CONTENT_WIDTH, VOICE_BLOCK_HEIGHT } from "@/lib/sheet";
import { AUDIO_MAX_MS, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, PEAK_COUNT } from "@/lib/media/kinds";
import { imageBox, mediaBlockHeight } from "@/lib/media/layout";
import { isMediaNodeType, mediaNodeId, mediaSrc, type MediaNode } from "@/lib/media/node";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const anh = (w: number, h: number): MediaNode => ({ type: "anh", attrs: { id: ID, w, h } });

describe("imageBox", () => {
  it.each<[string, number, number, number, number]>([
    ["rong hon vung chu thi co ve CONTENT_WIDTH, cao theo ti le", 1200, 900, CONTENT_WIDTH, 228],
    ["hep hon vung chu giu dung co that, khong phong to", 200, 300, 200, 300],
    ["mot diem anh van la mot diem anh", 1, 1, 1, 1],
    ["hep va doc qua tran thi rong giu nguyen, cao kep ve tran", 100, 1000, 100, CONTENT_HEIGHT],
  ])("%s", (_ten, w, h, rong, cao) => {
    expect(imageBox({ w, h })).toEqual({ width: rong, height: cao });
  });
});

describe("mediaBlockHeight", () => {
  it.each<[string, number, number, number]>([
    ["rong dung vung chu, cao dung tran", CONTENT_WIDTH, CONTENT_HEIGHT, CONTENT_HEIGHT],
    ["cao hon tran mot diem anh thi kep ve tran", CONTENT_WIDTH, CONTENT_HEIGHT + 1, CONTENT_HEIGHT],
    ["anh lon nhat cho phep", IMAGE_MAX_WIDTH_PX, IMAGE_MAX_HEIGHT_PX, 405],
    ["anh ngang 4:3", 1200, 900, 228],
    ["mot diem anh vuong khong gian ra", 1, 1, 1],
    ["doc nhat: rong 1, cao toi da", 1, IMAGE_MAX_HEIGHT_PX, CONTENT_HEIGHT],
    ["det nhat van cao it nhat 1", IMAGE_MAX_WIDTH_PX, 1, 1],
    ["lam tron nua len: 9.5 thanh 10", 608, 19, 10],
    ["sat duoi tran: 459.04 thanh 459", 1000, 1510, CONTENT_HEIGHT - 1],
    ["sat tren tran: 459.65 lam tron len dung tran", 1000, 1512, CONTENT_HEIGHT],
  ])("anh: %s", (_ten, w, h, cao) => {
    expect(mediaBlockHeight(anh(w, h))).toBe(cao);
  });

  it("moi kich thuoc anh hop le cho chieu cao nguyen tu 1 toi CONTENT_HEIGHT: khoi nguyen luon vua mot to", () => {
    let thapNhat = Number.POSITIVE_INFINITY;
    let caoNhat = 0;
    let nguyen = true;
    for (let w = 1; w <= IMAGE_MAX_WIDTH_PX; w++) {
      for (let h = 1; h <= IMAGE_MAX_HEIGHT_PX; h++) {
        const cao = mediaBlockHeight(anh(w, h));
        thapNhat = Math.min(thapNhat, cao);
        caoNhat = Math.max(caoNhat, cao);
        nguyen &&= Number.isInteger(cao);
      }
    }
    expect([thapNhat, caoNhat, nguyen]).toEqual([1, CONTENT_HEIGHT, true]);
  });

  it("ghi am cao co dinh VOICE_BLOCK_HEIGHT du dai hay ngan, va vua mot to", () => {
    const peaks = Array.from({ length: PEAK_COUNT }, () => 0);
    for (const ms of [1, AUDIO_MAX_MS]) {
      expect(mediaBlockHeight({ type: "ghi-am", attrs: { id: ID, ms, peaks } })).toBe(VOICE_BLOCK_HEIGHT);
    }
    expect(VOICE_BLOCK_HEIGHT).toBeGreaterThan(0);
    expect(VOICE_BLOCK_HEIGHT).toBeLessThanOrEqual(CONTENT_HEIGHT);
  });
});

describe("khoi media trong tai lieu", () => {
  it("chi anh va ghi-am la khoi media; bia khong nam trong trang", () => {
    expect(["anh", "ghi-am", "bia", "paragraph", "image", ""].map(isMediaNodeType)).toEqual([true, true, false, false, false, false]);
  });

  it("trinh duyet chi doc media qua route /m", () => {
    expect(mediaSrc(ID)).toBe(`/m/${ID}`);
  });

  it("mediaNodeId chi nhan attrs.id dang uuid", () => {
    expect(mediaNodeId({ type: "anh", attrs: { id: ID, w: 1, h: 1 } })).toBe(ID);
    const hong = [
      { type: "anh" },
      { type: "anh", attrs: null },
      { type: "anh", attrs: "id" },
      { type: "anh", attrs: {} },
      { type: "anh", attrs: { id: 7 } },
      { type: "ghi-am", attrs: { id: "khong-phai-uuid" } },
    ];
    expect(hong.map(mediaNodeId)).toEqual(hong.map(() => null));
  });
});
