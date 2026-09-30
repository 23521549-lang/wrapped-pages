import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TIN_TOI_DA } from "@/lib/chip";

/*
 * Migration 0020 (Chip biet noi, dot nam 5e) tren du lieu cua 0019: them ba bang rong chip_tin, chip_trang_thai,
 * chip_nghi. Khong bang cu nao doi.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-chip-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const entries = journal.entries.filter((m) => m.idx <= toi);
  for (const m of entries) copyFileSync(path.join(GOC, `${m.tag}.sql`), path.join(dich, `${m.tag}.sql`));
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

const len = (c: PGlite, toi: number) => migrate(drizzle(c), { migrationsFolder: thuMuc(toi) });

async function rangBuoc(p: Promise<unknown>): Promise<string> {
  const e = await p.then(() => null, (x: unknown) => x);
  return (e as { constraint?: string } | null)?.constraint ?? (e === null ? "khong loi" : String(e));
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";

async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into cam_xuc (tu_id, loai, luc) values ('${A1}', 'yeu', '2026-09-30 10:00:00+00');
  `);
}

async function chup(c: PGlite, bang: string): Promise<string[]> {
  return (await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${bang}" t order by 1`)).rows.map((x) => x.r);
}

async function bangCo(c: PGlite): Promise<string[]> {
  return (await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public'")).rows.map((x) => x.t);
}

describe("migration 0020 chip biet noi", () => {
  it("them ba bang rong; moi dong cu giu nguyen", async () => {
    const c = new PGlite();
    await len(c, 19);
    await gieo(c);
    const bangTruoc = await bangCo(c);
    const truoc = new Map<string, string[]>();
    for (const b of bangTruoc) truoc.set(b, await chup(c, b));
    await len(c, 20);
    expect((await bangCo(c)).filter((b) => !bangTruoc.includes(b)).sort()).toEqual(["chip_nghi", "chip_tin", "chip_trang_thai"]);
    for (const b of bangTruoc) expect(await chup(c, b), b).toEqual(truoc.get(b));
  });

  it("CHECK: vai, do dai tin khop TIN_TOI_DA, khoa chip_nghi; xoa tai khoan xoa theo", async () => {
    const c = new PGlite();
    await len(c, 20);
    await gieo(c);
    const tin = (vai: string, chu: string) => c.query(`insert into chip_tin (account_id, vai, noi_dung) values ($1, $2, $3)`, [A1, vai, chu]);
    expect(await rangBuoc(tin("nguoi", "Chào Chíp"))).toBe("khong loi");
    expect(await rangBuoc(tin("chip", "ệ".repeat(TIN_TOI_DA)))).toBe("khong loi");
    expect(await rangBuoc(tin("chip", "ệ".repeat(TIN_TOI_DA + 1)))).toBe("chip_tin_noi_dung");
    expect(await rangBuoc(tin("chip", ""))).toBe("chip_tin_noi_dung");
    expect(await rangBuoc(tin("ai", "x"))).toBe("chip_tin_vai");
    expect(await rangBuoc(c.exec(`insert into chip_nghi (khoa, den) values ('khac', now())`))).toBe("chip_nghi_khoa");
    expect(await rangBuoc(c.exec(`insert into chip_trang_thai (account_id) values ('${A1}')`))).toBe("khong loi");
    expect(await chup(c, "chip_trang_thai")).toEqual([`{"an": false, "tu_noi": true, "account_id": "${A1}", "thay_ngu_luc": null, "lan_cuoi_thay": null}`]);
    await c.exec(`delete from accounts where id = '${A1}'`);
    expect(await chup(c, "chip_tin")).toEqual([]);
    expect(await chup(c, "chip_trang_thai")).toEqual([]);
  });
});
