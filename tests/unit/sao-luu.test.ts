import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as schema from "@/server/db/schema";
import {
  CO_XAC_NHAN, CSDL_KIEM_THU, DINH_DANG, kiemCsdlSaoLuu, LoiSaoLuu, PHIEN_BAN, bangTuSchema, docTepSaoLuu, docThamSoKhoiPhuc, ghiTepNguyenTu,
  doThiCsdl, doThiTuSchema, khoiPhuc, kiemTraBanSaoLuu, lapKeHoach, namTrong, saoLuu, saoLuuRaTep, tenTepSaoLuu, thuMucSaoLuu, vietBanSaoLuu,
  type BanSaoLuu, type KetNoi,
} from "@/server/backup/sao-luu";

const BANG = bangTuSchema(schema);

type Pg = Pick<PGlite, "query">;

/** KetNoi qua PGlite, cung duong di voi postgres.js. ghi: nhat ky moi cau lenh da chay. */
function tuPglite(c: PGlite, ghi?: string[]): KetNoi {
  const boc = (x: Pg): KetNoi => ({
    async truyVan(cauLenh, thamSo) {
      ghi?.push(cauLenh);
      return (await x.query(cauLenh, thamSo)).rows as Record<string, unknown>[];
    },
    giaoDich: (fn) => c.transaction((tx) => fn(boc(tx))),
  });
  return boc(c);
}

async function dbMoi(): Promise<PGlite> {
  const c = new PGlite();
  await migrate(drizzle(c, { schema }), { migrationsFolder: "drizzle" });
  return c;
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const B2 = "44444444-4444-4444-8444-444444444444";
const M1 = "55555555-5555-4555-8555-555555555555";
const M2 = "66666666-6666-4666-8666-666666666666";
const S1 = "77777777-7777-4777-8777-777777777777";
const S2 = "88888888-8888-4888-8888-888888888888";
const S3 = "99999999-9999-4999-8999-999999999999";
const R1 = "aaaaaaa1-1111-4111-8111-111111111111";
const R2 = "aaaaaaa2-2222-4222-8222-222222222222";
const R3 = "aaaaaaa3-3333-4333-8333-333333333333";
const DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [
    { type: "text", text: "Chào em 🌸 \"trích\" \\ xuống\ndòng", marks: [{ type: "bold" }] },
    { type: "image", attrs: { src: `/m/${M1}`, width: 1.5, alt: null } },
  ] }],
});
const PEAKS = JSON.stringify(Array.from({ length: 48 }, (_, i) => i * 2));

/**
 * Moi bang co it nhat mot hang (test "pham vi" do dieu nay: them bang moi vao schema thi phai gieo them
 * o day); co ca null, jsonb long, timestamptz le micro giay, vong books <-> media.
 */
async function gieo(c: PGlite) {
  await c.exec(`
    insert into accounts (id, seat, nickname, password_hash, secret_cipher, created_by_device, music_muted, created_at, updated_at) values
      ('${A1}', 1, 'Linh', '$argon2id$v=19$m=1$abc', 'iv:tag:cipher', 'dev-a', true, '2026-01-02 03:04:05.123456+07', now()),
      ('${A2}', 2, 'Nam ''Béo''', 'h2', 'c2', 'dev-b', false, '1999-12-31 23:59:59.999999+00', now());
    insert into secret_history (account_id, secret_cipher, nickname, revealed) values ('${A1}', 'c-old', 'Linh', 1);
    insert into sessions (token, account_id, expires_at) values ('tok-1', '${A2}', '2030-06-01 00:00:00.000001+00');
    insert into login_attempts (device_id, at) values ('dev-x', '2026-02-03 04:05:06.654321+00');
    insert into trusted_devices (device_id, account_id, last_login_at) values ('dev-a', '${A1}', '2026-04-05 06:07:08.9+00');
    insert into books (id, owner_id, title, mode, cover, youtube_id) values
      ('${B1}', '${A1}', 'Sách của mình', 'chia-se', 'nui-xa', 'dQw4w9WgXcQ'),
      ('${B2}', '${A2}', 'Riêng', 'rieng-tu', 'chim-bay', null);
    insert into media (id, owner_id, book_id, kind, mime, bytes, width, height, duration_ms, peaks, store_key) values
      ('${M1}', '${A1}', '${B1}', 'bia', 'image/webp', 1000, 500, 300, null, null, '${B1}/${M1}.webp'),
      ('${M2}', '${A2}', '${B2}', 'ghi-am', 'audio/webm', 2000, null, null, 1234, '${PEAKS}', '${B2}/${M2}.webm');
    update books set cover_media_id = '${M1}' where id = '${B1}';
    insert into media_objects (store_key) values ('cho/${M2}.jpg');
    insert into media_sweeps (id, ran_at) values (1, '2026-03-04 05:06:07.1+00');
    insert into rounds (id, book_id, published_at, edited_at) values
      ('${R1}', '${B1}', '2026-09-01 00:00:00.123456+00', '2026-09-02 03:04:05.654321+00'),
      ('${R2}', '${B1}', '2026-09-03 00:00:00+00', null),
      ('${R3}', '${B1}', '2026-09-04 00:00:00+00', null);
    insert into pages (book_id, round_id, position, content, published_at) values
      ('${B1}', '${R1}', 1, '${DOC}', '2026-09-01 00:00:00.123456+00'),
      ('${B1}', '${R2}', 2, '{"type":"doc","content":[]}', '2026-09-03 00:00:00+00'),
      ('${B1}', '${R3}', 3, '{"type":"doc","content":[]}', '2026-09-04 00:00:00+00');
    insert into drafts (book_id, content, sheet_count) values ('${B2}', '${DOC}', 3);
    insert into read_marks (account_id, book_id, position) values ('${A2}', '${B1}', 2);
    insert into seals (id, book_id, round_id, kind, question, answers, hints, teaser) values
      ('${S1}', '${B1}', '${R1}', 'cau-do', 'Mình gặp nhau ở đâu?', '["hồ tây","Hồ Tây"]', '["nước"]', 'Ngày ấy...');
    insert into seals (id, book_id, round_id, kind, question) values
      ('${S2}', '${B1}', '${R2}', 'trao-doi', 'Kể mình nghe?');
    insert into seals (id, book_id, round_id, kind, opens_at) values
      ('${S3}', '${B1}', '${R3}', 'hen-gio', '2027-01-01 00:00:00+07');
    insert into seal_attempts (seal_id, account_id, guess, correct) values ('${S1}', '${A2}', 'sai', false);
    insert into seal_replies (seal_id, account_id, content) values ('${S2}', '${A2}', '${DOC}');
    insert into activity (kind, actor_id, book_id, seal_id, round_id, shared, at) values
      ('dang-trang', '${A1}', '${B1}', null, '${R1}', true, now()),
      ('thu-sai', '${A2}', '${B1}', '${S1}', '${R1}', true, now());
    insert into activity (kind, actor_id, subject_id, shared, at) values ('doi-mat-khau', '${A1}', '${A2}', false, now());
  `);
}

/** Anh chup doc lap voi co che sao luu (to_jsonb, khong phai ::text) cua moi bang, de so sanh sau khoi phuc. */
async function chup(c: PGlite): Promise<Record<string, string[]>> {
  const kq: Record<string, string[]> = {};
  for (const t of BANG) {
    const ten = getTableName(t);
    const { rows } = await c.query<{ r: string }>(`select to_jsonb(t)::text as r from "${ten}" t order by 1`);
    kq[ten] = rows.map((x) => x.r);
  }
  return kq;
}

let nguon: PGlite;
let ban: BanSaoLuu;

beforeAll(async () => {
  nguon = await dbMoi();
  await gieo(nguon);
  ban = await saoLuu(tuPglite(nguon), new Date("2026-09-18T01:02:03.456Z"));
}, 60000);

describe("pham vi", () => {
  it("moi bang cua schema deu co trong ban sao luu, va moi bang deu co du lieu gieo", () => {
    const tatCa = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable)).map(getTableName);
    expect(tatCa.length).toBeGreaterThan(0);
    expect(Object.keys(ban.bang).sort()).toEqual([...tatCa].sort());
    expect(Object.keys(ban.soHang).sort()).toEqual([...tatCa].sort());
    for (const ten of tatCa) expect(ban.soHang[ten], ten).toBeGreaterThan(0);
  });

  it("do thi khoa ngoai doc tu catalog trung khop voi schema.ts", async () => {
    const tuCsdl = await doThiCsdl(tuPglite(nguon));
    const chuan = (d: Map<string, { cha: string; cot: { ten: string; batBuoc: boolean }[] }[]>) => Object.fromEntries(
      [...d].map(([ten, fks]) => [ten, fks.map((fk) => JSON.stringify(fk)).sort()]),
    );
    expect(chuan(tuCsdl)).toEqual(chuan(doThiTuSchema(BANG)));
  });

  it("thu tu khoi phuc: cha truoc con, khoa ngoai vong chi hoan o cot cho null", () => {
    const { thuTu, hoan } = lapKeHoach(doThiTuSchema(BANG));
    expect([...thuTu].sort()).toEqual(BANG.map(getTableName).sort());
    for (const t of BANG) {
      const ten = getTableName(t);
      for (const fk of getTableConfig(t).foreignKeys) {
        const ref = fk.reference();
        const cha = getTableName(ref.foreignTable);
        if (thuTu.indexOf(cha) < thuTu.indexOf(ten)) continue;
        for (const cot of ref.columns) {
          expect(cot.notNull).toBe(false);
          expect(hoan[ten]).toContain(cot.name);
        }
      }
    }
    // Dung mot vong hien co: books.cover_media_id <-> media.book_id.
    expect(hoan).toEqual({ books: ["cover_media_id"] });
  });

  it("ghi kem danh sach migration da chay, dinh dang va phien ban", async () => {
    const { rows } = await nguon.query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations");
    expect(ban.migrations).toHaveLength(rows[0].n);
    expect(ban.dinhDang).toBe(DINH_DANG);
    expect(ban.phienBan).toBe(PHIEN_BAN);
    expect(ban.taoLuc).toBe("2026-09-18T01:02:03.456Z");
  });
});

describe("sao luu chi doc", () => {
  it("chay trong mot giao dich repeatable read read only, khong co lenh ghi nao", async () => {
    const ghi: string[] = [];
    await saoLuu(tuPglite(nguon, ghi));
    expect(ghi[0]).toBe("set transaction isolation level repeatable read, read only");
    for (const cau of ghi) expect(cau.trimStart()).not.toMatch(/^(insert|update|delete|truncate|drop|alter|create)/i);
  });

  it("giu nguyen van ban cua timestamptz (micro giay) va jsonb", () => {
    const acc = ban.bang.accounts;
    const tao = acc.cot.indexOf("created_at");
    expect(acc.hang.map((h) => h[tao])).toContain("2026-01-01 20:04:05.123456+00");
    const pg = ban.bang.pages;
    expect(pg.hang.some((h) => h[pg.cot.indexOf("content")]?.includes("🌸"))).toBe(true);
    const bk = ban.bang.books;
    expect(bk.hang.some((h) => h[bk.cot.indexOf("youtube_id")] === null)).toBe(true);
  });
});

describe("khoi phuc", () => {
  it("vao database moi da migrate: tung bang giong het ban goc, qua ca tep tren dia", async () => {
    const dich = await dbMoi();
    const thuMuc = await mkdtemp(path.join(tmpdir(), "mqce-sl-"));
    try {
      const { duongDan, soHang } = await saoLuuRaTep(tuPglite(nguon), thuMuc, new Date("2026-09-18T01:02:03Z"));
      expect(path.basename(duongDan)).toBe("mon-qua-cua-em_2026-09-18_01-02-03Z.json");
      expect(await readdir(thuMuc)).toEqual([path.basename(duongDan)]);
      const docLai = await docTepSaoLuu(duongDan);
      const ketQua = await khoiPhuc(tuPglite(dich), docLai);
      expect(ketQua).toEqual(soHang);
      expect(await chup(dich)).toEqual(await chup(nguon));

      const { rows } = await dich.query<{ t: string; c: string; bia: string }>(
        `select (a.created_at at time zone 'UTC')::text as t, p.content::text as c, b.cover_media_id::text as bia
           from accounts a, pages p, books b where a.seat = 1 and p.position = 1 and b.id = '${B1}'`,
      );
      expect(rows[0].t).toBe("2026-01-01 20:04:05.123456");
      expect(JSON.parse(rows[0].c)).toEqual(JSON.parse(DOC));
      expect(rows[0].bia).toBe(M1);
    } finally {
      await rm(thuMuc, { recursive: true, force: true });
      await dich.close();
    }
  }, 60000);

  it("tu choi database dich khong trong, va khong doi gi o do", async () => {
    const truoc = await chup(nguon);
    await expect(khoiPhuc(tuPglite(nguon), ban)).rejects.toThrow(/Database đích không trống: accounts \(2 hàng\)/);
    expect(await chup(nguon)).toEqual(truoc);
  });

  it("tu choi khi danh sach migration khac (thieu, thua, khac nhanh) hoac tap bang khac", async () => {
    const dich = await dbMoi();
    try {
      const thieu = { ...ban, migrations: ban.migrations.slice(0, -1) };
      await expect(khoiPhuc(tuPglite(dich), thieu)).rejects.toThrow(LoiSaoLuu);
      await expect(khoiPhuc(tuPglite(dich), thieu)).rejects.toThrow(/phiên bản web cũ hơn.*git checkout/);
      const thua = { ...ban, migrations: [...ban.migrations, { hash: "x", createdAt: "9999999999999" }] };
      await expect(khoiPhuc(tuPglite(dich), thua)).rejects.toThrow(/thiếu 1 migration cuối.*npm run db:migrate/);
      const khacNhanh = { ...ban, migrations: ban.migrations.map((m, i) => (i === 1 ? { ...m, createdAt: "1" } : m)) };
      await expect(khoiPhuc(tuPglite(dich), khacNhanh)).rejects.toThrow(/khác nhau từ migration thứ 2.*git checkout/);
      const thieuBang = structuredClone(ban);
      delete thieuBang.bang.pages;
      delete thieuBang.soHang.pages;
      await expect(khoiPhuc(tuPglite(dich), thieuBang)).rejects.toThrow(/khác với database đích; database đích thừa: pages/);
      expect(Object.values(await chup(dich)).flat()).toEqual([]);
    } finally {
      await dich.close();
    }
  }, 60000);

  it("chi so created_at, khong so hash: tep .sql doi kieu xuong dong (CRLF/LF) sau khi clone van khoi phuc duoc", async () => {
    const dich = await dbMoi();
    try {
      // Hash la sha256 cua nguyen van tep .sql: cung migration, khac kieu xuong dong thi khac hash.
      const khacHash = { ...ban, migrations: ban.migrations.map((m) => ({ ...m, hash: `${m.hash}-crlf` })) };
      expect(await khoiPhuc(tuPglite(dich), khacHash)).toEqual(ban.soHang);
    } finally {
      await dich.close();
    }
  }, 60000);

  it("chi bao 'dang bi giu' khi khoa bang het gio (55P03); loi khac nem nguyen", async () => {
    const dich = await dbMoi();
    const hongKhoa = (loi: Error & { code?: string }): KetNoi => {
      const goc = tuPglite(dich);
      const boc = (kn: KetNoi): KetNoi => ({
        truyVan: (cau, ts) => (cau.startsWith("lock table") ? Promise.reject(loi) : kn.truyVan(cau, ts)),
        giaoDich: (fn) => kn.giaoDich((tx) => fn(boc(tx))),
      });
      return boc(goc);
    };
    try {
      const hetGio = Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" });
      await expect(khoiPhuc(hongKhoa(hetGio), ban)).rejects.toThrow(/đang bị một kết nối khác giữ/);
      const khac = Object.assign(new Error("permission denied"), { code: "42501" });
      await expect(khoiPhuc(hongKhoa(khac), ban)).rejects.toBe(khac);
    } finally {
      await dich.close();
    }
  }, 60000);

  it("tu choi database chua chay migration", async () => {
    const trang = new PGlite();
    try {
      await expect(khoiPhuc(tuPglite(trang), ban)).rejects.toThrow(/chưa chạy migration/);
    } finally {
      await trang.close();
    }
  });

  it("loi giua chung thi huy ca giao dich: database dich van trong", async () => {
    const dich = await dbMoi();
    try {
      // Hong mot gia tri o bang insert sau cung: moi bang truoc do da vao roi moi vo.
      const { thuTu } = lapKeHoach(await doThiCsdl(tuPglite(dich)));
      const cuoi = thuTu.at(-1)!;
      const hong: BanSaoLuu = structuredClone(ban);
      hong.bang[cuoi].hang[0] = hong.bang[cuoi].hang[0].map(() => "khong-phai-gia-tri");
      await expect(khoiPhuc(tuPglite(dich), hong)).rejects.toThrow();
      expect(Object.values(await chup(dich)).flat()).toEqual([]);
    } finally {
      await dich.close();
    }
  }, 60000);

  it("dat lai sequence va identity sau khoi phuc", async () => {
    const taoBang = async () => {
      const c = new PGlite();
      await c.exec(`
        create schema drizzle;
        create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
        insert into drizzle.__drizzle_migrations (hash, created_at) values ('h1', 1789062645887);
        create table dem (id serial primary key, ten text);
        create table dinh (id integer primary key generated always as identity, ten text);
      `);
      return c;
    };
    const a = await taoBang();
    const b = await taoBang();
    try {
      await a.exec("insert into dem (ten) values ('x'), ('y'), ('z'); insert into dinh (ten) values ('p'), ('q');");
      const bs = await saoLuu(tuPglite(a));
      expect(bs.migrations).toEqual([{ hash: "h1", createdAt: "1789062645887" }]);
      await khoiPhuc(tuPglite(b), bs);
      const r1 = await b.query<{ id: number }>("insert into dem (ten) values ('moi') returning id");
      const r2 = await b.query<{ id: number }>("insert into dinh (ten) values ('moi') returning id");
      expect(r1.rows[0].id).toBe(4);
      expect(r2.rows[0].id).toBe(3);
    } finally {
      await a.close();
      await b.close();
    }
  }, 60000);
});

describe("tep sao luu", () => {
  it("tu choi sai phien ban dinh dang, sai ten dinh dang, va tep bi cat cut", () => {
    const tron = JSON.parse(vietBanSaoLuu(ban)) as Record<string, unknown>;
    expect(kiemTraBanSaoLuu(tron)).toEqual(ban);
    expect(() => kiemTraBanSaoLuu({ ...tron, phienBan: 2 })).toThrow(/phiên bản 2.*phiên bản 1/);
    expect(() => kiemTraBanSaoLuu({ ...tron, dinhDang: "khac" })).toThrow(/không phải bản sao lưu hợp lệ/);
    const catCut = structuredClone(ban);
    catCut.bang.accounts.hang.pop();
    expect(() => kiemTraBanSaoLuu(catCut)).toThrow(/cắt cụt/);
    const lechCot = structuredClone(ban);
    lechCot.bang.pages.hang[0] = lechCot.bang.pages.hang[0].slice(1);
    expect(() => kiemTraBanSaoLuu(lechCot)).toThrow(/hàng của bảng pages hỏng/);
    expect(() => kiemTraBanSaoLuu(null)).toThrow(LoiSaoLuu);
  });

  it("tu choi tep khong phai JSON", async () => {
    const thuMuc = await mkdtemp(path.join(tmpdir(), "mqce-sl-"));
    try {
      const p = path.join(thuMuc, "hong.json");
      await ghiTepNguyenTu(p, vietBanSaoLuu(ban).slice(0, 200));
      await expect(docTepSaoLuu(p)).rejects.toThrow(/không phải JSON/);
      await expect(docTepSaoLuu(path.join(thuMuc, "khong-co.json"))).rejects.toThrow(/Không đọc được tệp/);
    } finally {
      await rm(thuMuc, { recursive: true, force: true });
    }
  });

  it("ghi nguyen tu: khong de lai tep tam, khong ghi de tep da co", async () => {
    const thuMuc = await mkdtemp(path.join(tmpdir(), "mqce-sl-"));
    try {
      const p = path.join(thuMuc, "a.json");
      await ghiTepNguyenTu(p, "mot");
      await expect(ghiTepNguyenTu(p, "hai")).rejects.toThrow(/không ghi đè/);
      expect(await readFile(p, "utf8")).toBe("mot");
      expect(await readdir(thuMuc)).toEqual(["a.json"]);
      await ghiTepNguyenTu(path.join(thuMuc, "b.json"), "ba");
      expect((await readdir(thuMuc)).sort()).toEqual(["a.json", "b.json"]);
    } finally {
      await rm(thuMuc, { recursive: true, force: true });
    }
  });

  it("ten tep theo gio UTC, khong co dau hai cham", () => {
    expect(tenTepSaoLuu(new Date("2026-01-02T03:04:05.678Z"))).toBe("mon-qua-cua-em_2026-01-02_03-04-05Z.json");
  });
});

describe("thu muc va tham so", () => {
  const duAn = path.resolve("/du-an/sach");

  it("mac dinh nam ngay trong thu muc nguoi dung (khong phai Documents), ngoai du an", () => {
    expect(thuMucSaoLuu({}, duAn, path.resolve("/nha/linh"))).toBe(path.join(path.resolve("/nha/linh"), "mon-qua-cua-em-sao-luu"));
    expect(thuMucSaoLuu({ BACKUP_DIR: "  /o/khac  " }, duAn)).toBe(path.resolve("/o/khac"));
  });

  it("tu choi BACKUP_DIR nam trong thu muc du an", () => {
    expect(() => thuMucSaoLuu({ BACKUP_DIR: path.join(duAn, "sao-luu") }, duAn)).toThrow(/trong thư mục dự án/);
    expect(() => thuMucSaoLuu({ BACKUP_DIR: duAn }, duAn)).toThrow(LoiSaoLuu);
    expect(() => thuMucSaoLuu({}, duAn, path.join(duAn, "nha"))).toThrow(LoiSaoLuu);
    expect(namTrong(path.resolve("/du-an/sach-khac"), duAn)).toBe(false);
  });

  it("khoi phuc bat buoc co --xac-nhan va dung mot tep", () => {
    expect(() => docThamSoKhoiPhuc(["a.json"])).toThrow(/Chưa khôi phục/);
    expect(() => docThamSoKhoiPhuc([])).toThrow(/Cần đúng một đường dẫn/);
    expect(() => docThamSoKhoiPhuc(["a.json", "b.json", CO_XAC_NHAN])).toThrow(/Cần đúng một đường dẫn/);
    expect(() => docThamSoKhoiPhuc(["a.json", "--yes"])).toThrow(/Không hiểu tùy chọn/);
    expect(docThamSoKhoiPhuc(["a.json", CO_XAC_NHAN])).toEqual({ tep: "a.json" });
  });
});

describe("kiemCsdlSaoLuu: khong sao luu database kiem thu", () => {
  it("tu choi mqce_e2e voi thong diep chi cach sua, cho qua database khac", () => {
    expect(() => kiemCsdlSaoLuu(CSDL_KIEM_THU)).toThrow(LoiSaoLuu);
    expect(() => kiemCsdlSaoLuu(CSDL_KIEM_THU)).toThrow(/database kiểm thử/);
    expect(() => kiemCsdlSaoLuu("neondb")).not.toThrow();
  });
});
