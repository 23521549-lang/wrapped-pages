import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration luot dang tren du lieu cu du dang. Tu dung thu muc migration tam (0000 toi 0008 cua drizzle/, roi them
 * 0009) va journal rieng, nen chi kiem chinh tep SQL, qua dung migrator cua drizzle: tach cau theo statement-breakpoint,
 * moi migration dang cho chay trong mot giao dich. Mot buoc kiem RAISE thi ca migration huy, database o nguyen 0008.
 */

const GOC = "drizzle";
const TEN_0009 = "0009_luot-dang";

type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(kem0009: boolean): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-luot-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const truoc = journal.entries.filter((m) => m.idx <= 8);
  for (const m of truoc) copyFileSync(path.join(GOC, `${m.tag}.sql`), path.join(dich, `${m.tag}.sql`));
  const entries = [...truoc];
  if (kem0009) {
    copyFileSync(path.join(GOC, `${TEN_0009}.sql`), path.join(dich, `${TEN_0009}.sql`));
    entries.push({ idx: 9, version: "7", when: truoc[truoc.length - 1].when + 1, tag: TEN_0009, breakpoints: true });
  }
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

async function dbToi0008(): Promise<PGlite> {
  const c = new PGlite();
  // Chu cua timestamptz theo mui gio phien; chot UTC de so chu voi hang so o duoi.
  await c.exec("set time zone 'UTC'");
  await migrate(drizzle(c), { migrationsFolder: thuMuc(false) });
  return c;
}

const len0009 = (c: PGlite) => migrate(drizzle(c), { migrationsFolder: thuMuc(true) });

/** Thong diep cua loi Postgres ben trong loi drizzle (loi goc nam o cause). */
async function loiCua(p: Promise<unknown>): Promise<string> {
  const e = await p.then(() => null, (x: unknown) => x);
  const goc = (e as { cause?: { message?: string } } | null)?.cause?.message ?? (e as Error | null)?.message;
  return goc ?? "khong loi";
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "b1111111-1111-4111-8111-111111111111";
const B2 = "b2222222-2222-4222-8222-222222222222";
const B3 = "b3333333-3333-4333-8333-333333333333";
const B4 = "b4444444-4444-4444-8444-444444444444";
const S_DO = "c1111111-1111-4111-8111-111111111111";
const S_TRAO = "c2222222-2222-4222-8222-222222222222";
const S_HEN = "c3333333-3333-4333-8333-333333333333";
const S_DO2 = "c4444444-4444-4444-8444-444444444444";
const S_HEN2 = "c5555555-5555-4555-8555-555555555555";

/** Moc dang cua tung lan dang cu (le micro giay nhu now() cua Postgres). */
const T = {
  b1a: "2026-09-01 08:00:00.123456+00", b1b: "2026-09-02 08:00:00.5+00", b1c: "2026-09-03 08:00:00+00",
  b1d: "2026-09-04 08:00:00.000001+00", b1e: "2026-09-05 08:00:00+00",
  b2a: "2026-09-06 08:00:00+00", b2b: "2026-09-07 08:00:00+00", b3a: "2026-09-08 08:00:00+00",
};
const DOC = (chu: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }] });

/**
 * Du lieu cu du dang: bon cuon (hai nguoi, chia se, rieng tu, mot cuon chua co to), tam lan dang, du ba kieu niem
 * phong (cau do da mo bang tang chia khoa va cau do chua mo, trao doi da tra loi, hen gio con khoa va da qua gio),
 * to da sua (edited_at), lan thu, trang tra loi, moi loai su kien ke ca doi-mat-khau, moc doc va ban nhap.
 */
async function gieoCu(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode, cover) values
      ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se', 'nui-xa'),
      ('${B2}', '${A2}', 'Thu chua gui', 'chia-se', 'khom-truc'),
      ('${B3}', '${A1}', 'Rieng', 'rieng-tu', 'chim-bay'),
      ('${B4}', '${A1}', 'Chua viet', 'chia-se', 'hoa-dao');
    insert into pages (book_id, position, content, published_at, edited_at) values
      ('${B1}', 1, '${DOC("B1 mot")}', '${T.b1a}', null),
      ('${B1}', 2, '${DOC("B1 hai")}', '${T.b1a}', '2026-09-10 09:00:00.25+00'),
      ('${B1}', 3, '${DOC("B1 ba")}', '${T.b1b}', null),
      ('${B1}', 4, '${DOC("B1 bon")}', '${T.b1b}', null),
      ('${B1}', 5, '${DOC("B1 nam")}', '${T.b1c}', null),
      ('${B1}', 6, '${DOC("B1 sau")}', '${T.b1d}', null),
      ('${B1}', 7, '${DOC("B1 bay")}', '${T.b1d}', null),
      ('${B1}', 8, '${DOC("B1 tam")}', '${T.b1d}', null),
      ('${B1}', 9, '${DOC("B1 chin")}', '${T.b1e}', '2026-09-11 10:00:00+00'),
      ('${B2}', 1, '${DOC("B2 mot")}', '${T.b2a}', null),
      ('${B2}', 2, '${DOC("B2 hai")}', '${T.b2a}', null),
      ('${B2}', 3, '${DOC("B2 ba")}', '${T.b2a}', null),
      ('${B2}', 4, '${DOC("B2 bon")}', '${T.b2b}', '2026-09-12 10:00:00+00'),
      ('${B3}', 1, '${DOC("B3 mot")}', '${T.b3a}', null);
    insert into seals (id, book_id, first_position, last_position, kind, question, answers, hints, opened_at, gift_note, teaser) values
      ('${S_DO}', '${B1}', 3, 4, 'cau-do', 'O dau?', '["ben xe"]', '["co xe"]', '2026-09-02 09:00:00+00', 'Cho em', 'B1 ba');
    insert into seals (id, book_id, first_position, last_position, kind, question, opened_at, teaser) values
      ('${S_TRAO}', '${B1}', 5, 5, 'trao-doi', 'Nghi gi?', '2026-09-03 09:00:00+00', 'B1 nam');
    insert into seals (id, book_id, first_position, last_position, kind, opens_at, teaser) values
      ('${S_HEN}', '${B1}', 6, 8, 'hen-gio', '2030-01-01 00:00:00+00', 'B1 sau'),
      ('${S_HEN2}', '${B3}', 1, 1, 'hen-gio', '2026-09-09 00:00:00+00', '');
    insert into seals (id, book_id, first_position, last_position, kind, question, answers, teaser) values
      ('${S_DO2}', '${B2}', 1, 3, 'cau-do', 'Ai?', '["em"]', 'B2 mot');
    insert into seal_attempts (seal_id, account_id, guess, correct, at) values
      ('${S_DO}', '${A2}', 'sai', false, '2026-09-02 08:30:00+00'),
      ('${S_DO2}', '${A1}', 'anh', false, '2026-09-06 09:00:00+00');
    insert into seal_replies (seal_id, account_id, content) values ('${S_TRAO}', '${A2}', '${DOC("Tra loi")}');
    insert into activity (kind, actor_id, book_id, seal_id, first_position, last_position, shared, at) values
      ('dang-trang', '${A1}', '${B1}', null, 1, 2, true, '${T.b1a}'),
      ('dang-trang', '${A1}', '${B1}', '${S_DO}', 3, 4, true, '${T.b1b}'),
      ('thu-sai', '${A2}', '${B1}', '${S_DO}', 3, 4, true, '2026-09-02 08:30:00+00'),
      ('tang-khoa', '${A1}', '${B1}', '${S_DO}', 3, 4, true, '2026-09-02 09:00:00+00'),
      ('moi-trao-doi', '${A1}', '${B1}', '${S_TRAO}', 5, 5, true, '${T.b1c}'),
      ('mo-trang', '${A2}', '${B1}', '${S_TRAO}', 5, 5, true, '2026-09-03 09:00:00+00'),
      ('dang-trang', '${A1}', '${B1}', '${S_HEN}', 6, 8, true, '${T.b1d}'),
      ('mo-hen-gio', '${A1}', '${B1}', '${S_HEN}', 6, 8, true, '2030-01-01 00:00:00+00'),
      ('dang-trang', '${A1}', '${B1}', null, 9, 9, true, '${T.b1e}'),
      ('dang-trang', '${A2}', '${B2}', '${S_DO2}', 1, 3, true, '${T.b2a}'),
      ('thu-sai', '${A1}', '${B2}', '${S_DO2}', 1, 3, true, '2026-09-06 09:00:00+00'),
      ('dang-trang', '${A2}', '${B2}', null, 4, 4, true, '${T.b2b}'),
      ('dang-trang', '${A1}', '${B3}', '${S_HEN2}', 1, 1, false, '${T.b3a}'),
      ('mo-hen-gio', '${A1}', '${B3}', '${S_HEN2}', 1, 1, false, '2026-09-09 00:00:00+00');
    insert into activity (kind, actor_id, subject_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', false, '2026-09-13 00:00:00+00');
    insert into read_marks (account_id, book_id, position) values ('${A2}', '${B1}', 4), ('${A1}', '${B2}', 2);
    insert into drafts (book_id, content, sheet_count) values ('${B1}', '${DOC("Nhap do")}', 1);
  `);
}

async function hang<T>(c: PGlite, cau: string): Promise<T[]> {
  return (await c.query<T>(cau)).rows;
}

/** Bang khong doi cau truc trong migration: phai giu nguyen tung dong. */
const BANG_GIU = ["accounts", "books", "drafts", "read_marks", "seal_attempts", "seal_replies"];

async function chup(c: PGlite): Promise<Record<string, string[]>> {
  const kq: Record<string, string[]> = {};
  for (const ten of BANG_GIU) kq[ten] = (await hang<{ r: string }>(c, `select to_jsonb(t)::text as r from "${ten}" t order by 1`)).map((x) => x.r);
  return kq;
}

const KHOANG = "(select round_id, min(position) as dau, max(position) as cuoi from pages group by round_id)";

describe("migration 0009 luot dang: du lieu cu du dang", () => {
  it("moi nhom (book_id, published_at) thanh mot luot, edited_at la lan sua muon nhat cua nhom", async () => {
    const c = await dbToi0008();
    await gieoCu(c);
    await len0009(c);
    const luot = await hang<{ book_id: string; published_at: string; edited_at: string | null; dau: number; cuoi: number; so: number }>(c, `
      select r.book_id, r.published_at::text, r.edited_at::text, min(p.position) as dau, max(p.position) as cuoi, count(*)::int as so
      from rounds r join pages p on p.round_id = r.id
      group by r.id order by r.book_id, dau`);
    expect(luot.map((r) => [r.book_id, r.dau, r.cuoi, r.so])).toEqual([
      [B1, 1, 2, 2], [B1, 3, 4, 2], [B1, 5, 5, 1], [B1, 6, 8, 3], [B1, 9, 9, 1],
      [B2, 1, 3, 3], [B2, 4, 4, 1], [B3, 1, 1, 1],
    ]);
    expect(luot.map((r) => r.edited_at)).toEqual([
      "2026-09-10 09:00:00.25+00", null, null, null, "2026-09-11 10:00:00+00", null, "2026-09-12 10:00:00+00", null,
    ]);
    expect(luot.map((r) => r.published_at)).toEqual([T.b1a, T.b1b, T.b1c, T.b1d, T.b1e, T.b2a, T.b2b, T.b3a]);
    expect(await hang(c, "select count(*)::int as n from rounds")).toEqual([{ n: 8 }]);
    expect(await hang(c, `select count(*)::int as n from rounds where book_id = '${B4}'`)).toEqual([{ n: 0 }]);
  });

  it("to giu noi dung, vi tri, moc dang; niem phong va su kien bam dung luot cua to dau", async () => {
    const c = await dbToi0008();
    await gieoCu(c);
    const toTruoc = await hang<{ r: string }>(c, "select to_jsonb(t) - 'edited_at' as r from pages t order by book_id, position");
    await len0009(c);
    const toSau = await hang<{ r: string }>(c, "select to_jsonb(t) - 'round_id' as r from pages t order by book_id, position");
    expect(toSau).toEqual(toTruoc);
    expect(await hang(c, `select s.id, k.dau, k.cuoi from seals s join ${KHOANG} k on k.round_id = s.round_id order by s.id`)).toEqual([
      { id: S_DO, dau: 3, cuoi: 4 }, { id: S_TRAO, dau: 5, cuoi: 5 }, { id: S_HEN, dau: 6, cuoi: 8 },
      { id: S_DO2, dau: 1, cuoi: 3 }, { id: S_HEN2, dau: 1, cuoi: 1 },
    ]);
    const suKien = await hang<{ kind: string; book_id: string | null; dau: number | null; cuoi: number | null; khop: boolean | null }>(c, `
      select a.kind, a.book_id, k.dau, k.cuoi, (a.seal_id is null or a.round_id = s.round_id) as khop
      from activity a left join ${KHOANG} k on k.round_id = a.round_id left join seals s on s.id = a.seal_id
      order by a.at, a.kind`);
    expect(suKien.map((e) => [e.kind, e.book_id, e.dau, e.cuoi, e.khop])).toEqual([
      ["dang-trang", B1, 1, 2, true], ["dang-trang", B1, 3, 4, true], ["thu-sai", B1, 3, 4, true], ["tang-khoa", B1, 3, 4, true],
      ["moi-trao-doi", B1, 5, 5, true], ["mo-trang", B1, 5, 5, true], ["dang-trang", B1, 6, 8, true], ["dang-trang", B1, 9, 9, true],
      ["dang-trang", B2, 1, 3, true], ["thu-sai", B2, 1, 3, true], ["dang-trang", B2, 4, 4, true], ["dang-trang", B3, 1, 1, true],
      ["mo-hen-gio", B3, 1, 1, true], ["doi-mat-khau", null, null, null, true], ["mo-hen-gio", B1, 6, 8, true],
    ]);
  });

  it("cac bang khong doi cau truc giu nguyen tung dong", async () => {
    const c = await dbToi0008();
    await gieoCu(c);
    const truoc = await chup(c);
    await len0009(c);
    expect(await chup(c)).toEqual(truoc);
  });

  it("siet rang buoc sau khi gan: cot cu mat, round_id bat buoc, moi luot mot niem phong, doi-mat-khau khong co luot", async () => {
    const c = await dbToi0008();
    await gieoCu(c);
    await len0009(c);
    const cot = async (bang: string) =>
      (await hang<{ column_name: string }>(c, `select column_name from information_schema.columns where table_name = '${bang}' order by 1`)).map((x) => x.column_name);
    expect(await cot("pages")).toEqual(["book_id", "content", "id", "position", "published_at", "round_id"]);
    expect(await cot("seals")).not.toContain("first_position");
    expect(await cot("seals")).not.toContain("last_position");
    expect(await cot("activity")).not.toContain("first_position");
    expect(await cot("activity")).not.toContain("last_position");
    expect(await cot("rounds")).toEqual(["book_id", "edited_at", "id", "published_at"]);
    const [luot] = await hang<{ id: string }>(c, `select round_id as id from seals where id = '${S_DO}'`);
    expect(await loiCua(c.query(`insert into pages (book_id, position, content) values ('${B4}', 1, '${DOC("x")}')`))).toMatch(/round_id/);
    expect(await loiCua(c.query(`insert into seals (book_id, round_id, kind, opens_at) values ('${B1}', '${luot.id}', 'hen-gio', now())`))).toMatch(/seals_round_id_unique/);
    expect(await loiCua(c.query(`insert into activity (kind, actor_id, book_id, shared, at) values ('dang-trang', '${A1}', '${B1}', true, now())`))).toMatch(/activity_sach/);
    expect(await loiCua(c.query(`insert into activity (kind, actor_id, subject_id, round_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', '${luot.id}', false, now())`))).toMatch(/activity_mat_khau/);
    expect(await loiCua(c.query(`update rounds set edited_at = published_at - interval '1 second' where id = '${luot.id}'`))).toMatch(/rounds_edited_at/);
    await c.query(`delete from books where id = '${B1}'`);
    expect(await hang(c, `select count(*)::int as n from rounds where book_id = '${B1}'`)).toEqual([{ n: 0 }]);
  });
});

describe("migration 0009 luot dang: du lieu khong nhat quan thi huy ca migration", () => {
  /** Lam hong du lieu cu, chay len 0009, doi dung loi, roi chung minh database van o 0008 y nguyen. */
  async function huy(lamHong: string, thongDiep: RegExp) {
    const c = await dbToi0008();
    await gieoCu(c);
    await c.exec(lamHong);
    const truoc = await chup(c);
    const cuTruoc = await chupCu(c);
    expect(await loiCua(len0009(c))).toMatch(thongDiep);
    expect(await hang(c, "select to_regclass('public.rounds') is null as khong")).toEqual([{ khong: true }]);
    expect(await hang(c, "select count(*)::int as n from information_schema.columns where table_name = 'seals' and column_name = 'first_position'")).toEqual([{ n: 1 }]);
    expect(await hang(c, "select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 9 }]);
    expect(await chup(c)).toEqual(truoc);
    expect(await chupCu(c)).toEqual(cuTruoc);
  }

  /** Ba bang bi doi cau truc: huy thi phai con nguyen tung dong va tung cot cu (ke ca cot vi tri, edited_at). */
  async function chupCu(c: PGlite): Promise<Record<string, string[]>> {
    const kq: Record<string, string[]> = {};
    for (const ten of ["pages", "seals", "activity"]) kq[ten] = (await hang<{ r: string }>(c, `select to_jsonb(t)::text as r from "${ten}" t order by 1`)).map((x) => x.r);
    return kq;
  }

  it("niem phong khong phu tron luot", () =>
    huy(`update seals set last_position = 3 where id = '${S_DO}'`, /luot-dang: 1 niem phong khong phu dung tron mot luot/));

  it("niem phong bat dau o vi tri khong co to", () =>
    huy(`update seals set first_position = 20, last_position = 20 where id = '${S_TRAO}'`, /luot-dang: 1 niem phong khong phu dung tron mot luot/));

  it("to cua mot lan dang khong lien nhau", () =>
    huy(`update pages set published_at = '${T.b1a}' where book_id = '${B1}' and position = 5`, /luot-dang: 1 luot co to khong lien nhau/));

  it("su kien lech khoang to cua luot", () =>
    huy(`update activity set last_position = 1 where kind = 'dang-trang' and book_id = '${B1}' and first_position = 1`, /luot-dang: 1 su kien khong khop mot luot/));

  it("su kien bam niem phong cua luot khac", () =>
    huy(`update activity set seal_id = '${S_TRAO}' where kind = 'tang-khoa'`, /luot-dang: 1 su kien lech luot voi niem phong cua no/));

  it("su kien tro vi tri khong co to", () =>
    huy(`update activity set first_position = 20, last_position = 20 where kind = 'dang-trang' and book_id = '${B1}' and first_position = 9`, /luot-dang: 1 su kien khong khop mot luot/));

  it("hai lan dang lien ke trung moc dang bi gop thanh mot luot", () =>
    huy(`
      insert into pages (book_id, position, content, published_at) values
        ('${B4}', 1, '${DOC("B4 mot")}', '${T.b3a}'), ('${B4}', 2, '${DOC("B4 hai")}', '${T.b3a}');
      insert into activity (kind, actor_id, book_id, first_position, last_position, shared, at) values
        ('dang-trang', '${A1}', '${B4}', 1, 1, true, '${T.b3a}'), ('dang-trang', '${A1}', '${B4}', 2, 2, true, '${T.b3a}');
    `, /luot-dang: 2 su kien khong khop mot luot/));

  it("hai lan dang trung moc dang, lan sau co niem phong", () =>
    huy(`update pages set published_at = '${T.b1a}' where book_id = '${B1}' and position in (3, 4)`, /luot-dang: 1 niem phong khong phu dung tron mot luot/));
});

describe("migration 0009 luot dang: database chua co du lieu", () => {
  it("len duoc 0009 va rang buoc moi dung", async () => {
    const c = await dbToi0008();
    await len0009(c);
    expect(await hang(c, "select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 10 }]);
    expect(await hang(c, "select count(*)::int as n from rounds")).toEqual([{ n: 0 }]);
    const rangBuoc = await hang<{ conname: string }>(c, `
      select conname from pg_constraint
      where conrelid in ('rounds'::regclass, 'pages'::regclass, 'seals'::regclass, 'activity'::regclass)
        and conname in ('rounds_edited_at', 'rounds_book_id_books_id_fk', 'pages_round_id_rounds_id_fk', 'seals_round_id_rounds_id_fk',
          'activity_round_id_rounds_id_fk', 'seals_round_id_unique', 'activity_sach', 'activity_mat_khau', 'pages_edited_at', 'seals_range')
      order by 1`);
    expect(rangBuoc.map((r) => r.conname)).toEqual([
      "activity_mat_khau", "activity_round_id_rounds_id_fk", "activity_sach", "pages_round_id_rounds_id_fk",
      "rounds_book_id_books_id_fk", "rounds_edited_at", "seals_round_id_rounds_id_fk", "seals_round_id_unique",
    ]);
    const chiMuc = await hang<{ indexname: string }>(c, `
      select indexname from pg_indexes where indexname in ('rounds_book_idx', 'pages_round_idx', 'seals_book_first_idx') order by 1`);
    expect(chiMuc.map((r) => r.indexname)).toEqual(["pages_round_idx", "rounds_book_idx"]);
  });
});
