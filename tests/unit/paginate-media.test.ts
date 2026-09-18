import { describe, it, expect } from "vitest";
import { paginate, type Sheet, type Unit } from "@/lib/paginate";
import { PEAK_COUNT } from "@/lib/media/kinds";
import { mediaBlockHeight } from "@/lib/media/layout";
import type { MediaNode } from "@/lib/media/node";
import { CONTENT_HEIGHT, VOICE_BLOCK_HEIGHT } from "@/lib/sheet";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
/** Nhip cua giay.css: chu 16px, line-height 1.7 nen moi dong cao 27.2px; khoi nao cung cach khoi sau .8em = 12.8px. */
const DONG = 27.2;
const KHE = 12.8;

const anh = (w: number, h: number): MediaNode => ({ type: "anh", attrs: { id: ID, w, h } });
const GHI_AM: MediaNode = { type: "ghi-am", attrs: { id: ID, ms: 84_000, peaks: Array.from({ length: PEAK_COUNT }, () => 50) } };

/** So la mot doan co bay nhieu dong; con lai la mot khoi media. */
type Khoi = number | MediaNode;

/**
 * Ve doc cac khoi nhu ban sao do: doan thanh tung dong cao `dong`, khoi media thanh mot don vi cao mediaBlockHeight, moi
 * khoi cach khoi sau `khe`. pos la chi so don vi.
 */
function xep(khoi: readonly Khoi[], khe = KHE, dong = DONG): Unit[] {
  const units: Unit[] = [];
  let y = 0;
  for (const k of khoi) {
    const cao = typeof k === "number" ? Array.from({ length: k }, () => dong) : [mediaBlockHeight(k)];
    for (const h of cao) {
      units.push({ top: y, bottom: y + h, pos: units.length });
      y += h;
    }
    y += khe;
  }
  return units;
}

/** Chi so don vi cua tung khoi media trong xep(khoi). */
function viTriMedia(khoi: readonly Khoi[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const k of khoi) {
    if (typeof k === "number") n += k;
    else out.push(n++);
  }
  return out;
}

/** Moi don vi co mat dung mot lan theo thu tu, khong to nao tran, va moi cho ngat deu can: don vi dau to sau khong vua to truoc. */
function kiemCacTo(units: readonly Unit[], sheets: readonly Sheet[]): void {
  expect(sheets[0].from).toBe(0);
  expect(sheets.at(-1)?.to).toBe(units.length);
  sheets.forEach((s, k) => {
    expect(s.to).toBeGreaterThan(s.from);
    expect(units[s.to - 1].bottom - s.top).toBeLessThanOrEqual(CONTENT_HEIGHT);
    if (k + 1 < sheets.length) {
      expect(sheets[k + 1].from).toBe(s.to);
      expect(units[s.to].bottom - s.top).toBeGreaterThan(CONTENT_HEIGHT);
    }
  });
}

describe("xep trang co khoi media", () => {
  it("anh khong cat duoc: khong vua cho trong con lai thi day nguyen sang to sau, to truoc de trong phia duoi", () => {
    const units = xep([10, anh(1200, 900), 2]);
    const sheets = paginate(units, CONTENT_HEIGHT);
    expect(sheets.map((s) => [s.from, s.to])).toEqual([[0, 10], [10, 13]]);
    expect(units[10].bottom - units[10].top).toBe(228);
    expect(sheets[0].spaceLeft).toBeCloseTo(CONTENT_HEIGHT - 10 * DONG - KHE, 6);
    kiemCacTo(units, sheets);
  });

  it("chuoi khoi dai qua nhieu to: moi don vi dung mot lan, khong khoi media nao vuot mep to, cho ngat nao cung can", () => {
    const anhs = [anh(1200, 900), anh(1200, 1600), anh(900, 1600), anh(200, 300), anh(1200, 675)];
    const khoi: Khoi[] = [];
    for (let i = 0; i < 36; i++) {
      khoi.push((i % 5) + 1);
      if (i % 3 === 0) khoi.push(anhs[i % anhs.length]);
      if (i % 4 === 1) khoi.push(GHI_AM);
    }
    const units = xep(khoi);
    const sheets = paginate(units, CONTENT_HEIGHT);
    expect(sheets.length).toBeGreaterThanOrEqual(3);
    kiemCacTo(units, sheets);
    const media = new Set(viTriMedia(khoi));
    expect(media.size).toBe(khoi.filter((k) => typeof k !== "number").length);
    for (const s of sheets) {
      for (const u of units.slice(s.from, s.to)) {
        if (media.has(u.pos)) expect(u.bottom - s.top).toBeLessThanOrEqual(CONTENT_HEIGHT);
      }
    }
  });

  it("anh vua khit cho trong con lai thi o lai to; cao hon mot diem anh thi sang nguyen to sau", () => {
    // 8 dong 46px lien nhau, khong khe: con dung 92px.
    expect(paginate(xep([8, anh(304, 92)], 0, 46), CONTENT_HEIGHT)).toEqual([{ from: 0, to: 9, top: 0, spaceLeft: 0 }]);
    expect(paginate(xep([8, anh(304, 93)], 0, 46), CONTENT_HEIGHT)).toEqual([
      { from: 0, to: 8, top: 0, spaceLeft: 92 },
      { from: 8, to: 9, top: 368, spaceLeft: 367 },
    ]);
  });

  it("anh cao dung mot to nam tron mot to, to sau bat dau lai binh thuong", () => {
    expect(paginate(xep([anh(304, 1000), 1], 0, 46), CONTENT_HEIGHT)).toEqual([
      { from: 0, to: 1, top: 0, spaceLeft: 0 },
      { from: 1, to: 2, top: CONTENT_HEIGHT, spaceLeft: CONTENT_HEIGHT - 46 },
    ]);
  });

  it("ghi am o ranh gioi: vua khit thi o lai, du mot diem anh thi sang nguyen to sau", () => {
    const cho = CONTENT_HEIGHT - VOICE_BLOCK_HEIGHT;
    expect(paginate(xep([4, GHI_AM], 0, cho / 4), CONTENT_HEIGHT).map((s) => [s.from, s.to, s.spaceLeft])).toEqual([[0, 5, 0]]);
    expect(paginate(xep([4, GHI_AM], 0, (cho + 1) / 4), CONTENT_HEIGHT).map((s) => [s.from, s.to, s.spaceLeft])).toEqual([
      [0, 4, VOICE_BLOCK_HEIGHT - 1],
      [4, 5, cho],
    ]);
  });
});
