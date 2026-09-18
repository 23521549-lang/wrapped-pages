import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/server/identity/crypto";

const KEY = "khoa-may-chu-dung-cho-test";

describe("ma hoa loi nhan", () => {
  it("ma hoa roi giai ra dung chuoi ban dau", () => {
    const plain = "Lần đầu mình gặp nhau ở bến xe, em đợi bốn mươi phút.";
    expect(decryptSecret(encryptSecret(plain, KEY), KEY)).toBe(plain);
  });

  it("hai lan ma hoa cung mot chuoi cho ra hai ban ma khac nhau", () => {
    const a = encryptSecret("ben xe", KEY);
    const b = encryptSecret("ben xe", KEY);
    expect(a).not.toBe(b);
  });

  it("giai bang khoa sai thi nem loi, khong tra ve rac", () => {
    const c = encryptSecret("ben xe", KEY);
    expect(() => decryptSecret(c, "khoa-sai")).toThrow();
  });

  it("sua bat ky doan nao trong ban ma cung nem loi", () => {
    const c = encryptSecret("ben xe", KEY);
    const parts = c.split(".");
    for (let i = 0; i < 3; i++) {
      const hong = [...parts];
      // Sua tren byte da giai ma, khong sua tren ky tu base64url: mot doan 16-byte
      // (vi du tag GCM) ma hoa ra 22 ky tu, ky tu cuoi chi mang 2 bit that, 4 bit con
      // lai la bit dem bi bo qua khi giai ma - nen sua ky tu cuoi doi khi la no-op
      // (vi du "aQ" -> "aa" cho ra dung byte cu). Dao bit tren byte that luon doi gia tri.
      const bytes = Buffer.from(hong[i], "base64url");
      bytes[0] ^= 1;
      hong[i] = bytes.toString("base64url");
      expect(() => decryptSecret(hong.join("."), KEY), `doan ${i} bi sua ma van giai duoc`).toThrow();
    }
  });

  it("giai duoc ca chuoi rong do chinh no ma hoa ra", () => {
    expect(decryptSecret(encryptSecret("", KEY), KEY)).toBe("");
  });

  it("chuoi khong du ba doan thi nem loi", () => {
    expect(() => decryptSecret("chi-mot-doan", KEY)).toThrow();
    expect(() => decryptSecret("hai.doan", KEY)).toThrow();
  });
});
