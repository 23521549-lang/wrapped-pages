import { describe, it, expect } from "vitest";
import { msTuCss } from "@/components/reader/Flipbook";

describe("msTuCss (gia tri khong don vi phai la khong hop le)", () => {
  it("doc dung don vi ms", () => {
    expect(msTuCss("420ms")).toBe(420);
    expect(msTuCss(" 420ms ")).toBe(420);
  });

  it("doc dung don vi s, nhan 1000 (CSS minifier viet lai 420ms thanh .42s)", () => {
    expect(msTuCss("0.42s")).toBeCloseTo(420);
    expect(msTuCss(".42s")).toBeCloseTo(420);
  });

  it("gia tri khong co don vi la khong hop le: tra NaN chu khong doan la giay", () => {
    // Day chinh la con bug cu: "420" (thieu don vi) tung bi hieu thanh 420 giay = 420000ms.
    expect(Number.isNaN(msTuCss("420"))).toBe(true);
    expect(Number.isNaN(msTuCss("0"))).toBe(true);
  });

  it("chuoi khong doc duoc so, hoac don vi la thu khac ms/s, cung la khong hop le", () => {
    expect(Number.isNaN(msTuCss(""))).toBe(true);
    expect(Number.isNaN(msTuCss("abc"))).toBe(true);
    expect(Number.isNaN(msTuCss("420px"))).toBe(true);
  });
});
