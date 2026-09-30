import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration 0018 (sach viet cung "Hai Ngòi Bút", dot nam 5c) tren du lieu cua 0017: moi luot cu thanh luot cua chu cuon,
 * moi nhap cu thanh nhap cua chu cuon, khoa chinh nhap doi sang (book_id, account_id), them bang de_nghi rong va sau loai
 * Hoat dong moi. Khong dong cu nao mat, moi loai cu van ghi duoc nhu truoc.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-hai-ngoi-but-"));
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
const B2 = "b2222222-2222-4222-8222-222222222222";
const R1 = "a1111111-1111-4111-8111-111111111111";
const R2 = "a2222222-2222-4222-8222-222222222222";
const R3 = "a3333333-3333-4333-8333-333333333333";

/** Du lieu cua 0017: cuon cua A1 hai luot (mot luot niem phong), cuon rieng tu cua A2 mot luot, hai ban nhap. */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode) values
      ('${B1}', '${A1}', 'Nhung bua sang', 'chia-se'), ('${B2}', '${A2}', 'Chay bo', 'rieng-tu');
    insert into rounds (id, book_id, published_at) values
      ('${R1}', '${B1}', '2026-09-01 08:00:00+00'), ('${R2}', '${B1}', '2026-09-02 08:00:00+00'), ('${R3}', '${B2}', '2026-09-03 08:00:00+00');
    insert into pages (book_id, position, content, round_id) values
      ('${B1}', 1, '{"type":"doc","content":[]}', '${R1}'), ('${B1}', 2, '{"type":"doc","content":[]}', '${R2}'),
      ('${B2}', 1, '{"type":"doc","content":[]}', '${R3}');
    insert into seals (book_id, round_id, kind, question) values ('${B1}', '${R2}', 'trao-doi', 'Hom nay an gi?');
    insert into drafts (book_id, content) values ('${B1}', '{"type":"doc","content":[]}'), ('${B2}', '{"type":"doc","content":[]}');
    insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('dang-trang', '${A1}', '${B1}', '${R1}', true, '2026-09-01 08:00:00+00');
  `);
}

async function mot<T>(c: PGlite, sql: string): Promise<T[]> {
  return (await c.query<T>(sql)).rows;
}

describe("migration 0018 hai ngoi but", () => {
  it("luot cu va nhap cu thanh cua chu cuon; ten luot null; sach cu la sach mot nguoi viet; de_nghi rong", async () => {
    const c = new PGlite();
    await len(c, 17);
    await gieo(c);
    await len(c, 18);
    expect(await mot(c, "select id, tac_gia_id, ten from rounds order by id")).toEqual([
      { id: R1, tac_gia_id: A1, ten: null }, { id: R2, tac_gia_id: A1, ten: null }, { id: R3, tac_gia_id: A2, ten: null },
    ]);
    expect(await mot(c, "select book_id, account_id from drafts order by book_id")).toEqual([
      { book_id: B1, account_id: A1 }, { book_id: B2, account_id: A2 },
    ]);
    expect(await mot(c, "select id, viet_cung_tu from books order by id")).toEqual([
      { id: B1, viet_cung_tu: null }, { id: B2, viet_cung_tu: null },
    ]);
    expect(await mot(c, "select * from de_nghi")).toEqual([]);
    expect(await mot(c, "select count(*)::int as n from activity")).toEqual([{ n: 1 }]);
  });

  it("CHECK moi: sach viet cung phai chia se, ten luot 1 toi 60 ky tu, loai de nghi; khoa chinh nhap theo nguoi", async () => {
    const c = new PGlite();
    await len(c, 17);
    await gieo(c);
    await len(c, 18);
    expect(await rangBuoc(c.exec(`update books set viet_cung_tu = now() where id = '${B2}'`))).toBe("books_viet_cung");
    expect(await rangBuoc(c.exec(`update books set viet_cung_tu = now() where id = '${B1}'`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`update books set mode = 'rieng-tu' where id = '${B1}'`))).toBe("books_viet_cung");
    expect(await rangBuoc(c.exec(`update rounds set ten = '' where id = '${R1}'`))).toBe("rounds_ten");
    expect(await rangBuoc(c.exec(`update rounds set ten = '${"ệ".repeat(61)}' where id = '${R1}'`))).toBe("rounds_ten");
    expect(await rangBuoc(c.exec(`update rounds set ten = '${"ệ".repeat(60)}' where id = '${R1}'`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into rounds (book_id, published_at) values ('${B1}', now())`))).toContain("tac_gia_id");
    expect(await rangBuoc(c.exec(`insert into de_nghi (book_id, loai, tu_id) values ('${B1}', 'moi-ai', '${A1}')`))).toBe("de_nghi_loai");
    expect(await rangBuoc(c.exec(`insert into de_nghi (book_id, loai, tu_id) values ('${B1}', 'xoa-sach', '${A2}')`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into de_nghi (book_id, loai, tu_id) values ('${B1}', 'xin-viet', '${A2}')`))).toBe("de_nghi_pkey");
    expect(await rangBuoc(c.exec(`insert into drafts (book_id, account_id, content) values ('${B1}', '${A2}', '{"type":"doc","content":[]}')`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into drafts (book_id, account_id, content) values ('${B1}', '${A2}', '{"type":"doc","content":[]}')`))).toBe("drafts_book_id_account_id_pk");
  });

  it("sau loai Hoat dong moi ghi duoc dung hinh; sai hinh bi CHECK chan; loai cu van ghi nhu truoc", async () => {
    const c = new PGlite();
    await len(c, 17);
    await gieo(c);
    await len(c, 18);
    const ghi = (cot: string, gt: string) => rangBuoc(c.exec(`insert into activity (${cot}, shared, at) values (${gt}, true, now())`));
    for (const loai of ["moi-viet", "xin-viet", "de-nghi-xoa"]) {
      expect(await ghi("kind, actor_id, book_id", `'${loai}', '${A1}', '${B1}'`), loai).toBe("khong loi");
      expect(await ghi("kind, actor_id, book_id, round_id", `'${loai}', '${A1}', '${B1}', '${R1}'`), loai).toBe("activity_sach");
      expect(await ghi("kind, actor_id, book_id, detail", `'${loai}', '${A1}', '${B1}', '{"x": 1}'`), loai).toBe("activity_detail");
    }
    expect(await ghi("kind, actor_id, book_id, detail", `'nhan-viet', '${A2}', '${B1}', '{"tu": "moi-viet"}'`)).toBe("khong loi");
    expect(await ghi("kind, actor_id, book_id", `'nhan-viet', '${A2}', '${B1}'`)).toBe("activity_detail");
    expect(await ghi("kind, actor_id, book_id, detail", `'tu-choi', '${A2}', '${B1}', '{"viec": "xoa-sach"}'`)).toBe("khong loi");
    expect(await ghi("kind, actor_id, book_id, round_id, detail", `'doi-ten-luot', '${A1}', '${B1}', '${R1}', '{"truoc": null, "sau": "Mưa"}'`)).toBe("khong loi");
    expect(await ghi("kind, actor_id, book_id, detail", `'doi-ten-luot', '${A1}', '${B1}', '{"truoc": null, "sau": "Mưa"}'`)).toBe("activity_sach");
    expect(await ghi("kind, actor_id, book_id, round_id", `'doi-ten-luot', '${A1}', '${B1}', '${R1}'`)).toBe("activity_detail");
    expect(await ghi("kind, actor_id, book_id, round_id", `'dang-trang', '${A1}', '${B1}', '${R1}'`)).toBe("khong loi");
    expect(await ghi("kind, actor_id, book_id", `'tao-sach', '${A1}', '${B1}'`)).toBe("khong loi");
    expect(await ghi("kind, actor_id, detail", `'gui-thu', '${A1}', '{"thang": "2026-09"}'`)).toBe("khong loi");
  });
});
