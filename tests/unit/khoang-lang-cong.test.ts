import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const SCRIPT = resolve(process.cwd(), "scripts/kiem-khoang-lang.mjs");

const LACH = `import { camXuc } from "@/server/db/schema";
export async function doc(db: any) {
  return db.select().from(camXuc);
}
`;

const DUNG = `import { locTheoTacGia } from "@/server/khoang-lang/loc";
import { camXuc } from "@/server/db/schema";
export async function doc(db: any, khoangLang: boolean) {
  const rows = await db.select().from(camXuc);
  return locTheoTacGia(khoangLang, rows, (r) => r.tacGiaId);
}
`;

function dungTam(nguon: Record<string, string>, ngoaiLe: unknown) {
  const root = mkdtempSync(join(tmpdir(), "kiem-khoang-lang-"));
  for (const [duong, noiDung] of Object.entries(nguon)) {
    const file = join(root, duong);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, noiDung);
  }
  const fileNgoaiLe = join(root, "ngoai-le.json");
  writeFileSync(fileNgoaiLe, JSON.stringify(ngoaiLe));
  return { root, fileNgoaiLe };
}

function chay(root: string, ngoaiLe: string) {
  return spawnSync("node", [SCRIPT, "--root", root, "--ngoai-le", ngoaiLe], {
    encoding: "utf8",
  });
}

describe("cong kiem khoang lang", () => {
  test("file doc thang bang cam_xuc ma khong qua helper thi fail, in dung ten file", () => {
    const { root, fileNgoaiLe } = dungTam(
      { "src/server/lach.ts": LACH },
      { ngoaiLe: [] },
    );
    try {
      const kq = chay(root, fileNgoaiLe);
      expect(kq.status).not.toBe(0);
      expect(kq.stdout + kq.stderr).toContain("lach.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("file doc qua helper thi pass", () => {
    const { root, fileNgoaiLe } = dungTam(
      { "src/server/dung.ts": DUNG },
      { ngoaiLe: [] },
    );
    try {
      const kq = chay(root, fileNgoaiLe);
      expect(kq.status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("file trong ngoai le thi pass", () => {
    const { root, fileNgoaiLe } = dungTam(
      { "src/server/lach.ts": LACH },
      {
        ngoaiLe: [
          {
            file: "src/server/lach.ts",
            lyDo: "fixture",
            nguoiDuyet: "Thuận",
          },
        ],
      },
    );
    try {
      const kq = chay(root, fileNgoaiLe);
      expect(kq.status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ngoai le thieu truong thi fail", () => {
    const { root, fileNgoaiLe } = dungTam(
      { "src/server/dung.ts": DUNG },
      { ngoaiLe: [{ file: "src/server/dung.ts", lyDo: "thieu nguoiDuyet" }] },
    );
    try {
      const kq = chay(root, fileNgoaiLe);
      expect(kq.status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("chay tren chinh repo phai pass", () => {
    const root = process.cwd();
    const fileNgoaiLe = join(root, "scripts/khoang-lang-ngoai-le.json");
    expect(existsSync(SCRIPT)).toBe(true);
    expect(existsSync(fileNgoaiLe)).toBe(true);
    const kq = chay(root, fileNgoaiLe);
    expect(kq.status).toBe(0);
  });
});
