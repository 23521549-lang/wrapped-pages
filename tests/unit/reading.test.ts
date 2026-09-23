import { describe, it, expect } from "vitest";
import { startSheet } from "@/lib/reading";

describe("startSheet", () => {
  it("?trang hop le thang moi thu khac", () => {
    expect(startSheet("3", 5, 2, false)).toBe(2);
    expect(startSheet("1", 5, 5, false)).toBe(0);
    expect(startSheet("5", 5, 0, true)).toBe(4);
  });

  it.each([["0"], ["6"], ["abc"], ["1.5"], ["-2"], [" 2"], [""]])("?trang=%s khong hop le thi bo qua", (trang) => {
    expect(startSheet(trang, 5, 0, true)).toBe(0);
    expect(startSheet(trang, 5, 3, false)).toBe(2);
  });

  it("nhieu gia tri trang cung bi bo qua", () => {
    expect(startSheet(["2", "3"], 5, 0, true)).toBe(0);
  });

  it("sach cua nguoi kia mo o to nho nhat chua thay; thay het roi thi ve to 1", () => {
    expect(startSheet(undefined, 5, 1, false)).toBe(0);
    expect(startSheet(undefined, 5, 4, false)).toBe(3);
    expect(startSheet(undefined, 5, 0, false)).toBe(0);
  });

  it("chu sach luon mo o to 1", () => {
    expect(startSheet(undefined, 5, 4, true)).toBe(0);
  });
});
