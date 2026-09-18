import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Khoang trong danh cho icon loi (.field__dau) thuoc ve khung .field__o dang
 * giu icon do, khong phai moi o .input. O .input mac dinh can doi hai ben; rieng o nam trong .field__o moi
 * them padding-right 2.6rem danh cho icon.
 */
describe("khoang trong icon loi chi thuoc khung co icon", () => {
  const css = readFileSync("src/styles/app.css", "utf8");

  it(".input mac dinh can doi .65rem .9rem, khong con 2.6rem", () => {
    const dau = css.indexOf("\n.input{");
    expect(dau, "khong tim thay rule .input{...}").toBeGreaterThan(-1);
    const cuoi = css.indexOf("}", dau);
    const rule = css.slice(dau, cuoi + 1);
    expect(rule).toContain("padding: .65rem .9rem;");
    expect(rule).not.toContain("2.6rem");
  });

  it(".field__o .input danh rieng padding-right 2.6rem cho icon", () => {
    expect(css).toContain(".field__o .input{ padding-right: 2.6rem; }");
  });
});
