import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/*
 * Ranh gioi mo dun cua ca src/lib: moi thu o day la ham thuan, kiem duoc khong can trinh duyet,
 * may chu hay database. paginate la ranh gioi quan trong nhat, nhung csp.ts, mau/, feed/ va cac mo
 * dun con lai cung tu nhan minh thuan trong chu thich cua chung; mot bai kiem duyet de quy giu ca thu muc, ke ca
 * tep them sau nay.
 *
 * Cam: react (va react-dom), next, drizzle-orm, moi duong "@/..." ngoai "@/lib/..." (@/server, @/app,
 * @/components, ...), va moi duong tuong doi di ra khoi src/lib (vd "../../server/db"), vi cach do lach
 * duoc ca hai luat tren. Doc moi dang nap: `from "x"`, `import "x"`, `import("x")`, `require("x")`.
 */

const GOC = "src/lib";
const NAP = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const GOI_CAM = /^(?:react|react-dom|next|drizzle-orm)(?:\/|$)/;

/** Ly do mot duong nap pha ranh gioi, hoac null neu hop le. */
function viPham(tep: string, duong: string): string | null {
  if (GOI_CAM.test(duong)) return `goi ${duong}`;
  if (duong.startsWith("@/")) return duong.startsWith("@/lib/") ? null : `ngoai src/lib: ${duong}`;
  if (duong.startsWith(".")) {
    const toi = path.posix.normalize(path.posix.join(path.posix.dirname(tep), duong));
    return toi === GOC || toi.startsWith(`${GOC}/`) ? null : `duong tuong doi ra khoi src/lib: ${duong}`;
  }
  return null;
}

function moiTep(): string[] {
  return readdirSync(GOC, { recursive: true, encoding: "utf8" })
    .map((f) => `${GOC}/${f.split(path.sep).join("/")}`)
    .filter((f) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(f));
}

describe("ranh gioi src/lib", () => {
  it("bo doc nap nhan ra dung cac dang can cam, va de yen cac dang hop le", () => {
    const tep = `${GOC}/feed/line.ts`;
    const doc = (ma: string) => [...ma.matchAll(NAP)].map((m) => m[1]);
    expect(doc(`import { a } from "react";\nimport type { B } from 'next/server';\nimport "drizzle-orm";\nconst x = import("@/server/db");\nrequire("../../app/x");`))
      .toEqual(["react", "next/server", "drizzle-orm", "@/server/db", "../../app/x"]);
    expect(viPham(tep, "react")).not.toBeNull();
    expect(viPham(tep, "react-dom/client")).not.toBeNull();
    expect(viPham(tep, "next/server")).not.toBeNull();
    expect(viPham(tep, "drizzle-orm/pg-core")).not.toBeNull();
    expect(viPham(tep, "@/server/db")).not.toBeNull();
    expect(viPham(tep, "@/app/layout")).not.toBeNull();
    expect(viPham(tep, "@/components/music/youtubeApi")).not.toBeNull();
    expect(viPham(tep, "../../server/db")).not.toBeNull();
    expect(viPham(tep, "./types")).toBeNull();
    expect(viPham(tep, "../doc/types")).toBeNull();
    expect(viPham(tep, "@/lib/uuid")).toBeNull();
    expect(viPham(tep, "node:crypto")).toBeNull();
    expect(viPham(tep, "nextjs-khac-han")).toBeNull();
  });

  it("khong tep nao trong src/lib (de quy) nap react, next, drizzle-orm, hay bat ky thu gi ngoai src/lib cua du an", () => {
    const tep = moiTep();
    // Tu kiem bo duyet: phai thay ca tep o thu muc con (paginate, feed, mau), khong chi tang dau.
    expect(tep).toContain(`${GOC}/paginate/index.ts`);
    expect(tep).toContain(`${GOC}/feed/line.ts`);
    expect(tep).toContain(`${GOC}/mau/oklch.ts`);
    expect(tep).toContain(`${GOC}/csp.ts`);

    const loi: string[] = [];
    for (const f of tep) {
      for (const m of readFileSync(f, "utf8").matchAll(NAP)) {
        const ly = viPham(f, m[1]);
        if (ly !== null) loi.push(`${f}: ${ly}`);
      }
    }
    expect(loi).toEqual([]);
  });
});
