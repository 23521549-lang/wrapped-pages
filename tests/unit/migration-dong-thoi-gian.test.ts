import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Bia va nhac cua mot cuon thanh hai dong thoi gian, tren du lieu cu du dang: cuon co bia anh, cuon chi co tranh ve,
 * cuon co nhac, cuon khong nhac, cuon chua co luot nao, cuon rieng tu, cuon ma dong media cua bia da bi xoa, va sach
 * cua ca hai nguoi. Dung thu muc migration tam va journal rieng nen chi kiem chinh cac tep SQL, qua dung migrator cua
 * drizzle: TAT CA migration dang cho nam trong MOT giao dich chung, nen mot buoc kiem duoi RAISE thi ca lan migrate huy
 * va database giu nguyen nhu truoc.
 * Khoi "sau khi pha phan chep" chung minh sau khoi RAISE that su bat loi chu khong phai trang tri: moi lan pha mot cho
 * trong ban SAO tam cua 0014 roi doi dung thong diep cua khoi tuong ung. Tep trong kho khong bao gio bi sua.
 */

const GOC = "drizzle";
const TAG = "0014_dong-thoi-gian";

type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number, pha?: (sql: string) => string): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-dtg-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const entries = journal.entries.filter((m) => m.idx <= toi);
  for (const m of entries) {
    const dau = path.join(GOC, `${m.tag}.sql`);
    const cuoi = path.join(dich, `${m.tag}.sql`);
    if (pha && m.tag === TAG) {
      const goc = readFileSync(dau, "utf8");
      const moi = pha(goc);
      // Pha hut thi bai kiem khong con chung minh gi: dung han thay vi de no xanh gia.
      if (moi === goc) throw new Error(`khong pha duoc ${m.tag}.sql: mau can thay da doi`);
      writeFileSync(cuoi, moi);
    } else {
      copyFileSync(dau, cuoi);
    }
  }
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const B2 = "44444444-4444-4444-8444-444444444444";
const B3 = "55555555-5555-4555-8555-555555555555";
const B4 = "66666666-6666-4666-8666-666666666666";
const B5 = "99999999-9999-4999-8999-999999999999";
const R1 = "77777777-7777-4777-8777-777777777777";
const M1 = "88888888-8888-4888-8888-888888888888";
const M2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M3 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const DOC = (chu: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }] });

async function dbToi0013(): Promise<PGlite> {
  const c = new PGlite();
  await migrate(drizzle(c), { migrationsFolder: thuMuc(13) });
  return c;
}

async function len0014(c: PGlite, pha?: (sql: string) => string): Promise<void> {
  await migrate(drizzle(c), { migrationsFolder: thuMuc(14, pha) });
}

async function hang<T>(c: PGlite, cau: string): Promise<T[]> {
  return (await c.query<T>(cau)).rows;
}

type LoiSql = { message?: string; hint?: string; cause?: unknown };

/**
 * Loi cua drizzle boc nguyen van cau SQL vao message cua no, ma cau SQL do co san chu "dong-thoi-gian" trong tung
 * RAISE: doi message ben ngoai thi bai kiem xanh ngay ca khi khoi RAISE bi xoa. Boc toi loi tan cung cua chuoi cause
 * de doi dung thong diep Postgres that su nem ra.
 */
async function loiLen0014(c: PGlite, pha?: (sql: string) => string): Promise<LoiSql> {
  const loi = await len0014(c, pha).then(() => null, (e: unknown) => e as LoiSql);
  expect(loi, "migration phai huy giua chung").not.toBeNull();
  let goc = loi as LoiSql;
  while (goc.cause) goc = goc.cause as LoiSql;
  return goc;
}

/*
 * B1: sach cua nguoi mot, co bia anh va co nhac, da co mot luot; kho anh cua no con mot dong kind 'anh'.
 * B2: sach RIENG TU cua nguoi mot, chi co tranh ve, khong nhac, chua co luot nao.
 * B3: sach cua nguoi hai, co nhac, khong bia anh.
 * B4: sach cua nguoi hai, khong nhac, khong bia anh.
 * B5: sach cua nguoi hai, tung co bia anh nhung dong media do da bi xoa: khoa ngoai set null da dua cover_media_id ve
 *     null tu truoc khi migrate, nen cuon nay phai ra o bia chi co tranh ve.
 */
async function gieoCu(c: PGlite): Promise<void> {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Manh', 'x', 'y', 'd1'), ('${A2}', 2, 'Linh', 'x', 'y', 'd2');
    insert into books (id, owner_id, title, mode, cover, youtube_id) values
      ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se', 'nui-xa', '5qap5aO4i9A'),
      ('${B2}', '${A1}', 'Cuon chua viet', 'rieng-tu', 'chim-bay', null),
      ('${B3}', '${A2}', 'So tay chay bo', 'chia-se', 'hoa-dao', 'dQw4w9WgXcQ'),
      ('${B4}', '${A2}', 'Cuon bon', 'chia-se', 'cau-go', null),
      ('${B5}', '${A2}', 'Cuon nam', 'chia-se', 'doi-thong', null);
    insert into media (id, owner_id, book_id, kind, mime, bytes, width, height, store_key) values
      ('${M1}', '${A1}', '${B1}', 'bia', 'image/webp', 1024, 1200, 720, '${B1}/${M1}.webp'),
      ('${M2}', '${A2}', '${B5}', 'bia', 'image/webp', 1024, 1200, 720, '${B5}/${M2}.webp'),
      ('${M3}', '${A1}', '${B1}', 'anh', 'image/webp', 2048, 800, 600, '${B1}/${M3}.webp');
    update books set cover_media_id = '${M1}' where id = '${B1}';
    update books set cover_media_id = '${M2}' where id = '${B5}';
    delete from media where id = '${M2}';
    insert into rounds (id, book_id, published_at) values ('${R1}', '${B1}', '2026-09-01 00:00:00+00');
    insert into pages (book_id, round_id, position, content, published_at) values
      ('${B1}', '${R1}', 1, '${DOC("mot")}'::jsonb, '2026-09-01 00:00:00+00');
  `);
}

describe("migration dong thoi gian", () => {
  it("moi cuon ra dung mot o bia mo dau mang y nguyen bia hom nay", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    // Cuon co dong media cua bia da bi xoa: khoa ngoai set null da lam viec cua no truoc khi migrate.
    expect(await hang(c, `select id from books where cover_media_id is null order by id`))
      .toEqual([{ id: B2 }, { id: B3 }, { id: B4 }, { id: B5 }]);
    await len0014(c);
    const o = await hang<{ book_id: string; round_id: string | null; cover: string; cover_media_id: string | null }>(
      c, `select book_id, round_id, cover, cover_media_id from book_covers order by book_id`,
    );
    expect(o).toEqual([
      { book_id: B1, round_id: null, cover: "nui-xa", cover_media_id: M1 },
      { book_id: B2, round_id: null, cover: "chim-bay", cover_media_id: null },
      { book_id: B3, round_id: null, cover: "hoa-dao", cover_media_id: null },
      { book_id: B4, round_id: null, cover: "cau-go", cover_media_id: null },
      { book_id: B5, round_id: null, cover: "doi-thong", cover_media_id: null },
    ]);
    await c.close();
  });

  it("chi cuon co nhac moi ra o nhac, va o do mang y nguyen ma video hom nay", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    await len0014(c);
    const o = await hang<{ book_id: string; round_id: string | null; youtube_id: string | null }>(
      c, `select book_id, round_id, youtube_id from book_tracks order by book_id`,
    );
    expect(o).toEqual([
      { book_id: B1, round_id: null, youtube_id: "5qap5aO4i9A" },
      { book_id: B3, round_id: null, youtube_id: "dQw4w9WgXcQ" },
    ]);
    await c.close();
  });

  it("khong cuon nao thieu o bia, va khong o nao gan vao mot luot", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    await len0014(c);
    expect(await hang(c, `select b.id from books b where not exists (select 1 from book_covers c where c.book_id = b.id)`)).toEqual([]);
    expect(await hang(c, `select id from book_covers where round_id is not null`)).toEqual([]);
    expect(await hang(c, `select id from book_tracks where round_id is not null`)).toEqual([]);
    await c.close();
  });

  it("database rong van len duoc, khong dong nao duoc sinh", async () => {
    const c = await dbToi0013();
    await len0014(c);
    expect(await hang(c, `select id from book_covers`)).toEqual([]);
    expect(await hang(c, `select id from book_tracks`)).toEqual([]);
    await c.close();
  });

  it("ban nhap cu len duoc va bon cot moi la trang", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    await c.exec(`insert into drafts (book_id, content) values ('${B1}', '${DOC("nhap")}'::jsonb)`);
    await len0014(c);
    expect(await hang(c, `select cover, cover_media_id, youtube_id, drop_track from drafts`))
      .toEqual([{ cover: null, cover_media_id: null, youtube_id: null, drop_track: false }]);
    await c.close();
  });

  it("anh bia tro sai cuon thi ca migration huy, database giu nguyen", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    await c.exec(`update media set book_id = '${B2}' where id = '${M1}'`);
    const loi = await loiLen0014(c);
    expect(loi.message).toBe("dong-thoi-gian: 1 o bia tro toi anh khong phai bia cua cuon");
    expect(loi.hint).toContain("Sua du lieu cu roi chay lai migration");
    // Ca lan migrate nam trong mot giao dich: hai bang moi khong ton tai, bon cot moi cua drafts cung khong.
    expect(await hang(c, `select to_regclass('public.book_covers') as t`)).toEqual([{ t: null }]);
    expect(await hang(c, `select to_regclass('public.book_tracks') as t`)).toEqual([{ t: null }]);
    expect(await hang(c, `select column_name from information_schema.columns where table_name = 'drafts' and column_name = 'drop_track'`)).toEqual([]);
    expect(await hang(c, `select count(*)::int as n from books`)).toEqual([{ n: 5 }]);
    await c.close();
  });

  it("bia cua cuon tro toi mot dong kind 'anh' thi ca migration huy", async () => {
    const c = await dbToi0013();
    await gieoCu(c);
    // Cot books.cover_media_id chi co khoa ngoai toi media.id, khong rang buoc kind: day la lo hong ma khoi kiem canh.
    await c.exec(`update books set cover_media_id = '${M3}' where id = '${B1}'`);
    expect((await loiLen0014(c)).message).toBe("dong-thoi-gian: 1 o bia tro toi anh khong phai bia cua cuon");
    expect(await hang(c, `select to_regclass('public.book_covers') as t`)).toEqual([{ t: null }]);
    await c.close();
  });
});

/*
 * Sau khoi RAISE, moi khoi mot cach pha. Khong khoi nao duoc thay the bang mot khoi khac: neu bo mot khoi di thi dung
 * mot bai duoi day chuyen tu do sang xanh.
 */
const PHA: { ten: string; sua: (s: string) => string; loi: string }[] = [
  {
    ten: "bo sot mot cuon khi chep o bia",
    sua: (s) => s.replace(`SELECT "id", NULL, "cover", "cover_media_id" FROM "books";`, `SELECT "id", NULL, "cover", "cover_media_id" FROM "books" WHERE "id" <> '${B1}';`),
    loi: "dong-thoi-gian: 1 cuon khong co o bia mo dau",
  },
  {
    ten: "chep them mot o bia thua cho moi luot",
    sua: (s) => s.replace(`INSERT INTO "book_tracks"`, `INSERT INTO "book_covers" ("book_id", "round_id", "cover", "cover_media_id")\nSELECT "book_id", "id", 'nui-xa', NULL FROM "rounds";--> statement-breakpoint\nINSERT INTO "book_tracks"`),
    loi: "dong-thoi-gian: co 6 o bia ma co 5 cuon",
  },
  {
    ten: "danh roi anh bia khi chep",
    sua: (s) => s.replace(`SELECT "id", NULL, "cover", "cover_media_id" FROM "books";`, `SELECT "id", NULL, "cover", NULL FROM "books";`),
    loi: "dong-thoi-gian: 1 o bia lech gia tri cua cuon",
  },
  {
    ten: "quen loc cuon khong nhac khi chep o nhac",
    sua: (s) => s.replace(`FROM "books" WHERE "youtube_id" IS NOT NULL;`, `FROM "books";`),
    loi: "dong-thoi-gian: co 5 o nhac ma co 2 cuon co nhac",
  },
  {
    ten: "chep nham ma video cho o nhac",
    sua: (s) => s.replace(`SELECT "id", NULL, "youtube_id" FROM "books" WHERE`, `SELECT "id", NULL, 'dQw4w9WgXcQ' FROM "books" WHERE`),
    loi: "dong-thoi-gian: 1 o nhac lech ma video cua cuon",
  },
];

describe("sau khi pha phan chep", () => {
  it.each(PHA)("$ten thi migration huy", async ({ sua, loi }) => {
    const c = await dbToi0013();
    await gieoCu(c);
    expect((await loiLen0014(c, sua)).message).toBe(loi);
    expect(await hang(c, `select to_regclass('public.book_covers') as t`)).toEqual([{ t: null }]);
    expect(await hang(c, `select count(*)::int as n from books`)).toEqual([{ n: 5 }]);
    await c.close();
  });
});
