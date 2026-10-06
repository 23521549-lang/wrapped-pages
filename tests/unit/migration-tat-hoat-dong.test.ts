import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration 0021 (an hoat dong) tren du lieu cua 0020: them accounts.hoat_dong_an va activity.an, ca hai boolean NOT NULL
 * mac dinh false. Moi dong cu phai giu nguyen va phai nhan dung gia tri mac dinh: day la ca nen cua ngu nghia "bat tat
 * khong sua lai qua khu", nen neu mot ngay nao do migration bi viet lai thanh backfill true thi bai nay phai do.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-an-hd-"));
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
    insert into activity (kind, actor_id, subject_id, shared, at) values
      ('doi-mat-khau', '${A1}', '${A2}', false, '2026-10-01 08:00:00+00');
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

describe("migration 0021 an hoat dong", () => {
  it("truoc 0021 chua co hai cot; sau 0021 ca hai co mat", async () => {
    const c = new PGlite();
    await len(c, 20);
    expect(await cot(c, "accounts")).not.toContain("hoat_dong_an");
    expect(await cot(c, "activity")).not.toContain("an");
    await len(c, 21);
    expect(await cot(c, "accounts")).toContain("hoat_dong_an");
    expect(await cot(c, "activity")).toContain("an");
  });

  it("dong cu nhan mac dinh false: khong tai khoan nao bi bat an, khong dong nao bi an oan", async () => {
    const c = new PGlite();
    await len(c, 20);
    await gieo(c);
    await len(c, 21);
    const tk = await c.query<{ an: boolean }>("select hoat_dong_an as an from accounts order by seat");
    expect(tk.rows.map((r) => r.an)).toEqual([false, false]);
    const hd = await c.query<{ an: boolean }>("select an from activity");
    expect(hd.rows.map((r) => r.an)).toEqual([false]);
  });

  it("hai cot la NOT NULL", async () => {
    const c = new PGlite();
    await len(c, 21);
    await gieo(c);
    expect(await loi(c.exec("update accounts set hoat_dong_an = null"))).toMatch(/not.?null/i);
    expect(await loi(c.exec("update activity set an = null"))).toMatch(/not.?null/i);
  });

  it("migration chi them cot, khong doi mot dong du lieu nao cua activity", async () => {
    const c = new PGlite();
    await len(c, 20);
    await gieo(c);
    const truoc = (await c.query<{ r: string }>("select to_jsonb(t)::text as r from activity t order by 1")).rows.map((x) => x.r);
    await len(c, 21);
    // So lai sau khi bo cot moi ra khoi ban chup: moi truong con lai phai y nguyen.
    const sau = (await c.query<{ r: string }>("select (to_jsonb(t) - 'an')::text as r from activity t order by 1")).rows.map((x) => x.r);
    expect(sau).toEqual(truoc);
  });
});
