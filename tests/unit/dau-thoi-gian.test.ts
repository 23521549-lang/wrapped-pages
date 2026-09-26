import { describe, expect, it } from "vitest";
import { baiPhatDuoc, docThangSach, gomTheoNgay, gomTheoThang, ngayMacDinh, thangMacDinh, xepTheoDong, type Dau } from "@/lib/dau-thoi-gian";

/*
 * Trang Dau thoi gian dat hai dong thoi gian cua mot cuon len mot lich thang, cung khung voi Lich hoa (spec bo sung B4).
 * Ham thuan nen kiem thang o day: ngay va thang tinh theo gio Viet Nam, thu tu trong mot ngay theo luot, thang va ngay
 * mac dinh, va doc tham so tu duong dan.
 */

/** Mot thoi diem theo gio Viet Nam (UTC+7), de bai kiem doc ra dung ngay du may chay kiem o mui gio nao. */
const vn = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h - 7));

const bia = (key: string, ordinal: number | null, at: Date): Dau =>
  ({ loai: "bia", key, ordinal, first: ordinal, last: ordinal, at, cover: "nui-xa", coverMediaId: null });
const nhac = (key: string, ordinal: number | null, at: Date, youtubeId: string | null = "dQw4w9WgXcQ"): Dau =>
  ({ loai: "nhac", key, ordinal, first: ordinal, last: ordinal, at, youtubeId });

const THANG_9 = { y: 2026, m: 9 };

describe("gomTheoNgay", () => {
  it("moi dau vao dung ngay cua no theo gio Viet Nam, chi cua thang dang xem; ngay khong co dau thi khong co khoa", () => {
    const ngay = gomTheoNgay([
      bia("a", null, vn(2026, 9, 5)),
      bia("b", 1, vn(2026, 9, 20)),
      bia("c", 2, vn(2026, 8, 20)),
      // 20 gio UTC ngay 30.9 da la 3 gio sang ngay 1.10 o Viet Nam: thuoc thang 10, khong thuoc thang 9.
      nhac("d", 3, new Date(Date.UTC(2026, 8, 30, 20))),
    ], THANG_9);
    expect(Object.keys(ngay).map(Number)).toEqual([5, 20]);
    expect(ngay[5].map((d) => d.key)).toEqual(["a"]);
    expect(ngay[20].map((d) => d.key)).toEqual(["b"]);
  });

  it("trong mot ngay: theo luot, o mo dau truoc het, cung luot thi bia truoc nhac, du mang dau vao lon xon", () => {
    const ngay = gomTheoNgay([
      nhac("n2", 2, vn(2026, 9, 15, 19)),
      bia("b2", 2, vn(2026, 9, 15, 19)),
      bia("b1", 1, vn(2026, 9, 15, 8)),
      nhac("mo", null, vn(2026, 9, 15, 7)),
    ], THANG_9);
    expect(ngay[15].map((d) => d.key)).toEqual(["mo", "b1", "b2", "n2"]);
  });

  it("o go nhac la mot dau that, khong bi bo di", () => {
    const ngay = gomTheoNgay([nhac("go", 4, vn(2026, 9, 15), null)], THANG_9);
    expect(ngay[15]).toHaveLength(1);
  });
});

describe("thang va ngay mac dinh", () => {
  it("thang mac dinh la thang cua dau moi nhat theo luot, khong theo thu tu mang", () => {
    const dau = [bia("moi", 3, vn(2026, 9, 26)), bia("cu", 1, vn(2026, 6, 2)), nhac("giua", 2, vn(2026, 7, 14))];
    expect(thangMacDinh(dau, vn(2026, 12, 1))).toEqual(THANG_9);
  });

  it("chua co dau nao thi la thang cua hom nay", () => {
    expect(thangMacDinh([], vn(2026, 9, 26))).toEqual(THANG_9);
  });

  it("ngay mac dinh la ngay cua dau moi nhat trong thang dang xem", () => {
    const ngay = gomTheoNgay([bia("a", 1, vn(2026, 9, 3)), bia("b", 2, vn(2026, 9, 18)), nhac("c", 2, vn(2026, 9, 18))], THANG_9);
    expect(ngayMacDinh(ngay, null, 30)).toBe(18);
  });

  it("thang khong co dau nao: nhu Lich hoa, hom nay neu la thang nay, khong thi ngay cuoi thang", () => {
    expect(ngayMacDinh({}, 26, 30)).toBe(26);
    expect(ngayMacDinh({}, null, 31)).toBe(31);
  });
});

describe("doc tham so ?thang tu duong dan", () => {
  const TAO = { y: 2026, m: 5 };
  const NAY = { y: 2026, m: 9 };
  const MAC_DINH = { y: 2026, m: 8 };

  it("thang hop le trong khoang tu thang tao cuon toi thang nay", () => {
    expect(docThangSach("2026-05", TAO, NAY, MAC_DINH)).toEqual({ y: 2026, m: 5 });
    expect(docThangSach("2026-09", TAO, NAY, MAC_DINH)).toEqual({ y: 2026, m: 9 });
  });

  it("sai dinh dang, truoc thang tao cuon, sau thang nay hay khong phai chuoi deu ve thang mac dinh", () => {
    for (const raw of ["2026-4", "2026-13", "26-09", "2026-04", "2026-10", "2025-12", "", undefined, ["2026-06"]]) {
      expect(docThangSach(raw, TAO, NAY, MAC_DINH), String(raw)).toEqual(MAC_DINH);
    }
  });
});

describe("xepTheoDong va gomTheoThang (lich doi thang tai cho, spec bo sung B4 ban hai)", () => {
  it("xep theo luot, o mo dau truoc het, cung luot thi bia truoc nhac; khong dong vao mang goc", () => {
    const goc = [nhac("n2", 2, vn(2026, 9, 1)), bia("b2", 2, vn(2026, 9, 1)), bia("mo", null, vn(2026, 8, 1))];
    expect(xepTheoDong(goc).map((d) => d.key)).toEqual(["mo", "b2", "n2"]);
    expect(goc.map((d) => d.key)).toEqual(["n2", "b2", "mo"]);
  });

  it("gom theo khoa thang roi theo ngay, giu thu tu dau vao", () => {
    const dau = [
      { key: "a", thang: "2026-08", ngay: 31 },
      { key: "b", thang: "2026-09", ngay: 26 },
      { key: "c", thang: "2026-09", ngay: 26 },
      { key: "d", thang: "2026-09", ngay: 1 },
    ];
    const g = gomTheoThang(dau);
    expect(Object.keys(g).sort()).toEqual(["2026-08", "2026-09"]);
    expect(g["2026-09"][26].map((d) => d.key)).toEqual(["b", "c"]);
    expect(g["2026-09"][1].map((d) => d.key)).toEqual(["d"]);
    expect(g["2026-09"][2]).toBeUndefined();
  });
});

describe("baiPhatDuoc", () => {
  const ds = [{ youtubeId: "a" }, { youtubeId: null }, { youtubeId: "b" }];
  it("bai phat duoc dau tien tu mot vi tri, bo qua o go nhac", () => {
    expect(baiPhatDuoc(ds, 0)).toBe(0);
    expect(baiPhatDuoc(ds, 1)).toBe(2);
    expect(baiPhatDuoc(ds, -3)).toBe(0);
  });
  it("het bai, hay ngay chi co go nhac, hay ngay khong co nhac: -1", () => {
    expect(baiPhatDuoc(ds, 3)).toBe(-1);
    expect(baiPhatDuoc([{ youtubeId: null }], 0)).toBe(-1);
    expect(baiPhatDuoc([], 0)).toBe(-1);
  });
});
