import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Migration hoi dap tren du lieu cua 0009: tu dung thu muc migration tam (lay nguyen tep va journal cua drizzle/ toi idx
 * cho truoc), chay qua dung migrator cua drizzle. 0010 chi them bang va noi hai CHECK cua activity: moi dong cu phai
 * con nguyen, moi loai su kien cu van hop le, hoi-dap ghi duoc khi co luot va khong co niem phong.
 */

const GOC = "drizzle";
type Muc = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const tam: string[] = [];
afterAll(() => {
  for (const d of tam) rmSync(d, { recursive: true, force: true });
});

function thuMuc(toi: number): string {
  const dich = mkdtempSync(path.join(tmpdir(), "mqce-hoi-dap-"));
  tam.push(dich);
  mkdirSync(path.join(dich, "meta"));
  const journal = JSON.parse(readFileSync(path.join(GOC, "meta", "_journal.json"), "utf8")) as { entries: Muc[] };
  const entries = journal.entries.filter((m) => m.idx <= toi);
  for (const m of entries) copyFileSync(path.join(GOC, `${m.tag}.sql`), path.join(dich, `${m.tag}.sql`));
  writeFileSync(path.join(dich, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dich;
}

const len = (c: PGlite, toi: number) => migrate(drizzle(c), { migrationsFolder: thuMuc(toi) });

/** Ten rang buoc bi vi pham cua lenh, hoac "khong loi". */
async function rangBuoc(p: Promise<unknown>): Promise<string> {
  const e = await p.then(() => null, (x: unknown) => x);
  return (e as { constraint?: string } | null)?.constraint ?? (e === null ? "khong loi" : String(e));
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "b1111111-1111-4111-8111-111111111111";
const R1 = "a1111111-1111-4111-8111-111111111111";
const R2 = "a2222222-2222-4222-8222-222222222222";
const S1 = "c1111111-1111-4111-8111-111111111111";
const DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "To" }] }] });

/** Du lieu cua 0009: mot cuon chia se hai luot, luot hai co cau do; moi loai su kien cu. */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device) values
      ('${A1}', 1, 'Linh', 'h1', 'c1', 'may-a'), ('${A2}', 2, 'Manh', 'h2', 'c2', 'may-b');
    insert into books (id, owner_id, title, mode, cover) values ('${B1}', '${A1}', 'Chuyen chua ke', 'chia-se', 'nui-xa');
    insert into rounds (id, book_id, published_at) values
      ('${R1}', '${B1}', '2026-09-01 08:00:00+00'), ('${R2}', '${B1}', '2026-09-02 08:00:00+00');
    insert into pages (book_id, round_id, position, content, published_at) values
      ('${B1}', '${R1}', 1, '${DOC}', '2026-09-01 08:00:00+00'), ('${B1}', '${R2}', 2, '${DOC}', '2026-09-02 08:00:00+00');
    insert into seals (id, book_id, round_id, kind, question, answers, teaser) values
      ('${S1}', '${B1}', '${R2}', 'cau-do', 'O dau?', '["ben xe"]', '');
    insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values
      ('dang-trang', '${A1}', '${B1}', null, '${R1}', true, '2026-09-01 08:00:00+00'),
      ('dang-trang', '${A1}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 08:00:00+00'),
      ('moi-trao-doi', '${A1}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 08:00:01+00'),
      ('mo-hen-gio', '${A1}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 08:00:02+00'),
      ('thu-sai', '${A2}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 09:00:00+00'),
      ('mo-trang', '${A2}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 09:01:00+00'),
      ('tang-khoa', '${A1}', '${B1}', '${S1}', '${R2}', true, '2026-09-02 09:02:00+00');
    insert into activity (kind, actor_id, subject_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', false, '2026-09-03 00:00:00+00');
  `);
}

async function chup(c: PGlite, bang: string): Promise<string[]> {
  return (await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${bang}" t order by 1`)).rows.map((x) => x.r);
}

async function bangCo(c: PGlite): Promise<string[]> {
  return (await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public'")).rows.map((x) => x.t);
}

describe("migration 0010 hoi dap", () => {
  it("chi them bang round_replies; moi dong cu cua moi bang giu nguyen", async () => {
    const c = new PGlite();
    await len(c, 9);
    await gieo(c);
    const bangTruoc = await bangCo(c);
    const truoc = Object.fromEntries(await Promise.all(bangTruoc.map(async (b) => [b, await chup(c, b)] as const)));
    await len(c, 10);
    expect((await bangCo(c)).sort()).toEqual([...bangTruoc, "round_replies"].sort());
    for (const b of bangTruoc) expect(await chup(c, b), b).toEqual(truoc[b]);
    expect((await c.query("select * from drizzle.__drizzle_migrations")).rows).toHaveLength(11);
  });

  it("sau 0010: hoi-dap ghi duoc voi luot va khong niem phong; loai la, thieu luot, loai gan niem phong ma thieu niem phong van bi chan", async () => {
    const c = new PGlite();
    await len(c, 9);
    await gieo(c);
    await len(c, 10);
    const ghi = (kind: string, seal: string | null, round: string | null) =>
      c.query(`insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values ($1, '${A2}', '${B1}', $2, $3, true, now())`, [kind, seal, round]);
    expect(await rangBuoc(ghi("hoi-dap", null, R1))).toBe("khong loi");
    expect(await rangBuoc(ghi("hoi-dap", S1, R2))).toBe("khong loi");
    expect(await rangBuoc(ghi("hoi-dap", null, null))).toBe("activity_sach");
    // xoa-sach khong nam trong activity_kind: truyen seal_id that (S1) de chi pha DUY NHAT luat kind, khong keo theo
    // activity_niem_phong (loai la thi khong ai biet no can niem phong hay khong, nhung Postgres kiem CHECK theo thu tu
    // ten, activity_kind dung truoc activity_niem_phong theo bang chu cai nen no bao truoc neu ca hai cung sai).
    expect(await rangBuoc(ghi("xoa-sach", S1, R1))).toBe("activity_kind");
    expect(await rangBuoc(ghi("mo-trang", null, R1))).toBe("activity_niem_phong");
    expect(await rangBuoc(c.query(`insert into round_replies (round_id, account_id, body) values ('${R1}', '${A2}', 'Thương ghê')`))).toBe("khong loi");
  });
});
