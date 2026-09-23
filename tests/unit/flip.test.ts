import { describe, it, expect } from "vitest";
import { flipPlan, MAX_SHOWN_SHEETS, pageLabel, viewCount, viewOf, viewSheets, type FlipMode } from "@/lib/flip";

describe("khung nhin", () => {
  it("so khung nhin theo so to", () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => viewCount("mot", n))).toEqual([1, 1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3, 4, 5].map((n) => viewCount("doi", n))).toEqual([1, 1, 1, 2, 2, 3]);
  });

  it("to trong tung khung o che do hai trang: ghep (1,2), (3,4)..., trang trai dau khong bao gio trong", () => {
    expect(viewSheets("doi", 0, 5)).toEqual([0, 1]);
    expect(viewSheets("doi", 1, 5)).toEqual([2, 3]);
    expect(viewSheets("doi", 2, 5)).toEqual([4, null]);
    expect(viewSheets("doi", 1, 4)).toEqual([2, 3]);
    expect(viewSheets("doi", 0, 1)).toEqual([0, null]);
    expect(viewSheets("mot", 2, 5)).toEqual([2]);
  });

  it("khung nao cung hien nhieu nhat MAX_SHOWN_SHEETS to", () => {
    for (const mode of ["mot", "doi"] as const) {
      for (let v = 0; v < 6; v++) expect(viewSheets(mode, v, 7).length).toBeLessThanOrEqual(MAX_SHOWN_SHEETS);
    }
  });

  it("viewOf tim dung khung chua to", () => {
    for (const mode of ["mot", "doi"] as FlipMode[]) {
      for (let i = 0; i < 7; i++) expect(viewSheets(mode, viewOf(mode, i), 7)).toContain(i);
    }
  });

  it("nhan so trang", () => {
    expect(pageLabel("mot", 2, 12)).toBe("Trang 3 / 12");
    expect(pageLabel("doi", 1, 12)).toBe("Trang 3-4 / 12");
    expect(pageLabel("doi", 0, 12)).toBe("Trang 1-2 / 12");
    expect(pageLabel("doi", 2, 5)).toBe("Trang 5 / 5");
  });
});

describe("la dang lat", () => {
  it("lat toi o che do hai trang: la mang to phai, mat sau la to trai cua khung ke", () => {
    expect(flipPlan("doi", 0, 1, 5)).toEqual({ front: 1, back: 2, left: 0, right: 3, fromDeg: 0, toDeg: -180 });
    expect(flipPlan("doi", 1, 1, 5)).toEqual({ front: 3, back: 4, left: 2, right: null, fromDeg: 0, toDeg: -180 });
  });

  it("lat lui o che do hai trang: cung la giay do, xoay nguoc lai", () => {
    expect(flipPlan("doi", 2, -1, 5)).toEqual({ front: 3, back: 4, left: 2, right: null, fromDeg: -180, toDeg: 0 });
    expect(flipPlan("doi", 1, -1, 5)).toEqual({ front: 1, back: 2, left: 0, right: 3, fromDeg: -180, toDeg: 0 });
  });

  it("che do mot trang: mat sau la giay tron", () => {
    expect(flipPlan("mot", 0, 1, 3)).toEqual({ front: 0, back: null, left: null, right: 1, fromDeg: 0, toDeg: -180 });
    expect(flipPlan("mot", 2, -1, 3)).toEqual({ front: 1, back: null, left: null, right: 2, fromDeg: -180, toDeg: 0 });
  });

  it("khong lat ra ngoai dau hay cuoi sach", () => {
    expect(flipPlan("mot", 0, -1, 3)).toBeNull();
    expect(flipPlan("mot", 2, 1, 3)).toBeNull();
    expect(flipPlan("doi", 2, 1, 5)).toBeNull();
    expect(flipPlan("doi", 0, 1, 1)).toBeNull();
    expect(flipPlan("doi", 0, 1, 2)).toBeNull();
  });
});
