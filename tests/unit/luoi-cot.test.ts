import { describe, expect, it } from "vitest";
import { soCot, soCuonCuaTang } from "@/lib/luoi-cot";

/*
 * Ke sach thu gon con ba tang, ma "mot tang" la mot hang cua luoi, ma so cot cua luoi lai do trinh duyet quyet dinh
 * (repeat auto-fill theo be rong VA theo co chu nguoi dung dat). Vi vay so cot phai DOC tu tri da tinh, va tep nay
 * kiem dung phep doc do.
 */
describe("soCot", () => {
  it("dem dung so cot tu tri da tinh", () => {
    expect(soCot("200px")).toBe(1);
    expect(soCot("164px 164px")).toBe(2);
    expect(soCot("200px 200px 200px")).toBe(3);
    expect(soCot("236.5px 236.5px 236.5px 236.5px")).toBe(4);
  });

  it("khoang trang thua khong lam lech phep dem", () => {
    expect(soCot("  200px   200px  ")).toBe(2);
    expect(soCot("200px\n200px\n200px")).toBe(3);
  });

  it("chuoi rong hay none tra ve mot cot: gia tri an toan nhat", () => {
    expect(soCot("")).toBe(1);
    expect(soCot("   ")).toBe(1);
    expect(soCot("none")).toBe(1);
  });

  it("luoi chua duoc ve tra ve gia tri khai bao chu khong phai do rong: coi nhu mot cot, khong dem khoang trang", () => {
    // Dem khoang trang trong chuoi nay ra ba "cot" o mot luoi hai cot.
    expect(soCot("repeat(2, minmax(0px, 1fr))")).toBe(1);
    expect(soCot("repeat(auto-fill, minmax(min(200px, 44%), 1fr))")).toBe(1);
  });

  it("ten duong ke trong ngoac vuong khong phai la cot", () => {
    expect(soCot("[dau] 200px 200px [cuoi]")).toBe(2);
  });
});

describe("soCuonCuaTang", () => {
  it("ba tang tren luoi 1, 2, 3, 4 cot", () => {
    expect([1, 2, 3, 4].map((c) => soCuonCuaTang(c, 3))).toEqual([3, 6, 9, 12]);
  });

  it("so cot khong hop le van cho it nhat mot cot", () => {
    expect(soCuonCuaTang(0, 3)).toBe(3);
    expect(soCuonCuaTang(-2, 3)).toBe(3);
  });
});
