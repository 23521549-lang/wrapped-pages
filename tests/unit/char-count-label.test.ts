import { describe, it, expect } from "vitest";
import { CHAR_COUNT_SHOW_RATIO, charCountLabel, groupThousands } from "@/lib/doc/counter";
import { DOC_LIMITS } from "@/lib/doc/validate";

const MAX = DOC_LIMITS.maxChars;
const NGUONG = Math.ceil(MAX * CHAR_COUNT_SHOW_RATIO);

describe("groupThousands", () => {
  it.each([
    [0, "0"], [7, "7"], [999, "999"], [1000, "1 000"], [18200, "18 200"], [20000, "20 000"], [1234567, "1 234 567"],
  ])("%i thanh %s", (n, chu) => {
    expect(groupThousands(n)).toBe(chu);
  });

  it("ngan nghin bang dau cach thuong, khong phai dau cach khong ngat", () => {
    expect(groupThousands(20000).includes(" ")).toBe(true);
    expect(groupThousands(20000).includes(String.fromCharCode(160))).toBe(false);
  });
});

describe("charCountLabel", () => {
  it("nguong hien la 90% tran cua ban nhap", () => {
    expect(MAX).toBe(20000);
    expect(NGUONG).toBe(18000);
  });

  it("duoi nguong thi an", () => {
    expect(charCountLabel(0)).toEqual({ kind: "an" });
    expect(charCountLabel(NGUONG - 1)).toEqual({ kind: "an" });
  });

  it("tu nguong toi dung tran thi dem so tren tran", () => {
    expect(charCountLabel(NGUONG)).toEqual({ kind: "gan", text: "18 000 / 20 000 ký tự" });
    expect(charCountLabel(18200)).toEqual({ kind: "gan", text: "18 200 / 20 000 ký tự" });
    expect(charCountLabel(MAX)).toEqual({ kind: "gan", text: "20 000 / 20 000 ký tự" });
  });

  it("vuot tran thi canh bao noi ro nhap khong luu duoc", () => {
    expect(charCountLabel(MAX + 1)).toEqual({ kind: "tran", text: "Vượt 20 000 ký tự, nháp không lưu được. Đăng bớt trang rồi viết tiếp." });
    expect(charCountLabel(100000)).toEqual({ kind: "tran", text: "Vượt 20 000 ký tự, nháp không lưu được. Đăng bớt trang rồi viết tiếp." });
  });
});
