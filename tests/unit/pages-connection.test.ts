import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const APP = "src/app";

/** Moi page.tsx trong src/app, duong dan dung dau "/" de doc duoc tren moi he dieu hanh. */
function pages(): string[] {
  return (readdirSync(APP, { recursive: true }) as string[])
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => p === "page.tsx" || p.endsWith("/page.tsx"))
    .map((p) => `${APP}/${p}`);
}

/**
 * Trang cham du lieu: co it nhat mot import KHONG phai `import type` tu bat ky module may chu
 * nao cua du an (@/server/...) hoac tu next/headers.
 */
const CHAM_DU_LIEU = /^import\s+(?!type\b)[^;]*from\s+["'](?:@\/server\/[^"']+|next\/headers)["']/m;

/**
 * `await connection();` phai la CAU LENH DAU TIEN trong than ham export default.
 * Truoc no chi duoc co khoang trang va chu thich.
 */
const MO_DAU_DUNG =
  /export\s+default\s+async\s+function\s*\w*\s*\([^)]*\)\s*(?::[^{]+)?\{(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*await\s+connection\(\s*\);/;

describe("trang cham database hoac phien phai cho request truoc", () => {
  it("co it nhat mot trang cham du lieu de kiem, test khong duoc rong", () => {
    const n = pages().filter((f) => CHAM_DU_LIEU.test(readFileSync(f, "utf8"))).length;
    expect(n).toBeGreaterThan(0);
  });

  it("moi trang nhu vay mo dau ham export default bang await connection()", () => {
    const sai = pages().filter((f) => {
      const src = readFileSync(f, "utf8");
      return CHAM_DU_LIEU.test(src) && !MO_DAU_DUNG.test(src);
    });
    expect(sai, `trang thieu hoac dat sai cho await connection(): ${sai.join(", ")}`).toEqual([]);
  });
});
