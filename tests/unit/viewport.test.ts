import { describe, it, expect } from "vitest";
import { quaNuaTrongKhung, type KhungChuNhat } from "@/lib/viewport";

const RONG = 740;
const CAO = 360;

/** Khung rong x cao, goc tren trai o (x, y) cua khung nhin. */
const khung = (x: number, y: number, width = 320, height = 200): KhungChuNhat =>
  ({ left: x, top: y, right: x + width, bottom: y + height, width, height });

describe("quaNuaTrongKhung", () => {
  it("nam tron trong khung nhin thi dung", () => {
    expect(quaNuaTrongKhung(khung(100, 80), RONG, CAO)).toBe(true);
  });

  it("nam ngoai khung nhin o ca bon phia thi sai", () => {
    for (const k of [khung(100, CAO), khung(100, -200), khung(RONG, 80), khung(-320, 80)]) {
      expect(quaNuaTrongKhung(k, RONG, CAO), JSON.stringify(k)).toBe(false);
    }
  });

  it("theo chieu doc: dung mot nua la chua du, hon mot diem anh thi du", () => {
    expect(quaNuaTrongKhung(khung(100, CAO - 100), RONG, CAO)).toBe(false);
    expect(quaNuaTrongKhung(khung(100, CAO - 101), RONG, CAO)).toBe(true);
    expect(quaNuaTrongKhung(khung(100, -100), RONG, CAO)).toBe(false);
    expect(quaNuaTrongKhung(khung(100, -99), RONG, CAO)).toBe(true);
  });

  it("theo chieu ngang: dung mot nua la chua du, hon mot diem anh thi du", () => {
    expect(quaNuaTrongKhung(khung(RONG - 160, 80), RONG, CAO)).toBe(false);
    expect(quaNuaTrongKhung(khung(RONG - 161, 80), RONG, CAO)).toBe(true);
    expect(quaNuaTrongKhung(khung(-160, 80), RONG, CAO)).toBe(false);
  });

  it("tinh theo dien tich: hon nua moi chieu ma duoi nua dien tich thi sai", () => {
    // 60% chieu ngang nhan 60% chieu doc chi la 36% dien tich.
    expect(quaNuaTrongKhung(khung(RONG - 192, CAO - 120), RONG, CAO)).toBe(false);
    // 80% nhan 80% la 64% dien tich.
    expect(quaNuaTrongKhung(khung(RONG - 256, CAO - 160), RONG, CAO)).toBe(true);
  });

  it("phan tu lon hon khung nhin: so phan giao voi dien tich cua chinh phan tu", () => {
    expect(quaNuaTrongKhung(khung(0, 0, RONG, CAO * 2), RONG, CAO)).toBe(false);
    expect(quaNuaTrongKhung(khung(0, -10, RONG, CAO + 20), RONG, CAO)).toBe(true);
  });

  it("phan tu khong co kich thuoc (chua ve hay dang an) thi sai", () => {
    expect(quaNuaTrongKhung(khung(100, 80, 0, 200), RONG, CAO)).toBe(false);
    expect(quaNuaTrongKhung(khung(100, 80, 320, 0), RONG, CAO)).toBe(false);
  });
});
