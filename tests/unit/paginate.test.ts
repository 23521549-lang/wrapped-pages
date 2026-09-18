import { describe, it, expect } from "vitest";
import { paginate, type Unit } from "@/lib/paginate";

/** n dong lien nhau, moi dong cao h, bat dau tu y0. pos = chi so dong. */
function dong(n: number, h = 46, y0 = 0): Unit[] {
  return Array.from({ length: n }, (_, i) => ({ top: y0 + i * h, bottom: y0 + (i + 1) * h, pos: i }));
}

/** Bo sinh so gia ngau nhien co dinh hat giong, de test lap lai y het moi lan chay. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("paginate", () => {
  it("tai lieu khong co don vi nao van co mot to trong", () => {
    expect(paginate([], 460)).toEqual([{ from: 0, to: 0, top: 0, spaceLeft: 460 }]);
  });

  it("vua khit mot to thi khong sinh to thu hai", () => {
    expect(paginate(dong(10), 460)).toEqual([{ from: 0, to: 10, top: 0, spaceLeft: 0 }]);
  });

  it("tran mot dong, tuc mot chu roi xuong dong moi, thi dong do sang to sau", () => {
    expect(paginate(dong(11), 460)).toEqual([
      { from: 0, to: 10, top: 0, spaceLeft: 0 },
      { from: 10, to: 11, top: 460, spaceLeft: 414 },
    ]);
  });

  it("khoi nguyen khong vua cho trong thi day nguyen khoi sang to sau", () => {
    const units: Unit[] = [...dong(8), { top: 380, bottom: 580, pos: 8 }];
    expect(paginate(units, 460)).toEqual([
      { from: 0, to: 8, top: 0, spaceLeft: 80 },
      { from: 8, to: 9, top: 380, spaceLeft: 260 },
    ]);
  });

  it("khoi nguyen cao hon mot to thi nam rieng mot to, to sau bat dau lai binh thuong", () => {
    const units: Unit[] = [{ top: 0, bottom: 600, pos: 0 }, { top: 612, bottom: 658, pos: 1 }];
    expect(paginate(units, 460)).toEqual([
      { from: 0, to: 1, top: 0, spaceLeft: -152 },
      { from: 1, to: 2, top: 612, spaceLeft: 414 },
    ]);
  });

  it("khoang cach giua hai doan o day to bi bo, to moi bat dau tu dinh dong dau", () => {
    const units = [...dong(9), ...dong(3, 46, 427)];
    const sheets = paginate(units, 460);
    expect(sheets.map((s) => [s.from, s.to, s.top])).toEqual([[0, 9, 0], [9, 12, 427]]);
    expect(sheets[0].spaceLeft).toBe(33);
  });

  it("chuoi dai qua nhieu to: moi don vi co mat dung mot lan, dung thu tu, to nao cung vua", () => {
    const rnd = mulberry32(7);
    const units: Unit[] = [];
    let y = 0;
    for (let i = 0; i < 400; i++) {
      const h = rnd() < 0.05 ? 120 + Math.floor(rnd() * 400) : 27;
      y += rnd() < 0.2 ? 13 : 0;
      units.push({ top: y, bottom: y + h, pos: i });
      y += h;
    }
    const sheets = paginate(units, 460);
    expect(sheets[0].from).toBe(0);
    expect(sheets.at(-1)!.to).toBe(units.length);
    for (let k = 1; k < sheets.length; k++) expect(sheets[k].from).toBe(sheets[k - 1].to);
    for (const s of sheets) {
      expect(s.to).toBeGreaterThan(s.from);
      if (s.to - s.from > 1) expect(units[s.to - 1].bottom - s.top).toBeLessThanOrEqual(460);
    }
  });

  it("tu choi chieu cao to khong duong", () => {
    expect(() => paginate(dong(1), 0)).toThrow(RangeError);
  });
});
