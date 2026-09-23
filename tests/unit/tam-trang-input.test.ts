import { describe, it, expect } from "vitest";
import { CHON_TROI, chuanNhan, NHAN_DAI, NHAN_HONG, NOTE_MAX, parseMoodInput } from "@/lib/tam-trang/input";

describe("parseMoodInput", () => {
  it("kieu troi phai la mot trong chin khoa", () => {
    for (const w of [undefined, null, "", "nang", "NANG-AM", 3, {}]) expect(parseMoodInput(w, "")).toEqual({ error: CHON_TROI });
  });

  it("loi nhan rong, chi dau cach, null hay thieu thi luu null", () => {
    for (const n of ["", "   ", null, undefined]) expect(parseMoodInput("mua-phun", n)).toEqual({ weather: "mua-phun", note: null });
  });

  it("loi nhan khong phai chuoi thi bao khong doc duoc", () => {
    for (const n of [1, {}, ["a"], true]) expect(parseMoodInput("giong", n)).toEqual({ error: NHAN_HONG });
  });

  it("toi da 80 ky tu dem theo code point, sau khi chuan hoa", () => {
    const tam = "ấ".repeat(NOTE_MAX);
    expect(parseMoodInput("nang-am", tam)).toEqual({ weather: "nang-am", note: tam });
    expect(parseMoodInput("nang-am", `${tam}a`)).toEqual({ error: NHAN_DAI });
    // Dang tach roi (NFD) cua 80 chu co dau van la 80 chu sau khi gop ve NFC.
    expect(parseMoodInput("nang-am", tam.normalize("NFD"))).toEqual({ weather: "nang-am", note: tam });
    // Bieu tuong cam xuc la mot code point: 80 cai van qua, dung nhu char_length cua Postgres.
    const vui = String.fromCodePoint(0x1f33c).repeat(NOTE_MAX);
    expect(parseMoodInput("nang-am", vui)).toEqual({ weather: "nang-am", note: vui });
    expect(parseMoodInput("nang-am", "a".repeat(10_000))).toEqual({ error: NHAN_DAI });
  });

  it("bien cua tran tho NOTE_MAX * 4: 320 ky tu qua duoc buoc chan som, 321 bi chan ngay", () => {
    // Tran tho chi chan chuoi CUC DAI truoc khi chuan hoa; dung 320 don vi UTF-16 phai di tiep toi buoc dem code point
    // (va o day bi chan vi 320 > 80), con 321 bi chan ngay o buoc dau. Hai duong deu ra cung mot cau bao, nen phan biet
    // chung bang chinh chuanNhan: chuoi 320 ky tu dieu khien duoc gom thanh mot dau cach roi cat sach, tuc no DA di qua
    // chuan hoa va ra loi nhan rong; neu tran tho bi ha xuong duoi 320 thi dong nay doi thanh NHAN_DAI va bai kiem do.
    const dieuKhien = String.fromCodePoint(9).repeat(320);
    expect(parseMoodInput("nang-am", dieuKhien)).toEqual({ weather: "nang-am", note: null });
    expect(parseMoodInput("nang-am", `${dieuKhien}${String.fromCodePoint(9)}`)).toEqual({ error: NHAN_DAI });
    // Cung hai do dai voi chu that: ca hai deu qua 80 code point nen deu bi tu choi, chi khac cho bi tu choi.
    expect(parseMoodInput("nang-am", "a".repeat(320))).toEqual({ error: NHAN_DAI });
    expect(parseMoodInput("nang-am", "a".repeat(321))).toEqual({ error: NHAN_DAI });
  });

  it("chuan hoa: ky tu dieu khien thanh dau cach, gop dau cach, cat hai dau", () => {
    const xuongDong = String.fromCodePoint(10);
    const tab = String.fromCodePoint(9);
    expect(chuanNhan(`  Nhớ${xuongDong}${xuongDong}cậu${tab}lắm   nha  `)).toBe("Nhớ cậu lắm nha");
    expect(parseMoodInput("may-nhe", ` Mai${xuongDong}gặp `)).toEqual({ weather: "may-nhe", note: "Mai gặp" });
  });
});
