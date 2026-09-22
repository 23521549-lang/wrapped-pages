import { describe, expect, it } from "vitest";
import { roundEditPath, roundSheetParam } from "@/lib/round";

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";

describe("roundEditPath", () => {
  it("to 1 khong kem tham so; to sau kem ?trang", () => {
    expect(roundEditPath(SACH, 2)).toBe(`/sach/${SACH}/sua-luot/2`);
    expect(roundEditPath(SACH, 2, 1)).toBe(`/sach/${SACH}/sua-luot/2`);
    expect(roundEditPath(SACH, 2, 3)).toBe(`/sach/${SACH}/sua-luot/2?trang=3`);
  });
});

describe("roundSheetParam", () => {
  it.each<[string | string[] | undefined, number]>([
    [undefined, 1], ["", 1], ["0", 1], ["01", 1], ["1e1", 1], ["-2", 1], [["2", "3"], 1], ["abc", 1],
    ["1", 1], ["3", 3], ["4", 4], ["9", 4], ["123456", 1],
  ])("%j voi luot bon to ra %i", (trang, ra) => {
    expect(roundSheetParam(trang, 4)).toBe(ra);
  });
});
