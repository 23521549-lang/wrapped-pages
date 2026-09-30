import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LOAI_CAM_XUC } from "@/lib/cam-xuc";

/*
 * Migration 0019 (kho cam xuc, dot nam 5d) tren du lieu cua 0018: them bang cam_xuc, viet lai ba CHECK cua activity va
 * them activity_cam_xuc cho loai tha-cam-xuc. Khong dong cu nao doi, moi loai cu van ghi duoc nhu truoc.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-cam-xuc-"));
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

/** Du lieu cua 0018: mot cuon, mot luot, ba dong Hoat dong, mot la thu. */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode) values ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se');
    insert into rounds (id, book_id, published_at, tac_gia_id) values ('${R1}', '${B1}', '2026-09-01 08:00:00+00', '${A1}');
    insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('dang-trang', '${A1}', '${B1}', '${R1}', true, '2026-09-01 08:00:00+00');
    insert into activity (kind, actor_id, detail, shared, at) values ('gui-thu', '${A2}', '{"thang": "2026-08"}', true, '2026-09-02 08:00:00+00');
    insert into activity (kind, actor_id, book_id, shared, at) values ('moi-viet', '${A1}', '${B1}', true, '2026-09-03 08:00:00+00');
    insert into thu_thang (account_id, thang, noi_dung, gui_luc) values ('${A2}', '2026-08', 'Thư', '2026-09-02 08:00:00+00');
  `);
}

async function chup(c: PGlite, bang: string): Promise<string[]> {
  return (await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${bang}" t order by 1`)).rows.map((x) => x.r);
}

async function bangCo(c: PGlite): Promise<string[]> {
  return (await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public'")).rows.map((x) => x.t);
}

describe("migration 0019 kho cam xuc", () => {
  it("them mot bang rong; moi dong cu cua moi bang giu nguyen", async () => {
    const c = new PGlite();
    await len(c, 18);
    await gieo(c);
    const bangTruoc = await bangCo(c);
    const truoc = new Map<string, string[]>();
    for (const b of bangTruoc) truoc.set(b, await chup(c, b));
    await len(c, 19);
    const bangSau = await bangCo(c);
    expect(bangSau.filter((b) => !bangTruoc.includes(b))).toEqual(["cam_xuc"]);
    for (const b of bangTruoc) expect(await chup(c, b), b).toEqual(truoc.get(b));
    expect(await chup(c, "cam_xuc")).toEqual([]);
  });

  it("cam_xuc: tam loai dung LOAI_CAM_XUC, loai la va xem truoc khi tha bi CHECK chan", async () => {
    const c = new PGlite();
    await len(c, 19);
    await gieo(c);
    for (const loai of LOAI_CAM_XUC) {
      expect(await rangBuoc(c.exec(`insert into cam_xuc (tu_id, loai) values ('${A1}', '${loai}')`)), loai).toBe("khong loi");
    }
    expect(await rangBuoc(c.exec(`insert into cam_xuc (tu_id, loai) values ('${A1}', 'ghet')`))).toBe("cam_xuc_loai");
    expect(await rangBuoc(c.exec(`insert into cam_xuc (tu_id, loai, luc, da_xem_luc) values ('${A1}', 'yeu', '2026-10-01 08:00:00+00', '2026-10-01 07:00:00+00')`))).toBe("cam_xuc_da_xem");
    expect(await rangBuoc(c.exec(`insert into cam_xuc (tu_id, loai, luc, da_xem_luc) values ('${A1}', 'yeu', '2026-10-01 08:00:00+00', '2026-10-01 08:00:00+00')`))).toBe("khong loi");
    await c.exec(`delete from accounts where id = '${A1}'`);
    expect(await chup(c, "cam_xuc")).toEqual([]);
  });

  it("sau 0019: tha-cam-xuc ghi duoc voi dung hinh dang, sai hinh dang bi CHECK chan; loai cu van ghi nhu truoc", async () => {
    const c = new PGlite();
    await len(c, 18);
    await gieo(c);
    await len(c, 19);
    const tha = (cot: string, giaTri: string) => c.exec(`insert into activity (kind, actor_id${cot}, shared, at) values ('tha-cam-xuc', '${A1}'${giaTri}, true, now())`);
    expect(await rangBuoc(tha(", detail", `, '{"cam": "yeu"}'`))).toBe("khong loi");
    expect(await rangBuoc(tha("", ""))).toBe("activity_detail");
    expect(await rangBuoc(tha(", detail, book_id", `, '{"cam": "yeu"}', '${B1}'`))).toBe("activity_cam_xuc");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, detail, shared, at) values ('tha-cam-xuc', '${A1}', '{"cam": "yeu"}', false, now())`))).toBe("activity_cam_xuc");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, detail, shared, at) values ('gui-thu', '${A1}', '{"thang": "2026-09"}', true, now())`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, book_id, round_id, shared, at) values ('dang-trang', '${A1}', '${B1}', '${R1}', true, now())`))).toBe("khong loi");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, shared, at) values ('dang-trang', '${A1}', true, now())`))).toBe("activity_sach");
    expect(await rangBuoc(c.exec(`insert into activity (kind, actor_id, book_id, shared, at) values ('nhan-viet', '${A1}', '${B1}', true, now())`))).toBe("activity_detail");
  });
});
