import { describe, expect, it } from "vitest";
import { BLANK_CODE_POINTS, NOT_BLANK_PATTERN } from "@/lib/doc/text";

describe("khoang trang cua doan trich", () => {
  it("BLANK_CODE_POINTS dung bang tap ky tu ma lop khoang trang cua JavaScript nhan, tren moi ky tu BMP", () => {
    const js: number[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) if (/\s/.test(String.fromCharCode(cp))) js.push(cp);
    expect([...BLANK_CODE_POINTS]).toEqual(js);
  });

  it("NOT_BLANK_PATTERN khop chuoi co chu, khong khop chuoi chi co khoang trang cac loai", () => {
    const re = new RegExp(NOT_BLANK_PATTERN);
    expect(re.test(String.fromCharCode(32, 160, 12288, 9, 10, 65279))).toBe(false);
    expect(re.test("  chữ ")).toBe(true);
    expect(re.test(".")).toBe(true);
  });
});
