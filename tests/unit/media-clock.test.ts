import { describe, it, expect } from "vitest";
import { clockLabel, durationLabel } from "@/lib/media/clock";
import { WAVE_HEIGHT, WAVE_STEP, waveBars } from "@/lib/media/wave";

describe("clockLabel, durationLabel", () => {
  it("gio dang chay lam tron xuong, do dai lam tron len, phut khong co so 0 dau", () => {
    expect([0, 999, 1_000, 42_900, 84_000, 180_000].map(clockLabel)).toEqual(["0:00", "0:00", "0:01", "0:42", "1:24", "3:00"]);
    expect([1, 999, 1_000, 83_001, 84_000, 180_000].map(durationLabel)).toEqual(["0:01", "0:01", "0:01", "1:24", "1:24", "3:00"]);
  });
});

describe("waveBars", () => {
  it("moi cot cach nhau WAVE_STEP, canh giua, cao tu 4 toi WAVE_HEIGHT theo muc, kep gia tri ngoai khoang", () => {
    const bars = waveBars([0, 50, 100, 250, -3], 100);
    const want = [4, 52, 100, 100, 4];
    bars.forEach((b, i) => {
      expect(b.x, `x ${i}`).toBeCloseTo(i * WAVE_STEP + 0.7, 6);
      expect(b.height, `cao ${i}`).toBeCloseTo(want[i], 6);
      expect(b.y + b.height / 2, `giua ${i}`).toBeCloseTo(WAVE_HEIGHT / 2, 6);
      expect(b.width).toBeCloseTo(2.6, 6);
    });
  });
});
