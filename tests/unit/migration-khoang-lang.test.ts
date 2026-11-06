import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration 0022 (Khoang Lang) tren du lieu cua 0021: them accounts.khoang_lang, boolean NOT NULL mac dinh false.
 * Moi dong cu phai giu nguyen va phai nhan dung gia tri mac dinh: bat tat khong sua lai qua khu, nen neu mot ngay nao
 * do migration bi viet lai thanh backfill true thi bai nay phai do.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-khoang-lang-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const entries = journal.entries.filter((m) => m.idx <= toi);
  for (const m of entries) copyFileSync(path.join(GOC, `${m.tag}.sql`), path.join(dich, `${m.tag}.sql`));
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

const len = (c: PGlite, toi: number) => migrate(drizzle(c), { migrationsFolder: thuMuc(toi) });

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";

async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
  `);
}

/** Ten cac cot cua mot bang, de khang dinh cot co mat hay chua co mat. */
async function cot(c: PGlite, bang: string): Promise<string[]> {
  const r = await c.query<{ n: string }>(
    "select column_name as n from information_schema.columns where table_name = $1 order by column_name",
    [bang],
  );
  return r.rows.map((x) => x.n);
}

/** Loi cua mot cau lenh, hay "khong loi" khi no chay duoc. */
async function loi(p: Promise<unknown>): Promise<string> {
  return p.then(() => "khong loi", (e: unknown) => String(e));
}

describe("migration 0022 Khoang Lang", () => {
  it("truoc 0022 chua co cot; sau 0022 cot co mat", async () => {
    const c = new PGlite();
    await len(c, 21);
    expect(await cot(c, "accounts")).not.toContain("khoang_lang");
    await len(c, 22);
    expect(await cot(c, "accounts")).toContain("khoang_lang");
  });

  it("dong cu nhan mac dinh false: khong tai khoan nao bi bat Khoang Lang oan", async () => {
    const c = new PGlite();
    await len(c, 21);
    await gieo(c);
    await len(c, 22);
    const tk = await c.query<{ an: boolean }>("select khoang_lang as an from accounts order by seat");
    expect(tk.rows.map((r) => r.an)).toEqual([false, false]);
  });

  it("cot la NOT NULL", async () => {
    const c = new PGlite();
    await len(c, 22);
    await gieo(c);
    expect(await loi(c.exec("update accounts set khoang_lang = null"))).toMatch(/not.?null/i);
  });

  it("migration chi them cot, khong doi mot dong du lieu nao cua accounts", async () => {
    const c = new PGlite();
    await len(c, 21);
    await gieo(c);
    const truoc = (await c.query<{ r: string }>("select to_jsonb(t)::text as r from accounts t order by 1")).rows.map((x) => x.r);
    await len(c, 22);
    // So lai sau khi bo cot moi ra khoi ban chup: moi truong con lai phai y nguyen.
    const sau = (await c.query<{ r: string }>("select (to_jsonb(t) - 'khoang_lang')::text as r from accounts t order by 1")).rows.map((x) => x.r);
    expect(sau).toEqual(truoc);
  });
});
