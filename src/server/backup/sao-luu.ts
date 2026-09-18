import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import type { Sql, TransactionSql } from "postgres";
import { open, readFile, rename, rm, mkdir, access, link } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// Module nay chay THANG bang node (type stripping, qua scripts/sao-luu.mjs), khong qua bundler:
// chi import goi npm va node:*, khong import duong dan "@/" hay file tuong doi nao.
// Khong import "server-only": module nay khong bao gio vao bundle cua Next.
//
// Danh sach bang va khoa ngoai lay tu CATALOG cua chinh database dang sao luu/khoi phuc, khong tu
// schema.ts va khong viet tay: ban sao luu chup dung database nhu no dang la (ke ca khi ma nguon da
// di truoc mot migration chua chay), va khong bang nao bi bo sot. Test so do thi khoa ngoai cua
// catalog voi cua schema.ts tren mot database da migrate, va kiem moi bang cua schema co trong tep.

/** Ten dinh dang ghi trong moi tep, de nhan ra dung tep cua web nay. */
export const DINH_DANG = "mon-qua-cua-em/sao-luu";
/** Tang so nay moi khi doi cau truc tep; ban khoi phuc chi doc dung phien ban no biet. */
export const PHIEN_BAN = 1;
/** So hang moi lan insert khi khoi phuc, de mot tham so JSON khong phinh qua lon. */
const HANG_MOI_LO = 500;

export type Hang = Record<string, unknown>;

/**
 * Mot ket noi toi thieu ma phan loi can. Tach khoi postgres.js de test chay bang PGlite
 * qua cung dung duong di nay.
 */
export interface KetNoi {
  truyVan(cauLenh: string, thamSo?: unknown[]): Promise<Hang[]>;
  /** Mo mot giao dich; loi nem ra trong fn thi rollback toan bo. */
  giaoDich<T>(fn: (tx: KetNoi) => Promise<T>): Promise<T>;
}

/** Loi co thong diep danh cho nguoi dung: CLI in nguyen van, khong in gi them. */
export class LoiSaoLuu extends Error {
  constructor(thongDiep: string) {
    super(thongDiep);
    this.name = "LoiSaoLuu";
  }
}

export interface MigrationDaChay {
  hash: string;
  createdAt: string;
}

/**
 * Mot bang trong tep. Moi gia tri la dang VAN BAN cua Postgres (cot::text) hoac null: timestamptz giu du
 * micro giay va mui gio, jsonb giu dung tung chu so, bytea la chuoi \x..., bigint khong qua so thuc cua JS.
 * Khi khoi phuc, Postgres tu doc lai bang ham nhap cua chinh kieu cot, nen khong kieu nao bi lech.
 */
export interface BangSaoLuu {
  cot: string[];
  hang: (string | null)[][];
}

export interface BanSaoLuu {
  dinhDang: typeof DINH_DANG;
  phienBan: typeof PHIEN_BAN;
  taoLuc: string;
  migrations: MigrationDaChay[];
  soHang: Record<string, number>;
  bang: Record<string, BangSaoLuu>;
}

/** Moi bang khai trong mot module schema Drizzle (cung cach tests/helpers/db.ts lam). */
export function bangTuSchema(schema: Record<string, unknown>): PgTable[] {
  return (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));
}

/** Mot khoa ngoai: bang cha va cac cot cua bang con tro toi no. */
export interface KhoaNgoai {
  cha: string;
  cot: { ten: string; batBuoc: boolean }[];
}

/** Do thi khoa ngoai: moi bang kem cac khoa ngoai cua no. */
export type DoThi = Map<string, KhoaNgoai[]>;

/** Do thi khoa ngoai suy tu schema Drizzle (dung de doi chieu voi catalog). */
export function doThiTuSchema(bang: PgTable[]): DoThi {
  return new Map(bang.map((t) => [
    getTableName(t),
    getTableConfig(t).foreignKeys.map((fk) => {
      const ref = fk.reference();
      return { cha: getTableName(ref.foreignTable), cot: ref.columns.map((c) => ({ ten: c.name, batBuoc: c.notNull })) };
    }),
  ]));
}

export interface KeHoach {
  /** Thu tu insert: cha truoc con sau. */
  thuTu: string[];
  /** Cot khoa ngoai tro toi bang CHUA insert (vong tron, tu tro): insert null truoc, cap nhat sau. */
  hoan: Record<string, string[]>;
}

/**
 * Thu tu khoi phuc suy tu do thi khoa ngoai (doc tu catalog cua database), khong viet tay. Moi luot lay cac bang ma moi bang
 * cha deu da insert; khi chi con cum vong tron (books <-> media) thi lay bang con thieu it cha nhat (hoa thi
 * lay bang dung truoc, de thu tu luon on dinh). Khoa ngoai tro toi bang chua insert duoc "hoan": cot do insert null roi
 * cap nhat lai sau khi moi bang da vao, vi khoa ngoai cua du an khong DEFERRABLE. Cot hoan bat buoc cho null.
 */
export function lapKeHoach(doThi: DoThi): KeHoach {
  const chaCua = new Map<string, Set<string>>();
  for (const [ten, fks] of doThi) chaCua.set(ten, new Set(fks.map((fk) => fk.cha)));

  // Thu tu vao cua do thi (catalog tra ve xep theo ten) quyet dinh hoa, nen ket qua on dinh.
  const conLai = [...doThi.keys()];
  const daCo = new Set<string>();
  const thuTu: string[] = [];
  const thieu = (ten: string) => [...(chaCua.get(ten) ?? [])].filter((c) => c !== ten && !daCo.has(c)).length;
  while (conLai.length > 0) {
    const tuDo = conLai.filter((ten) => thieu(ten) === 0);
    const lot = tuDo.length > 0 ? tuDo : [conLai.reduce((a, b) => (thieu(b) < thieu(a) ? b : a))];
    for (const ten of lot) {
      thuTu.push(ten);
      daCo.add(ten);
      conLai.splice(conLai.indexOf(ten), 1);
    }
  }

  const viTri = new Map(thuTu.map((ten, i) => [ten, i]));
  const hoan: Record<string, string[]> = {};
  for (const [ten, fks] of doThi) {
    for (const fk of fks) {
      const viTriCha = viTri.get(fk.cha);
      if (viTriCha !== undefined && viTriCha < viTri.get(ten)!) continue;
      for (const cot of fk.cot) {
        if (cot.batBuoc) {
          throw new LoiSaoLuu(`Không khôi phục được bảng ${ten}: cột ${cot.ten} trỏ vòng mà lại bắt buộc có giá trị.`);
        }
        if (!(hoan[ten] ??= []).includes(cot.ten)) hoan[ten].push(cot.ten);
      }
    }
  }
  return { thuTu, hoan };
}

interface CotCsdl {
  ten: string;
  kieu: string;
  chuoi: string | null;
  dinhDanh: boolean;
}

/**
 * Dang van ban cua timestamptz, ngay gio va so thuc phu thuoc cai dat phien (mui gio, DateStyle...). Chot
 * cung trong giao dich (set local het hieu luc khi giao dich xong) de tep giong nhau o moi may va moi
 * database, va de ham nhap cua Postgres doc lai dung y luc khoi phuc.
 */
async function chotDinhDangVanBan(tx: KetNoi): Promise<void> {
  await tx.truyVan("set local timezone = 'UTC'");
  await tx.truyVan("set local datestyle = 'ISO, YMD'");
  await tx.truyVan("set local intervalstyle = 'postgres'");
  await tx.truyVan("set local extra_float_digits = 3");
  await tx.truyVan("set local bytea_output = 'hex'");
}

const q = (ten: string) => `"${ten.replaceAll('"', '""')}"`;

/** Cot that cua mot bang trong database (bo cot da xoa va cot sinh tu dong), theo thu tu khai bao. */
async function cotCua(kn: KetNoi, bang: string): Promise<CotCsdl[]> {
  const rows = await kn.truyVan(
    `select a.attname as ten, format_type(a.atttypid, a.atttypmod) as kieu,
            pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) as chuoi,
            a.attidentity as dinh_danh
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = $1 and a.attnum > 0
        and not a.attisdropped and a.attgenerated = ''
      order by a.attnum`,
    [bang],
  );
  return rows.map((r) => ({
    ten: String(r.ten),
    kieu: String(r.kieu),
    chuoi: r.chuoi == null ? null : String(r.chuoi),
    dinhDanh: r.dinh_danh === "a" || r.dinh_danh === "d",
  }));
}

async function khoaChinh(kn: KetNoi, bang: string): Promise<string[]> {
  const rows = await kn.truyVan(
    `select a.attname as ten
       from pg_index i
       join pg_class c on c.oid = i.indrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
      where n.nspname = 'public' and c.relname = $1 and i.indisprimary
      order by a.attnum`,
    [bang],
  );
  return rows.map((r) => String(r.ten));
}

async function migrationsCua(kn: KetNoi): Promise<MigrationDaChay[] | null> {
  const [co] = await kn.truyVan(`select to_regclass('drizzle.__drizzle_migrations') is not null as co`);
  if (co?.co !== true) return null;
  const rows = await kn.truyVan(
    `select hash, created_at::text as created_at from drizzle.__drizzle_migrations order by id`,
  );
  return rows.map((r) => ({ hash: String(r.hash), createdAt: String(r.created_at) }));
}

async function bangCongKhai(kn: KetNoi): Promise<string[]> {
  const rows = await kn.truyVan(
    `select c.relname as ten from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname`,
  );
  return rows.map((r) => String(r.ten));
}

/** Moi bang trong schema public cua database, kem khoa ngoai, lay tu catalog. */
export async function doThiCsdl(kn: KetNoi): Promise<DoThi> {
  const doThi: DoThi = new Map((await bangCongKhai(kn)).map((ten) => [ten, []]));
  const rows = await kn.truyVan(
    `select c.relname as con, k.conname as ten_khoa, p.relname as cha, a.attname as cot, a.attnotnull as bat_buoc
       from pg_constraint k
       join pg_class c on c.oid = k.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_class p on p.oid = k.confrelid
       join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
      where k.contype = 'f' and n.nspname = 'public'
      order by c.relname, k.conname, a.attnum`,
  );
  const theoKhoa = new Map<string, KhoaNgoai>();
  for (const r of rows) {
    const con = String(r.con);
    const khoa = `${con}/${String(r.ten_khoa)}`;
    let fk = theoKhoa.get(khoa);
    if (!fk) {
      fk = { cha: String(r.cha), cot: [] };
      theoKhoa.set(khoa, fk);
      doThi.get(con)?.push(fk);
    }
    fk.cot.push({ ten: String(r.cot), batBuoc: r.bat_buoc === true });
  }
  return doThi;
}

/** Tep va database dich phai co dung cung mot tap bang (cung migration thi luon dung; kiem cho chac). */
function kiemCungBang(trongTep: string[], trongCsdl: string[]): void {
  const thieu = trongTep.filter((t) => !trongCsdl.includes(t));
  const thua = trongCsdl.filter((t) => !trongTep.includes(t));
  if (thieu.length > 0 || thua.length > 0) {
    throw new LoiSaoLuu(
      "Bảng trong tệp sao lưu khác với database đích"
        + (thieu.length > 0 ? `; database đích thiếu: ${thieu.join(", ")}` : "")
        + (thua.length > 0 ? `; database đích thừa: ${thua.join(", ")}` : "")
        + ".",
    );
  }
}

/**
 * Chup toan bo database trong DUNG MOT giao dich REPEATABLE READ chi doc: moi bang thay cung mot thoi
 * diem, va giao dich chi doc thi Postgres tu chan moi lenh ghi, du vo tinh co.
 */
export async function saoLuu(kn: KetNoi, luc: Date = new Date()): Promise<BanSaoLuu> {
  return kn.giaoDich(async (tx) => {
    await tx.truyVan("set transaction isolation level repeatable read, read only");
    await chotDinhDangVanBan(tx);

    const migrations = await migrationsCua(tx);
    if (migrations === null) {
      throw new LoiSaoLuu("Database này chưa có bảng migration nào, nên không có gì để sao lưu.");
    }
    const { thuTu } = lapKeHoach(await doThiCsdl(tx));
    if (thuTu.length === 0) throw new LoiSaoLuu("Database này không có bảng nào để sao lưu.");

    const soHang: Record<string, number> = {};
    const duLieu: Record<string, BangSaoLuu> = {};
    for (const ten of thuTu) {
      // oxlint-disable-next-line no-await-in-loop -- mot giao dich chi chay tung cau mot, song song khong nhanh hon
      const cot = (await cotCua(tx, ten)).map((c) => c.ten);
      const chon = cot.map((c, i) => `${q(c)}::text as c${i}`).join(", ");
      const thuTuSapXep = cot.map((_, i) => String(i + 1)).join(", ");
      // oxlint-disable-next-line no-await-in-loop -- nhu tren
      const rows = await tx.truyVan(`select ${chon} from ${q(ten)} order by ${thuTuSapXep}`);
      const hang = rows.map((r) => cot.map((_, i) => {
        const v = r[`c${i}`];
        return v == null ? null : String(v);
      }));
      duLieu[ten] = { cot, hang };
      soHang[ten] = hang.length;
    }

    return { dinhDang: DINH_DANG, phienBan: PHIEN_BAN, taoLuc: luc.toISOString(), migrations, soHang, bang: duLieu };
  });
}

function laMangChuoi(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Kiem cau truc mot tep da doc (JSON.parse) truoc khi dung toi database. */
export function kiemTraBanSaoLuu(v: unknown): BanSaoLuu {
  const hong = (chiTiet: string) => new LoiSaoLuu(`Tệp này không phải bản sao lưu hợp lệ của web (${chiTiet}).`);
  if (typeof v !== "object" || v === null) throw hong("không phải một đối tượng JSON");
  const o = v as Record<string, unknown>;
  if (o.dinhDang !== DINH_DANG) throw hong("sai tên định dạng");
  if (o.phienBan !== PHIEN_BAN) {
    throw new LoiSaoLuu(
      `Tệp sao lưu có định dạng phiên bản ${String(o.phienBan)}, còn mã nguồn này chỉ đọc được phiên bản ${PHIEN_BAN}. `
        + "Hãy dùng đúng phiên bản mã nguồn đã tạo ra tệp.",
    );
  }
  if (typeof o.taoLuc !== "string") throw hong("thiếu thời điểm tạo");
  if (!Array.isArray(o.migrations) || !o.migrations.every(
    (m) => typeof m === "object" && m !== null && typeof m.hash === "string" && typeof m.createdAt === "string",
  )) throw hong("danh sách migration hỏng");
  if (typeof o.soHang !== "object" || o.soHang === null) throw hong("thiếu số hàng");
  if (typeof o.bang !== "object" || o.bang === null) throw hong("thiếu dữ liệu bảng");
  const soHang = o.soHang as Record<string, unknown>;
  const bang = o.bang as Record<string, unknown>;
  for (const [ten, b] of Object.entries(bang)) {
    const bb = b as { cot?: unknown; hang?: unknown } | null;
    if (!bb || !laMangChuoi(bb.cot) || !Array.isArray(bb.hang)) throw hong(`bảng ${ten} hỏng`);
    const soCot = bb.cot.length;
    for (const h of bb.hang) {
      if (!Array.isArray(h) || h.length !== soCot || !h.every((x) => x === null || typeof x === "string")) {
        throw hong(`một hàng của bảng ${ten} hỏng`);
      }
    }
    if (soHang[ten] !== bb.hang.length) throw hong(`số hàng của bảng ${ten} không khớp, tệp có thể bị cắt cụt`);
  }
  if (Object.keys(soHang).length !== Object.keys(bang).length) throw hong("số hàng và danh sách bảng lệch nhau");
  return v as BanSaoLuu;
}

/**
 * Danh tinh cua mot migration la created_at (folderMillis trong drizzle/meta/_journal.json): chinh
 * migrator cua drizzle chi dua vao cot nay de biet migration nao da chay, khong bao gio so hash.
 * Hash la sha256 cua nguyen van tep .sql, nen doi theo kieu xuong dong (CRLF tren Windows, LF noi khac)
 * du noi dung y het: so hash thi mot lan clone lai la du de ban sao luu bi tu choi oan. Hash van ghi
 * trong tep de tham khao, khong dung de so.
 */
function lechMigrations(dich: MigrationDaChay[], tep: MigrationDaChay[]): string | null {
  const n = Math.min(dich.length, tep.length);
  let chung = 0;
  while (chung < n && dich[chung].createdAt === tep[chung].createdAt) chung++;
  if (chung === dich.length && chung === tep.length) return null;
  const dau = `Database đích đã chạy ${dich.length} migration, còn bản sao lưu được tạo lúc có ${tep.length} migration`;
  if (chung === dich.length) {
    return `${dau}: database đích còn thiếu ${tep.length - chung} migration cuối. `
      + "Cập nhật mã nguồn lên bản mới nhất, chạy npm run db:migrate trên database đích, rồi khôi phục lại.";
  }
  const cachLam = "tạo một database trống khác, đưa mã nguồn về đúng phiên bản lúc sao lưu (git checkout <commit lúc đó>), "
    + "chạy npm run db:migrate rồi khôi phục vào đó. Xem mục \"Khi lệnh báo lệch migration\" trong docs/huong-dan-sao-luu.md.";
  if (chung === tep.length) {
    return `${dau}: bản sao lưu đến từ một phiên bản web cũ hơn mã nguồn này. Cách làm: ${cachLam}`;
  }
  return `${dau}, và hai bên khác nhau từ migration thứ ${chung + 1}: bản sao lưu đến từ một nhánh mã nguồn khác. Cách làm: ${cachLam}`;
}

/**
 * Khoi phuc mot ban sao luu vao database o kn, trong DUNG MOT giao dich: loi o bat ky buoc nao thi
 * database tro lai y nhu truoc. Chi chiu khi database dich da chay DUNG cac migration cua ban sao luu
 * va con TRONG hoan toan; khong bao gio ghi de hay tron du lieu.
 */
export async function khoiPhuc(kn: KetNoi, ban: BanSaoLuu): Promise<Record<string, number>> {
  return kn.giaoDich(async (tx) => {
    await chotDinhDangVanBan(tx);
    const migrations = await migrationsCua(tx);
    if (migrations === null || migrations.length === 0) {
      throw new LoiSaoLuu("Database đích chưa chạy migration. Hãy chạy npm run db:migrate trên nó trước, rồi khôi phục lại.");
    }
    const lech = lechMigrations(migrations, ban.migrations);
    if (lech) throw new LoiSaoLuu(lech);
    // Migration da kiem o tren: lech phien ban la nguyen nhan thuong gap nhat, va thong diep cua no chi ro cach sua.
    const { thuTu, hoan } = lapKeHoach(await doThiCsdl(tx));
    kiemCungBang(Object.keys(ban.bang), thuTu);

    // Khoa moi bang tu truoc khi kiem "trong" toi luc commit: ket noi khac (web dang chay, mot lenh khac)
    // van doc duoc nhung khong ghi chen vao giua duoc, nen "trong" luc kiem van dung luc ghi.
    await tx.truyVan("set local lock_timeout = '10s'");
    try {
      await tx.truyVan(`lock table ${thuTu.map(q).join(", ")} in exclusive mode`);
    } catch (loi) {
      // Chi 55P03 (lock_not_available, het lock_timeout) moi la "dang bi giu"; loi khac nem nguyen de khong noi sai ly do.
      if ((loi as { code?: unknown } | null)?.code === "55P03") {
        throw new LoiSaoLuu("Database đích đang bị một kết nối khác giữ (web đang chạy trên nó?). Hãy tắt web rồi chạy lại lệnh.");
      }
      throw loi;
    }

    const coDuLieu: string[] = [];
    for (const ten of thuTu) {
      // oxlint-disable-next-line no-await-in-loop -- mot giao dich chi chay tung cau mot
      const [r] = await tx.truyVan(`select count(*)::int as n from ${q(ten)}`);
      if (Number(r.n) > 0) coDuLieu.push(`${ten} (${String(r.n)} hàng)`);
    }
    if (coDuLieu.length > 0) {
      throw new LoiSaoLuu(
        `Database đích không trống: ${coDuLieu.join(", ")}. Chỉ khôi phục vào một database mới tạo, đã chạy migration và chưa có dữ liệu nào.`,
      );
    }

    const cotCsdl = new Map<string, CotCsdl[]>();
    for (const ten of thuTu) {
      // oxlint-disable-next-line no-await-in-loop -- nhu tren
      const cot = await cotCua(tx, ten);
      const tep = ban.bang[ten].cot;
      if (cot.length !== tep.length || cot.some((c) => !tep.includes(c.ten))) {
        throw new LoiSaoLuu(`Cột của bảng ${ten} trong tệp sao lưu khác với database đích.`);
      }
      cotCsdl.set(ten, cot);
    }

    // Insert cha truoc con sau; cot hoan (khoa ngoai vong) bo ra, cap nhat o buoc sau.
    // Tham so la chuoi JSON, ep qua text truoc: neu Postgres suy ra kieu json cho tham so thi postgres.js
    // se JSON.stringify them mot lan nua va gui sang mot chuoi JSON thay vi mang.
    for (const ten of thuTu) {
      const { cot: tep, hang } = ban.bang[ten];
      const cot = cotCsdl.get(ten)!;
      const boQua = new Set(hoan[ten] ?? []);
      const dung = cot.filter((c) => !boQua.has(c.ten));
      if (dung.length === 0 || hang.length === 0) continue;
      const vao = dung.map((c) => q(c.ten)).join(", ");
      const giaTri = dung.map((c) => `(e->>${tep.indexOf(c.ten)})::${c.kieu}`).join(", ");
      const ghiDe = cot.some((c) => c.dinhDanh) ? " overriding system value" : "";
      for (let i = 0; i < hang.length; i += HANG_MOI_LO) {
        // oxlint-disable-next-line no-await-in-loop -- thu tu insert la dieu kien cua khoa ngoai
        await tx.truyVan(
          `insert into ${q(ten)} (${vao})${ghiDe} select ${giaTri} from json_array_elements($1::text::json) e`,
          [JSON.stringify(hang.slice(i, i + HANG_MOI_LO))],
        );
      }
    }

    for (const [ten, cotHoan] of Object.entries(hoan)) {
      const { cot: tep, hang } = ban.bang[ten];
      if (hang.length === 0) continue;
      const cot = cotCsdl.get(ten)!;
      // oxlint-disable-next-line no-await-in-loop -- nhu tren
      const khoa = await khoaChinh(tx, ten);
      if (khoa.length === 0) throw new LoiSaoLuu(`Bảng ${ten} có cột trỏ vòng nhưng không có khóa chính.`);
      const kieu = (c: string) => cot.find((x) => x.ten === c)!.kieu;
      for (const c of cotHoan) {
        const khop = khoa.map((k) => `${q(ten)}.${q(k)} = (e->>${tep.indexOf(k)})::${kieu(k)}`).join(" and ");
        for (let i = 0; i < hang.length; i += HANG_MOI_LO) {
          // oxlint-disable-next-line no-await-in-loop -- nhu tren
          await tx.truyVan(
            `update ${q(ten)} set ${q(c)} = (e->>${tep.indexOf(c)})::${kieu(c)}
               from json_array_elements($1::text::json) e
              where ${khop} and e->>${tep.indexOf(c)} is not null`,
            [JSON.stringify(hang.slice(i, i + HANG_MOI_LO))],
          );
        }
      }
    }

    // Dat lai sequence/identity (neu co) de hang moi sau khoi phuc khong dung khoa voi hang cu.
    for (const [ten, cot] of cotCsdl) {
      for (const c of cot) {
        if (c.chuoi === null) continue;
        // oxlint-disable-next-line no-await-in-loop -- nhu tren
        await tx.truyVan(
          `select setval($1::regclass, coalesce((select max(${q(c.ten)}) from ${q(ten)}), 1),
                         (select max(${q(c.ten)}) from ${q(ten)}) is not null)`,
          [c.chuoi],
        );
      }
    }

    const ketQua: Record<string, number> = {};
    for (const ten of thuTu) {
      // oxlint-disable-next-line no-await-in-loop -- nhu tren
      const [r] = await tx.truyVan(`select count(*)::int as n from ${q(ten)}`);
      ketQua[ten] = Number(r.n);
      if (ketQua[ten] !== ban.soHang[ten]) {
        throw new LoiSaoLuu(`Bảng ${ten} có ${ketQua[ten]} hàng sau khôi phục, khác ${ban.soHang[ten]} trong tệp. Đã hủy, database đích không đổi.`);
      }
    }
    return ketQua;
  });
}

/** Tep ghi tung hang tren mot dong: doc duoc bang mat, va sai o dau thi thay o dong do. */
export function vietBanSaoLuu(ban: BanSaoLuu): string {
  const dauBang = Object.entries(ban.bang).map(([ten, b]) => {
    const hang = b.hang.map((h) => `      ${JSON.stringify(h)}`).join(",\n");
    return `    ${JSON.stringify(ten)}: {\n      "cot": ${JSON.stringify(b.cot)},\n      "hang": [${hang ? `\n${hang}\n    ` : ""}]\n    }`;
  }).join(",\n");
  return `{\n  "dinhDang": ${JSON.stringify(ban.dinhDang)},\n  "phienBan": ${ban.phienBan},\n`
    + `  "taoLuc": ${JSON.stringify(ban.taoLuc)},\n  "migrations": ${JSON.stringify(ban.migrations, null, 2).replaceAll("\n", "\n  ")},\n`
    + `  "soHang": ${JSON.stringify(ban.soHang, null, 2).replaceAll("\n", "\n  ")},\n`
    + `  "bang": {\n${dauBang}\n  }\n}\n`;
}

const khongGhiDe = (duongDan: string) => new LoiSaoLuu(`Đã có tệp ${duongDan}, không ghi đè.`);

/**
 * Ghi nguyen tu: ghi het vao tep tam canh do, ep xuong dia, roi moi dua vao ten that. Mat dien giua
 * chung thi chi con tep tam do dang, khong bao gio co mot tep sao luu nhin nhu du ma thieu du lieu.
 *
 * Khong ghi de tep da co: dua vao ten that bang link (hard link), vi link that bai voi EEXIST neu ten
 * da co, kiem va tao la mot buoc duy nhat cua he dieu hanh. rename thi khong duoc: tren Windows no
 * thay the tep dich (MoveFileEx REPLACE_EXISTING). link hong vi bat ky ly do nao khac EEXIST thi lui ve
 * kiem truoc roi rename: he tep khong co hard link bao loi bang nhieu ma khac nhau tuy he dieu hanh (tren
 * Windows, FAT32/exFAT tren USB ra EISDIR chu khong phai EPERM), nen khong liet ke ma. Ten tep co ngay gio
 * toi tung giay nen khe ho giua kiem va rename chi la ly thuyet.
 */
export async function ghiTepNguyenTu(duongDan: string, noiDung: string): Promise<void> {
  if (await access(duongDan).then(() => true, () => false)) throw khongGhiDe(duongDan);
  const tam = `${duongDan}.${process.pid}.tam`;
  const f = await open(tam, "wx", 0o600);
  try {
    await f.writeFile(noiDung, "utf8");
    await f.sync();
  } catch (loi) {
    await f.close();
    await rm(tam, { force: true });
    throw loi;
  }
  await f.close();
  try {
    try {
      await link(tam, duongDan);
    } catch (loi) {
      const ma = (loi as { code?: unknown } | null)?.code;
      if (ma === "EEXIST") throw khongGhiDe(duongDan);
      if (await access(duongDan).then(() => true, () => false)) throw khongGhiDe(duongDan);
      await rename(tam, duongDan);
    }
  } finally {
    await rm(tam, { force: true });
  }
}

function nam(p: string): string {
  const r = path.resolve(p);
  return process.platform === "win32" ? r.toLowerCase() : r;
}

/** p nam trong (hoac chinh la) thu muc goc. */
export function namTrong(p: string, goc: string): boolean {
  const rel = path.relative(nam(goc), nam(p));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Thu muc chua ban sao luu: BACKUP_DIR neu co, khong thi mon-qua-cua-em-sao-luu ngay trong thu muc nguoi
 * dung (C:\Users\<ten>\mon-qua-cua-em-sao-luu tren Windows). Khong dung Documents: tren may co OneDrive,
 * Documents that nam o OneDrive\Documents, con homedir()/Documents la mot thu muc cu Explorer khong hien;
 * thu muc nguoi dung thi mot duong dan duy nhat, va mac dinh khong duoc dong bo len may chu nao.
 * Ban sao luu chua moi trang viet, ma bam mat khau va loi nhan da ma hoa, nen KHONG BAO GIO duoc nam
 * trong thu muc du an (de lo tay commit hay day len git).
 */
export function thuMucSaoLuu(env: Record<string, string | undefined>, thuMucDuAn: string, nha: string = homedir()): string {
  const chon = env.BACKUP_DIR?.trim() ? path.resolve(env.BACKUP_DIR.trim()) : path.join(nha, "mon-qua-cua-em-sao-luu");
  if (namTrong(chon, thuMucDuAn)) {
    throw new LoiSaoLuu("BACKUP_DIR đang trỏ vào trong thư mục dự án. Bản sao lưu phải nằm ngoài dự án để không bao giờ lọt vào git.");
  }
  return chon;
}

/** Ten tep theo gio UTC, sap xep theo ten la theo thoi gian. */
export function tenTepSaoLuu(luc: Date): string {
  const s = luc.toISOString().replace(/\.\d+Z$/, "Z").replaceAll(":", "-").replace("T", "_");
  return `mon-qua-cua-em_${s}.json`;
}

export const CO_XAC_NHAN = "--xac-nhan";

/** Doc tham so cua lenh khoi phuc: dung mot duong dan tep va co --xac-nhan bat buoc. */
export function docThamSoKhoiPhuc(argv: string[]): { tep: string } {
  const tep = argv.filter((a) => !a.startsWith("--"));
  const la = argv.filter((a) => a.startsWith("--") && a !== CO_XAC_NHAN);
  if (la.length > 0) throw new LoiSaoLuu(`Không hiểu tùy chọn: ${la.join(" ")}.`);
  if (tep.length !== 1) {
    throw new LoiSaoLuu(`Cần đúng một đường dẫn tệp sao lưu. Cách dùng: npm run db:restore -- <tệp> ${CO_XAC_NHAN}`);
  }
  if (!argv.includes(CO_XAC_NHAN)) {
    throw new LoiSaoLuu(
      `Chưa khôi phục: lệnh này ghi toàn bộ dữ liệu vào database ở DATABASE_URL. Kiểm tra lại DATABASE_URL đang trỏ đúng database mới, `
        + `rồi chạy lại kèm ${CO_XAC_NHAN}: npm run db:restore -- "${tep[0]}" ${CO_XAC_NHAN}`,
    );
  }
  return { tep: tep[0] };
}

/** Doc va kiem mot tep sao luu tren dia. */
export async function docTepSaoLuu(duongDan: string): Promise<BanSaoLuu> {
  let noiDung: string;
  try {
    noiDung = await readFile(duongDan, "utf8");
  } catch {
    throw new LoiSaoLuu(`Không đọc được tệp ${duongDan}. Kiểm tra lại đường dẫn.`);
  }
  let v: unknown;
  try {
    v = JSON.parse(noiDung);
  } catch {
    throw new LoiSaoLuu(`Tệp ${duongDan} không phải JSON đọc được, có thể đã bị cắt cụt hoặc sửa tay.`);
  }
  return kiemTraBanSaoLuu(v);
}

/** Ten database ma e2e tu tao va xoa sach moi lan chay (tests/e2e/env.ts). */
export const CSDL_KIEM_THU = "mqce_e2e";

/**
 * Chan sao luu database kiem thu: ban sao luu do vo dung, va viec DATABASE_URL tro vao no nghia la cau hinh
 * dang sai (vd lay nham chuoi ket noi tren Neon), nen database that dang khong duoc sao luu ma khong ai hay.
 */
export function kiemCsdlSaoLuu(ten: string): void {
  if (ten === CSDL_KIEM_THU) {
    throw new LoiSaoLuu(
      `DATABASE_URL đang trỏ vào database kiểm thử "${CSDL_KIEM_THU}", không phải database thật của web. Sửa tên database ở cuối chuỗi DATABASE_URL trong .env.local (ví dụ /neondb) rồi chạy lại.`,
    );
  }
}

/** Sao luu roi ghi ra thu muc; doc lai tep vua ghi va kiem lai truoc khi bao xong. */
export async function saoLuuRaTep(kn: KetNoi, thuMuc: string, luc: Date = new Date()) {
  const ban = await saoLuu(kn, luc);
  await mkdir(thuMuc, { recursive: true });
  const duongDan = path.join(thuMuc, tenTepSaoLuu(luc));
  await ghiTepNguyenTu(duongDan, vietBanSaoLuu(ban));
  try {
    const docLai = await docTepSaoLuu(duongDan);
    for (const [ten, n] of Object.entries(ban.soHang)) {
      if (docLai.bang[ten]?.hang.length !== n) throw new LoiSaoLuu(`Đọc lại tệp vừa ghi thấy lệch ở bảng ${ten}.`);
    }
  } catch (loi) {
    // Doc lai khong khop thi xoa tep: khong de lai mot tep nhin nhu ban sao luu du ma khong dung.
    await rm(duongDan, { force: true });
    throw loi;
  }
  return { duongDan, soHang: ban.soHang };
}

/** Boc postgres.js thanh KetNoi. */
export function tuPostgres(sql: Sql | TransactionSql): KetNoi {
  return {
    async truyVan(cauLenh, thamSo = []) {
      return (await sql.unsafe(cauLenh, thamSo as never[])) as unknown as Hang[];
    },
    giaoDich(fn) {
      if (!("begin" in sql)) throw new Error("giao dich long nhau khong ho tro");
      return sql.begin((tx) => fn(tuPostgres(tx))) as Promise<never>;
    },
  };
}
