import { describe, it, expect } from "vitest";
import { PEAK_COUNT, PEAK_MAX } from "@/lib/media/kinds";
import { isPeaks } from "@/lib/media/node";
import { levelOf, peaksFromLevels } from "@/lib/media/peaks";

describe("levelOf", () => {
  it("im lang la 0, nua bien do la 0.5, toan bien do gan 1, khung rong la 0", () => {
    expect(levelOf(new Uint8Array(64).fill(128))).toBe(0);
    expect(levelOf(new Uint8Array(64).fill(192))).toBeCloseTo(0.5, 6);
    expect(levelOf(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 255)))).toBeCloseTo(1, 2);
    expect(levelOf(new Uint8Array(0))).toBe(0);
  });
});

describe("peaksFromLevels", () => {
  it("luon ra dung PEAK_COUNT cot so nguyen tu 0 toi PEAK_MAX, dung hinh may chu nhan", () => {
    for (const n of [0, 1, 7, 48, 49, 1800]) {
      const levels = Array.from({ length: n }, (_, i) => ((i * 37) % 100) / 100);
      expect(isPeaks(peaksFromLevels(levels)), `n=${n}`).toBe(true);
    }
  });

  it("cot cao nhat la PEAK_MAX, cot khac chuan hoa theo no; im lang hoan toan thi toan 0", () => {
    const levels = Array.from({ length: 96 }, (_, i) => (i < 48 ? 0.25 : 0.5));
    expect(peaksFromLevels(levels)).toEqual([...Array(24).fill(50), ...Array(24).fill(PEAK_MAX)]);
    expect(peaksFromLevels(Array(300).fill(0))).toEqual(Array(PEAK_COUNT).fill(0));
  });

  it("moi cot la muc lon nhat trong doan cua no: tieng ngan khong bi trung binh mat", () => {
    const levels = Array(480).fill(0.2);
    levels[5] = 0.8;
    const peaks = peaksFromLevels(levels);
    expect(peaks[0]).toBe(PEAK_MAX);
    expect(peaks.slice(1)).toEqual(Array(PEAK_COUNT - 1).fill(25));
  });

  it("day ngan hon PEAK_COUNT thi moi muc trai ra nhieu cot", () => {
    expect(peaksFromLevels([0.5, 1])).toEqual([...Array(24).fill(50), ...Array(24).fill(PEAK_MAX)]);
  });
});
