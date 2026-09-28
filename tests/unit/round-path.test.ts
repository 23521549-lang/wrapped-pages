import { describe, expect, it } from "vitest";
import { editHrefs, roundEditPath, roundSheetParam } from "@/lib/round";

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";

describe("roundEditPath", () => {
  it("to 1 khong kem tham so; to sau kem ?trang", () => {
    expect(roundEditPath(SACH, 2)).toBe(`/sach/${SACH}/sua-luot/2`);
    expect(roundEditPath(SACH, 2, 1)).toBe(`/sach/${SACH}/sua-luot/2`);
    expect(roundEditPath(SACH, 2, 3)).toBe(`/sach/${SACH}/sua-luot/2?trang=3`);
  });
});

describe("editHrefs", () => {
  const LUOT_1 = "11111111-2222-4333-8444-555555555555";
  const LUOT_2 = "66666666-7777-4888-8999-aaaaaaaaaaaa";
  const luot = [{ id: LUOT_1, ordinal: 1, first: 1 }, { id: LUOT_2, ordinal: 2, first: 3 }];
  const to = [{ roundId: LUOT_1, position: 1 }, { roundId: LUOT_1, position: 2 }, { roundId: LUOT_2, position: 3 }, { roundId: LUOT_2, position: 4 }];

  it("chu sach: moi to deu co duong sua, ke ca to cua luot niem phong, mo dung to trong luot", () => {
    expect(editHrefs(SACH, true, to, luot)).toEqual([
      `/sach/${SACH}/sua-luot/1`, `/sach/${SACH}/sua-luot/1?trang=2`, `/sach/${SACH}/sua-luot/2`, `/sach/${SACH}/sua-luot/2?trang=2`,
    ]);
  });

  it("nguoi kia: khong to nao co duong sua; to khong thuoc luot nao cung null", () => {
    expect(editHrefs(SACH, false, to, luot)).toEqual([null, null, null, null]);
    expect(editHrefs(SACH, true, [{ roundId: "la", position: 9 }], luot)).toEqual([null]);
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
