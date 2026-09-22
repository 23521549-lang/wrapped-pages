import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";

const APP = "src/app";

/** Moi page.tsx trong src/app, duong dan dung dau "/" de doc duoc tren moi he dieu hanh. */
function pages(): string[] {
  return (readdirSync(APP, { recursive: true }) as string[])
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => p === "page.tsx" || p.endsWith("/page.tsx"))
    .map((p) => `${APP}/${p}`);
}

/** Moi route.ts trong src/app (Route Handler), duong dan dung dau "/". */
function routes(): string[] {
  return (readdirSync(APP, { recursive: true }) as string[])
    .map((p) => p.split(sep).join("/"))
    .filter((p) => p === "route.ts" || p.endsWith("/route.ts"))
    .map((p) => `${APP}/${p}`);
}

const PHUONG_THUC = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/** Than moi ham xu ly export cua tep mo dau bang await connection(); (truoc no chi co khoang trang). */
function handlerMoDauDung(src: string): boolean {
  return PHUONG_THUC.every((ten) => {
    const dau = src.indexOf(`export async function ${ten}(`);
    if (dau < 0) return true;
    const than = src.indexOf("{", src.indexOf(")", dau));
    return than >= 0 && src.slice(than + 1).trimStart().startsWith("await connection();");
  });
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

  it("moi route.ts cham du lieu mo dau moi ham xu ly bang await connection(), nen next build khong chay chung", () => {
    const tep = routes().filter((f) => CHAM_DU_LIEU.test(readFileSync(f, "utf8")));
    expect(tep.length).toBeGreaterThanOrEqual(2);
    expect(tep.filter((f) => !handlerMoDauDung(readFileSync(f, "utf8")))).toEqual([]);
  });
});
