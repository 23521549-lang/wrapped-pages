import { describe, it, expect } from "vitest";
import { derivePassword, PASSWORD_SHAPE } from "@/server/identity/password";

const KEY = "khoa-may-chu-dung-cho-test";

describe("derivePassword", () => {
  it("dung dinh dang tu-tu-tu-hai-so", () => {
    const p = derivePassword("Linh", "lan dau minh gap nhau o ben xe", KEY);
    expect(p).toMatch(PASSWORD_SHAPE);
  });

  it("moi mat khau sinh ra deu dung dinh dang va nam trong khoang 11 toi 23 ky tu", () => {
    let min = Infinity, max = 0;
    for (let i = 0; i < 500; i++) {
      const p = derivePassword(`nguoi ${i}`, `loi nhan so ${i}`, KEY, i % 7);
      expect(p, `sai dinh dang o vong ${i}: ${p}`).toMatch(PASSWORD_SHAPE);
      min = Math.min(min, p.length);
      max = Math.max(max, p.length);
    }
    expect(min).toBeGreaterThanOrEqual(11);
    expect(max).toBeLessThanOrEqual(23);
  });

  it("cung dau vao thi luon cho cung ket qua", () => {
    const a = derivePassword("Linh", "ben xe", KEY);
    const b = derivePassword("Linh", "ben xe", KEY);
    expect(a).toBe(b);
  });

  it("khac hoa thuong va khac dau cach van cho cung ket qua", () => {
    const a = derivePassword("Linh", "Bến   Xe", KEY);
    const b = derivePassword("linh", "ben xe", KEY);
    expect(a).toBe(b);
  });

  it("doi biet danh thi doi mat khau", () => {
    const a = derivePassword("Linh", "ben xe", KEY);
    const b = derivePassword("Linh Nhi", "ben xe", KEY);
    expect(a).not.toBe(b);
  });

  it("doi loi nhan thi doi mat khau", () => {
    const a = derivePassword("Linh", "ben xe", KEY);
    const b = derivePassword("Linh", "quan ca phe cu", KEY);
    expect(a).not.toBe(b);
  });

  it("doi khoa may chu thi doi mat khau", () => {
    const a = derivePassword("Linh", "ben xe", KEY);
    const b = derivePassword("Linh", "ben xe", "khoa-khac");
    expect(a).not.toBe(b);
  });

  it("counter khac nhau cho ket qua khac nhau, de con sinh lai khi trung", () => {
    const a = derivePassword("Linh", "ben xe", KEY, 0);
    const b = derivePassword("Linh", "ben xe", KEY, 1);
    expect(a).not.toBe(b);
  });

  it("hai chu so cuoi phan bo deu, khong thien vi nua dau", () => {
    let thap = 0, cao = 0;
    for (let i = 0; i < 4000; i++) {
      const n = Number(derivePassword(`a${i}`, `b${i}`, KEY).slice(-2));
      if (n < 50) thap++; else cao++;
    }
    const lech = Math.abs(thap - cao) / 4000;
    expect(lech, `lech ${(lech * 100).toFixed(2)}% giua nua duoi va nua tren`).toBeLessThan(0.05);
  });
});
