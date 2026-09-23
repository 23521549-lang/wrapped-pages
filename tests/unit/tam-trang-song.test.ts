import { describe, it, expect } from "vitest";
import { CHU_SOM_MS, luc, SONG_EASE, SONG_HET, SONG_MS, TOE, treChu, VONG } from "@/lib/tam-trang/song-nhip";

describe("nhip song nuoc", () => {
  it("cac moc thoi gian dung ban mau da duyet", () => {
    expect([SONG_MS, SONG_HET, CHU_SOM_MS]).toEqual([2600, 3150, 80]);
    expect(SONG_EASE).toBe("cubic-bezier(0.33, 0.02, 0.3, 1)");
    expect(VONG.map((v) => v[0])).toEqual([0, 380, 860, 1400]);
    expect(TOE.map((v) => v[0])).toEqual([0, 280, 600]);
  });

  it("mep song di gan nhu deu: khong bung nhanh luc dau, khong dung lai luc cuoi", () => {
    expect(luc(0)).toBe(0);
    expect(luc(1)).toBeCloseTo(1, 5);
    // Di duoc mot phan tu duong trong khoang mot phan tu thoi gian, nua duong trong khoang mot phan ba thoi gian:
    // song lan deu. Duong cong bung nhanh quen dung (0.16, 1, 0.3, 1) chi mat 0.04 va 0.10 thoi gian cho hai moc do.
    expect(luc(0.25)).toBeGreaterThan(0.18);
    expect(luc(0.5)).toBeGreaterThan(0.3);
    expect(luc(0.5)).toBeLessThan(0.62);
    let truoc = -1;
    for (let i = 0; i <= 20; i++) {
      const x = luc(i / 20);
      expect(x).toBeGreaterThanOrEqual(truoc);
      truoc = x;
    }
  });

  it("dong chu cang xa tam song cang hien muon, som hon mep song 80ms, khong bao gio am", () => {
    const gan = treChu(60, 50, 900);
    const xa = treChu(800, 50, 900);
    expect(gan).toBeLessThan(150);
    expect(xa).toBeGreaterThan(gan + 1000);
    expect(xa).toBeLessThanOrEqual(SONG_MS);
    expect(treChu(500, 50, 900)).toBe(Math.max(0, Math.round(luc((500 - 50) / 850) * SONG_MS) - CHU_SOM_MS));
    // Dai troi chua do duoc (R = r0): khong tre, chu hien ngay.
    expect(treChu(10, 50, 50)).toBe(0);
  });
});
