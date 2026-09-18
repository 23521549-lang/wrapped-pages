import { describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as schema from "@/server/db/schema";
import { saoLuuRaTep, type KetNoi } from "@/server/backup/sao-luu";

// Gia lap dia tra ve noi dung hong khi doc lai tep vua ghi (vd o dia loi): chi readFile bi thay.
vi.mock("node:fs/promises", async (goc) => {
  const that = await goc<typeof import("node:fs/promises")>();
  return { ...that, readFile: vi.fn(async () => "{") };
});

function tuPglite(c: PGlite): KetNoi {
  const boc = (x: Pick<PGlite, "query">): KetNoi => ({
    truyVan: async (cau, ts) => (await x.query(cau, ts)).rows as Record<string, unknown>[],
    giaoDich: (fn) => c.transaction((tx) => fn(boc(tx))),
  });
  return boc(c);
}

describe("saoLuuRaTep", () => {
  it("doc lai tep vua ghi khong khop thi xoa tep, khong de lai tep nhin nhu ban sao luu du", async () => {
    const c = new PGlite();
    await migrate(drizzle(c, { schema }), { migrationsFolder: "drizzle" });
    const thuMuc = await mkdtemp(path.join(tmpdir(), "mqce-sl-"));
    try {
      await expect(saoLuuRaTep(tuPglite(c), thuMuc)).rejects.toThrow(/không phải JSON/);
      expect(await readdir(thuMuc)).toEqual([]);
    } finally {
      await rm(thuMuc, { recursive: true, force: true });
      await c.close();
    }
  }, 60000);
});
