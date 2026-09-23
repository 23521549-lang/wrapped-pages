import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Moc "da doc toi dau" thanh tap to da xem, tren du lieu cu du dang. Dung thu muc migration tam (0000 toi 0011 cua
 * drizzle/, roi them 0012 va 0013) va journal rieng, nen chi kiem chinh cac tep SQL, qua dung migrator cua drizzle:
 * moi migration dang cho chay trong mot giao dich, mot buoc kiem RAISE thi ca migration huy.
 */

const GOC = "drizzle";

type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-xem-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const entries = journal.entries.filter((m) => m.idx <= toi);
  for (const m of entries) copyFileSync(path.join(GOC, `${m.tag}.sql`), path.join(dich, `${m.tag}.sql`));
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const B2 = "44444444-4444-4444-8444-444444444444";
const B3 = "77777777-7777-4777-8777-777777777777";
const R1 = "55555555-5555-4555-8555-555555555555";
const R2 = "66666666-6666-4666-8666-666666666666";
const R3 = "88888888-8888-4888-8888-888888888888";

const DOC = (chu: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }] });

async function dbToi0011(): Promise<PGlite> {
  const c = new PGlite();
  await migrate(drizzle(c), { migrationsFolder: thuMuc(11) });
  return c;
}

async function len0013(c: PGlite): Promise<void> {
  await migrate(drizzle(c), { migrationsFolder: thuMuc(13) });
}

async function gieoCu(c: PGlite): Promise<void> {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Manh', 'x', 'y', 'd1'), ('${A2}', 2, 'Linh', 'x', 'y', 'd2');
    insert into books (id, owner_id, title, mode, cover) values
      ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se', 'nui-xa'),
      ('${B2}', '${A2}', 'Cuon hai', 'chia-se', 'chim-bay'),
      ('${B3}', '${A2}', 'Cuon ba', 'chia-se', 'nui-xa');
    insert into rounds (id, book_id, published_at) values
      ('${R1}', '${B1}', '2026-09-01 00:00:00+00'), ('${R2}', '${B2}', '2026-09-02 00:00:00+00'),
      ('${R3}', '${B3}', '2026-09-03 00:00:00+00');
    insert into pages (book_id, round_id, position, content, published_at) values
      ('${B1}', '${R1}', 1, '${DOC("mot")}'::jsonb, '2026-09-01 00:00:00+00'),
      ('${B1}', '${R1}', 2, '${DOC("hai")}'::jsonb, '2026-09-01 00:00:00+00'),
      ('${B1}', '${R1}', 3, '${DOC("ba")}'::jsonb, '2026-09-01 00:00:00+00'),
      ('${B2}', '${R2}', 1, '${DOC("x")}'::jsonb, '2026-09-02 00:00:00+00'),
      ('${B3}', '${R3}', 1, '${DOC("y")}'::jsonb, '2026-09-03 00:00:00+00'),
      ('${B3}', '${R3}', 2, '${DOC("z")}'::jsonb, '2026-09-03 00:00:00+00');
    insert into read_marks (account_id, book_id, position) values
      ('${A2}', '${B1}', 2), ('${A1}', '${B2}', 0), ('${A1}', '${B3}', 9), ('${A1}', '${B1}', 3);
  `);
}

async function hang<T>(c: PGlite, cau: string): Promise<T[]> {
  return (await c.query<T>(cau)).rows;
}

describe("migration to da xem: moc cu thanh tung to", () => {
  it("moc p thanh dung cac to 1 toi p co that; moc 0 khong sinh dong; moc vuot to cuoi chi lay to co that; moc cua chinh chu sach khong chuyen", async () => {
    const c = await dbToi0011();
    await gieoCu(c);
    await len0013(c);
    const rows = await hang<{ account_id: string; book_id: string; position: number }>(
      c, "select account_id, book_id, position from read_sheets order by account_id, book_id, position");
    expect(rows.map((r) => [r.account_id, r.book_id, r.position])).toEqual([
      [A1, B3, 1], [A1, B3, 2], [A2, B1, 1], [A2, B1, 2],
    ]);
    await c.close();
  });

  it("bang moc cu bien mat, bang moi co dung rang buoc", async () => {
    const c = await dbToi0011();
    await gieoCu(c);
    await len0013(c);
    expect(await hang(c, "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'read_marks'")).toEqual([]);
    const rb = await hang<{ conname: string }>(c, "select conname from pg_constraint where conrelid = 'read_sheets'::regclass order by conname");
    expect(rb.map((r) => r.conname)).toEqual([
      "read_sheets_account_id_accounts_id_fk",
      "read_sheets_account_id_book_id_position_pk",
      "read_sheets_account_id_not_null",
      "read_sheets_book_id_books_id_fk",
      "read_sheets_book_id_not_null",
      "read_sheets_position",
      "read_sheets_position_not_null",
    ]);
    await c.close();
  });
});
