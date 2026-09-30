import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration 0017 (thu thang, dot nam 5b) tren du lieu cua 0016: them bang thu_thang, viet lai ba CHECK cua activity va
 * them activity_thu cho loai gui-thu. Khong dong cu nao doi, moi loai cu van ghi duoc nhu truoc.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-thu-thang-"));
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
const B1 = "b1111111-1111-4111-8111-111111111111";
const R1 = "a1111111-1111-4111-8111-111111111111";
const M1 = "d1111111-1111-4111-8111-111111111111";

/** Du lieu cua 0016: mot cuon, mot luot, mot tam trang, bon dong Hoat dong du loai, mot dong da xem, mot trang doc do. */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode) values ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se');
    insert into rounds (id, book_id, published_at) values ('${R1}', '${B1}', '2026-09-01 08:00:00+00');
    insert into moods (id, account_id, weather, set_at, ends_at) values ('${M1}', '${A2}', 'nang-am', '2026-09-03 01:00:00+00', '2026-09-03 02:00:00+00');
    insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('dang-trang', '${A1}', '${B1}', '${R1}', true, '2026-09-01 08:00:00+00');
    insert into activity (kind, actor_id, book_id, detail, shared, at) values ('doi-ten-sach', '${A1}', '${B1}', '{"truoc": "A", "sau": "B"}', true, '2026-09-02 08:00:00+00');
    insert into activity (kind, actor_id, mood_id, shared, at) values ('tha-tam-trang', '${A2}', '${M1}', true, '2026-09-03 01:00:00+00');
    insert into activity (kind, actor_id, subject_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', false, '2026-09-03 00:00:00+00');
    insert into activity_seen (account_id, activity_id, seen_at) select '${A2}', id, at from activity where kind = 'dang-trang';
    insert into reading_positions (account_id, book_id, position) values ('${A2}', '${B1}', 1);
  `);
}

async function chup(c: PGlite, bang: string): Promise<string[]> {
  return (await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${bang}" t order by 1`)).rows.map((x) => x.r);
}

async function bangCo(c: PGlite): Promise<string[]> {
  return (await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public'")).rows.map((x) => x.t);
}

describe("migration 0017 thu thang", () => {
  it("them mot bang rong; moi dong cu cua moi bang giu nguyen", async () => {
    const c = new PGlite();
    await len(c, 16);
    await gieo(c);
    const bangTruoc = await bangCo(c);
    const truoc = new Map<string, string[]>();
    for (const b of bangTruoc) truoc.set(b, await chup(c, b));
    await len(c, 17);
    const bangSau = await bangCo(c);
    expect(bangSau.filter((b) => !bangTruoc.includes(b))).toEqual(["thu_thang"]);
    for (const b of bangTruoc) expect(await chup(c, b), b).toEqual(truoc.get(b));
    expect(await chup(c, "thu_thang")).toEqual([]);
  });

  it("sau 0017: gui-thu ghi duoc voi dung hinh dang, sai hinh dang bi CHECK chan; loai cu van ghi nhu truoc", async () => {
    const c = new PGlite();
    await len(c, 16);
    await gieo(c);
    await len(c, 17);
    await c.exec(`insert into thu_thang (account_id, thang, noi_dung, gui_luc) values ('${A1}', '2026-09', 'Thư', '2026-10-01 01:00:00+00')`);
    expect(await rangBuoc(c.exec(`insert into thu_thang (account_id, thang, noi_dung) values ('${A1}', '2026-09', 'Lá hai')`))).toBe("thu_thang_moi_thang");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, detail, shared, at) values ('gui-thu', '${A1}', '{"thang": "2026-09"}', true, now())`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, shared, at) values ('gui-thu', '${A1}', true, now())`))).toBe("activity_detail");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, book_id, detail, shared, at) values ('gui-thu', '${A1}', '${B1}', '{"thang": "2026-09"}', true, now())`))).toBe("activity_thu");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, detail, shared, at) values ('gui-thu', '${A1}', '{"thang": "2026-09"}', false, now())`))).toBe("activity_thu");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('dang-trang', '${A1}', '${B1}', '${R1}', true, now())`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, shared, at) values ('dang-trang', '${A1}', true, now())`))).toBe("activity_sach");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, book_id, detail, shared, at) values ('doi-bia', '${A1}', '${B1}', '{"truoc": null, "sau": null}', true, now())`))).toBe("khong loi");
  });
});
