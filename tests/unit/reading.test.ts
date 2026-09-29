import { describe, it, expect } from "vitest";
import { startSheet } from "@/lib/reading";

describe("startSheet", () => {
  it("?trang hop le thang moi thu khac, ke ca trang dang doc do", () => {
    expect(startSheet("3", 5, null, 2, false)).toBe(2);
    expect(startSheet("1", 5, 4, 5, false)).toBe(0);
    expect(startSheet("5", 5, 2, 0, true)).toBe(4);
  });

  it.each([["0"], ["6"], ["abc"], ["1.5"], ["-2"], [" 2"], [""]])("?trang=%s khong hop le thi bo qua", (trang) => {
    expect(startSheet(trang, 5, null, 0, true)).toBe(0);
    expect(startSheet(trang, 5, null, 3, false)).toBe(2);
    expect(startSheet(trang, 5, 4, 3, false)).toBe(3);
  });

  it("nhieu gia tri trang cung bi bo qua", () => {
    expect(startSheet(["2", "3"], 5, null, 0, true)).toBe(0);
  });

  it("trang dang doc do thang to chua thay, voi ca sach cua minh lan cua nguoi kia", () => {
    expect(startSheet(undefined, 5, 4, 2, false)).toBe(3);
    expect(startSheet(undefined, 5, 1, 3, false)).toBe(0);
    expect(startSheet(undefined, 5, 3, 0, true)).toBe(2);
  });

  it("trang dang doc do khong con trong cuon thi bo qua", () => {
    expect(startSheet(undefined, 5, 6, 2, false)).toBe(1);
    expect(startSheet(undefined, 5, 0, 0, true)).toBe(0);
  });

  it("chua doc do: sach cua nguoi kia mo o to nho nhat chua thay; thay het roi thi ve to 1", () => {
    expect(startSheet(undefined, 5, null, 1, false)).toBe(0);
    expect(startSheet(undefined, 5, null, 4, false)).toBe(3);
    expect(startSheet(undefined, 5, null, 0, false)).toBe(0);
  });

  it("chua doc do: chu sach mo o to 1", () => {
    expect(startSheet(undefined, 5, null, 4, true)).toBe(0);
  });

  // readBook khong con tra ra so nay (firstUnread luon la mot vi tri co that), nhung startSheet la ham thuan nhan so
  // tu ben ngoai: rao chuaDoc <= count o lai de mot cuon ngan di dung khong day duoc man doc ra ngoai mang to.
  it("to chua thay vuot so to thi ve to 1", () => {
    expect(startSheet(undefined, 5, null, 9, false)).toBe(0);
  });
});
