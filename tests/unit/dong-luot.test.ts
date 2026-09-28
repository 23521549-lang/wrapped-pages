import { describe, expect, it } from "vitest";
import { baiTheoLuot, cuoiCo, hienHanh } from "@/lib/dong-luot";

/*
 * Hai dong thoi gian cua man Sua sach (chu du an 28/09): moi luot co the dat bia hay nhac rieng; luot khong dat thi giu
 * cai cua luot truoc. Ham thuan tinh gia tri hien hanh cua tung luot va luot quyet dinh gia tri dang dung.
 */

describe("hienHanh", () => {
  it("luot khong dat gi thi giu gia tri cua luot gan nhat phia truoc", () => {
    expect(hienHanh(["a", null, "b", null, null])).toEqual(["a", "a", "b", "b", "b"]);
  });

  it("truoc o dau tien co gia tri thi null; khong o nao co gia tri thi toan null", () => {
    expect(hienHanh([null, "a", null])).toEqual([null, "a", "a"]);
    expect(hienHanh([null, null])).toEqual([null, null]);
    expect(hienHanh([])).toEqual([]);
  });
});

describe("cuoiCo", () => {
  it("luot cuoi cung co gia tri rieng; khong co thi -1", () => {
    expect(cuoiCo(["a", null, "b", null])).toBe(2);
    expect(cuoiCo([null, null])).toBe(-1);
  });
});

describe("baiTheoLuot", () => {
  it("o nhac rieng la bai do, o go nhac la im, luot khong dat thi phat tiep bai cua luot truoc", () => {
    const os = [{ youtubeId: "A" }, null, { youtubeId: null }, null, { youtubeId: "B" }, null];
    expect(baiTheoLuot(os)).toEqual(["A", "A", null, null, "B", "B"]);
  });

  it("chua luot nao dat nhac thi moi luot deu im", () => {
    expect(baiTheoLuot([null, null])).toEqual([null, null]);
  });
});
