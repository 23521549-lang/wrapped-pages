import { describe, expect, it } from "vitest";
import {
  docNam, docThang, gomTheoThang, namCo, namMacDinh, namThang, thangMacDinh, type Dau,
} from "@/lib/dau-thoi-gian";

/*
 * Trang Dau thoi gian gom hai dong thoi gian cua mot cuon theo thang. Ham thuan nen kiem thang o day: thang tinh theo
 * gio Viet Nam, thu tu trong mot thang theo luot, nam va thang mac dinh, va doc tham so tu duong dan.
 */

/** Mot thoi diem theo gio Viet Nam (UTC+7), de bai kiem doc ra dung ngay du may chay kiem o mui gio nao. */
const vn = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h - 7));

const bia = (key: string, ordinal: number | null, at: Date): Dau =>
  ({ loai: "bia", key, ordinal, first: ordinal, last: ordinal, at, cover: "nui-xa", coverMediaId: null });
const nhac = (key: string, ordinal: number | null, at: Date, youtubeId: string | null = "dQw4w9WgXcQ"): Dau =>
  ({ loai: "nhac", key, ordinal, first: ordinal, last: ordinal, at, youtubeId });

describe("namThang", () => {
  it("doc theo gio Viet Nam: 23 gio dem 31.12 gio UTC da la ngay 1.1 nam sau o Viet Nam", () => {
    expect(namThang(new Date(Date.UTC(2025, 11, 31, 20)))).toEqual({ nam: 2026, thang: 1 });
  });

  it("dau thang va cuoi thang", () => {
    expect(namThang(vn(2026, 9, 1, 0))).toEqual({ nam: 2026, thang: 9 });
    expect(namThang(vn(2026, 9, 30, 23))).toEqual({ nam: 2026, thang: 9 });
  });
});

describe("gomTheoThang", () => {
  it("luon du muoi hai o, ke ca thang khong co dau nao", () => {
    const o = gomTheoThang([], 2026);
    expect(o.map((x) => x.thang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(o.every((x) => x.dau.length === 0)).toBe(true);
  });

  it("moi dau vao dung thang cua no, chi cua nam dang xem", () => {
    const o = gomTheoThang([bia("a", null, vn(2026, 3, 5)), bia("b", 1, vn(2026, 9, 20)), bia("c", 2, vn(2025, 9, 20))], 2026);
    expect(o[2].dau.map((d) => d.key)).toEqual(["a"]);
    expect(o[8].dau.map((d) => d.key)).toEqual(["b"]);
    expect(o.flatMap((x) => x.dau).map((d) => d.key)).not.toContain("c");
  });

  it("trong mot thang: theo luot, o mo dau truoc het, cung luot thi bia truoc nhac", () => {
    const o = gomTheoThang([
      nhac("n2", 2, vn(2026, 9, 21)),
      bia("b2", 2, vn(2026, 9, 21)),
      bia("b0", null, vn(2026, 9, 18)),
      nhac("n1", 1, vn(2026, 9, 19)),
    ], 2026);
    expect(o[8].dau.map((d) => d.key)).toEqual(["b0", "n1", "b2", "n2"]);
  });

  it("o go nhac la mot dau that, khong bi bo di", () => {
    const o = gomTheoThang([nhac("go", 3, vn(2026, 9, 22), null)], 2026);
    expect(o[8].dau).toHaveLength(1);
  });
});

describe("nam va thang mac dinh", () => {
  it("nam mac dinh la nam cua dau moi nhat theo luot, khong theo thu tu mang", () => {
    const dau = [bia("moi", 3, vn(2026, 2, 1)), bia("cu", null, vn(2025, 11, 1))];
    expect(namMacDinh(dau, vn(2026, 9, 25))).toBe(2026);
  });

  it("chua co dau nao thi la nam hien tai", () => {
    expect(namMacDinh([], vn(2026, 9, 25))).toBe(2026);
  });

  it("thang mac dinh la thang cua dau moi nhat trong nam", () => {
    const o = gomTheoThang([bia("a", null, vn(2026, 3, 5)), bia("b", 1, vn(2026, 7, 2)), nhac("c", 2, vn(2026, 5, 9))], 2026);
    expect(thangMacDinh(o)).toBe(5);
  });

  it("ca nam trong thi khong co thang nao duoc chon", () => {
    expect(thangMacDinh(gomTheoThang([], 2026))).toBeNull();
  });

  it("cac nam co dau: tang dan, khong trung", () => {
    expect(namCo([bia("a", 2, vn(2026, 1, 1)), bia("b", null, vn(2024, 5, 1)), bia("c", 1, vn(2026, 3, 1))])).toEqual([2024, 2026]);
  });
});

describe("doc tham so tu duong dan", () => {
  it("nam hop le trong khoang tu nam tao cuon toi nam nay", () => {
    expect(docNam("2025", 2024, 2026, 2026)).toBe(2025);
  });

  it("nam sai, truoc nam tao cuon hay sau nam nay deu ve mac dinh", () => {
    for (const raw of ["abcd", "20", "2023", "2027", "", undefined, ["2025"]]) {
      expect(docNam(raw, 2024, 2026, 2026), String(raw)).toBe(2026);
    }
  });

  it("thang 1 toi 12, sai thi ve mac dinh", () => {
    expect(docThang("7", 3)).toBe(7);
    expect(docThang("12", 3)).toBe(12);
    for (const raw of ["0", "13", "x", "", undefined, "7.5"]) expect(docThang(raw, 3), String(raw)).toBe(3);
  });
});
