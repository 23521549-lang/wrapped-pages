import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration 0016 (Hoat dong moi) tren du lieu cua 0015: dung thu muc migration tam toi idx cho truoc, chay qua dung
 * migrator cua drizzle. 0016 them hai cot cho activity, hai bang moi, viet lai ba CHECK va danh dau moi dong Hoat dong
 * cu la DA XEM voi ca hai nguoi: len ban moi khong co dong cu nao boi dau Moi.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-hoat-dong-moi-"));
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
const S1 = "c1111111-1111-4111-8111-111111111111";
const M1 = "d1111111-1111-4111-8111-111111111111";
const DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "To" }] }] });

/** Du lieu cua 0015: mot cuon chia se mot luot co cau do, bon dong Hoat dong cu, mot tam trang. */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode) values ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se');
    insert into rounds (id, book_id, published_at) values ('${R1}', '${B1}', '2026-09-01 08:00:00+00');
    insert into pages (book_id, round_id, position, content, published_at) values ('${B1}', '${R1}', 1, '${DOC}', '2026-09-01 08:00:00+00');
    insert into seals (id, book_id, round_id, kind, question, answers, teaser) values ('${S1}', '${B1}', '${R1}', 'cau-do', 'O dau?', '["ben xe"]', '');
    insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values
      ('dang-trang', '${A1}', '${B1}', '${S1}', '${R1}', true, '2026-09-01 08:00:00+00'),
      ('thu-sai', '${A2}', '${B1}', '${S1}', '${R1}', true, '2026-09-02 09:00:00+00'),
      ('hoi-dap', '${A2}', '${B1}', null, '${R1}', true, '2026-09-02 10:00:00+00');
    insert into activity (kind, actor_id, subject_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', false, '2026-09-03 00:00:00+00');
    insert into moods (id, account_id, weather, set_at, ends_at) values ('${M1}', '${A2}', 'nang-am', '2026-09-03 01:00:00+00', '2026-09-03 02:00:00+00');
  `);
}

async function chup(c: PGlite, bang: string): Promise<string[]> {
  return (await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${bang}" t order by 1`)).rows.map((x) => x.r);
}

async function bangCo(c: PGlite): Promise<string[]> {
  return (await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public'")).rows.map((x) => x.t);
}

describe("migration 0016 hoat dong moi", () => {
  it("them hai bang; moi dong cu cua moi bang khac activity giu nguyen; activity chi them hai cot rong", async () => {
    const c = new PGlite();
    await len(c, 15);
    await gieo(c);
    const bangTruoc = await bangCo(c);
    const truoc = Object.fromEntries(await Promise.all(bangTruoc.map(async (b) => [b, await chup(c, b)] as const)));
    await len(c, 16);
    expect((await bangCo(c)).sort()).toEqual([...bangTruoc, "activity_seen", "reading_positions"].sort());
    for (const b of bangTruoc.filter((x) => x !== "activity")) expect(await chup(c, b), b).toEqual(truoc[b]);
    const cot = await c.query<{ n: number }>("select count(*)::int as n from activity where mood_id is null and detail is null");
    expect(cot.rows[0].n).toBe(4);
  });

  it("moi dong Hoat dong cu la da xem voi ca hai nguoi, seen_at bang dung at cua dong", async () => {
    const c = new PGlite();
    await len(c, 15);
    await gieo(c);
    await len(c, 16);
    const r = await c.query<{ n: number; lech: number }>(`
      select count(*)::int as n, count(*) filter (where s.seen_at <> a.at)::int as lech
      from activity_seen s join activity a on a.id = s.activity_id`);
    expect(r.rows[0]).toEqual({ n: 8, lech: 0 });
  });

  it("dong gom thu sai da xem toi lan thu moi nhat cua nhom; dong ghi san cho mai sau van thanh Moi khi toi gio", async () => {
    const c = new PGlite();
    await len(c, 15);
    await gieo(c);
    // Them mot lan thu sai cung nhom, cung ngay Viet Nam (dong gom mang id cua lan dau, gio cua lan moi nhat), va mot
    // dong mo-hen-gio ghi san cho mot luc con xa.
    await c.exec(`
      insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values
        ('thu-sai', '${A2}', '${B1}', '${S1}', '${R1}', true, '2026-09-02 09:30:00+00'),
        ('mo-hen-gio', '${A1}', '${B1}', '${S1}', '${R1}', true, '2099-01-01 00:00:00+00');
    `);
    await len(c, 16);
    const r = await c.query<{ kind: string; at: string; seen: string }>(`
      select a.kind, a.at::text as at, s.seen_at::text as seen from activity_seen s join activity a on a.id = s.activity_id
      where s.account_id = '${A1}' and a.kind in ('thu-sai', 'mo-hen-gio') order by a.at`);
    const [dau, sau, henGio] = r.rows;
    expect([dau.kind, dau.seen, sau.seen]).toEqual(["thu-sai", sau.at, sau.at]);
    expect(henGio.kind).toBe("mo-hen-gio");
    expect(new Date(henGio.seen).getTime()).toBeLessThan(new Date(henGio.at).getTime());
    expect(new Date(henGio.seen).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("sau 0016: loai moi ghi duoc dung hinh; loai cu gan niem phong van nhu truoc", async () => {
    const c = new PGlite();
    await len(c, 15);
    await gieo(c);
    await len(c, 16);
    const ghi = (sqlText: string) => rangBuoc(c.query(sqlText));
    expect(await ghi(`insert into activity (kind, actor_id, mood_id, shared, at) values ('tha-tam-trang', '${A2}', '${M1}', true, now())`)).toBe("khong loi");
    expect(await ghi(`insert into activity (kind, actor_id, book_id, shared, at) values ('tao-sach', '${A1}', '${B1}', true, now())`)).toBe("khong loi");
    expect(await ghi(`insert into activity (kind, actor_id, book_id, round_id, detail, shared, at) values ('da-doc', '${A2}', '${B1}', '${R1}', '{"den": 1}', true, now())`)).toBe("khong loi");
    expect(await ghi(`insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values ('hoi-dap', '${A2}', '${B1}', '${S1}', '${R1}', true, now())`)).toBe("khong loi");
    expect(await ghi(`insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('da-doc', '${A2}', '${B1}', '${R1}', true, now())`)).toBe("activity_detail");
    expect(await ghi(`insert into activity (kind, actor_id, shared, at) values ('tha-tam-trang', '${A2}', true, now())`)).toBe("activity_tam_trang");
    expect(await ghi(`insert into reading_positions (account_id, book_id, position) values ('${A2}', '${B1}', 0)`)).toBe("reading_positions_position");
  });
});
