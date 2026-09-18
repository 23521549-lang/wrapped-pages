import { describe, it, expect } from "vitest";
import { e2eUrlsTuNoiDung } from "../e2e/env";

const DONG = (url: string) => `DATABASE_URL=${url}\n`;

describe("e2eUrlsTuNoiDung: chuoi ket noi cua e2e suy tu .env.local", () => {
  it("doi ten database thanh mqce_e2e, giu nguyen phan con lai", () => {
    const { appUrl, e2eUrl } = e2eUrlsTuNoiDung(DONG("postgresql://u:p@may.vi-du/neondb?sslmode=require"));
    expect(new URL(appUrl).pathname).toBe("/neondb");
    expect(e2eUrl).toBe("postgresql://u:p@may.vi-du/mqce_e2e?sslmode=require");
  });

  it("dung han khi .env.local da tro vao chinh database kiem thu, va khong in chuoi ket noi", () => {
    const raw = DONG("postgresql://u:bi-mat@may.vi-du/mqce_e2e?sslmode=require");
    expect(() => e2eUrlsTuNoiDung(raw)).toThrow(/dang tro vao database kiem thu mqce_e2e/);
    expect(() => e2eUrlsTuNoiDung(raw)).not.toThrow(/bi-mat/);
  });

  it("thieu hoac hong DATABASE_URL thi bao loi co dinh", () => {
    expect(() => e2eUrlsTuNoiDung("")).toThrow("e2e can DATABASE_URL hop le trong .env.local");
    expect(() => e2eUrlsTuNoiDung(DONG("khong-phai-url"))).toThrow("e2e can DATABASE_URL hop le trong .env.local");
  });
});
