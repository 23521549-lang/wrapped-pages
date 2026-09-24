import { PGlite } from "@electric-sql/pglite";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect } from "vitest";
import * as schema from "@/server/db/schema";

/**
 * Dung PGlite - Postgres chay thang trong tien trinh test - nen test van
 * dung dung rang buoc `check` va `unique` cua Postgres that, khong can cai server.
 *
 * Bang duoc tao bang CHINH cac file migration trong drizzle/, cung duong
 * voi database that, nen test khong the lech khoi schema. Migrator chay tung cau lenh
 * mot (tach theo `--> statement-breakpoint`), nen khong vuong gioi han mot cau lenh moi lan goi.
 */
// `Object.values(schema)` suy ra union cac kieu bang cu the (moi bang mot literal
// "name" rieng), nen PgTable (kieu chung) khong gan duoc vao tung phan tu cua union
// do - ep ve unknown[] truoc de type predicate hop le (TS2677). Hanh vi luc chay khong doi.
const TABLES = (Object.values(schema) as unknown[])
  .filter((t): t is PgTable => is(t, PgTable))
  .map((t) => `"${getTableName(t)}"`)
  .join(", ");

let cached: { client: PGlite; db: PgliteDatabase<typeof schema> } | undefined;

/**
 * Tra ve mot database rong.
 * Moi file test dung chung MOT PGlite (Vitest chay moi file trong worker rieng),
 * va moi lan goi deu xoa sach du lieu, nen test nao cung bat dau voi database trong.
 */
export async function makeTestDb() {
  if (!cached) {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    cached = { client, db };
  } else {
    await cached.client.exec(`truncate table ${TABLES} restart identity cascade`);
  }
  return cached.db;
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>;

/**
 * Loi cua database nam trong `cause` cua loi drizzle, kem ten rang buoc bi vi pham. Moi ca so dung ten
 * rang buoc de chung minh dung luat no mang ten: Postgres kiem cac CHECK theo thu tu ten, nen mot hang sai
 * nhieu luat chi bao luat dung dau bang chu cai, va mot ca chi mong "bi tu choi" se van xanh khi chinh
 * luat no can kiem bi xoa mat.
 */
export async function viPham(truyVan: PromiseLike<unknown>, rangBuoc: string) {
  const loi = await truyVan.then(() => null, (e: unknown) => e);
  expect((loi as { cause?: { constraint?: string } } | null)?.cause?.constraint).toBe(rangBuoc);
}

/** Cau hinh giao dich ma readSnapshot mo: moi phep doc gop nhieu bang phai chay duoi dung cau hinh nay. */
export const ANH_CHUP = { isolationLevel: "repeatable read", accessMode: "read only" };

/**
 * Boc db de chung minh moi lan doc di qua mot anh chup. PGlite chi co mot ket noi
 * nen khong dung lai duoc cuoc dua that; thay vao do moi cach doc hay ghi thang tren db deu nem loi, chi
 * `transaction` duoc chuyen tiep toi db that va ghi lai cau hinh. Cac cau lenh ben trong giao dich chay tren tx
 * that. `choPhep` mo rieng tung cua, vi du "insert" cho lenh ghi moc cua markRead.
 */
export function chiQuaAnhChup(db: TestDb, ...choPhep: string[]) {
  const cauHinh: unknown[] = [];
  const cam = new Set(["select", "selectDistinct", "selectDistinctOn", "execute", "query", "insert", "update", "delete", "with", "$with", "$count"]);
  const boc = new Proxy(db, {
    get(goc, ten) {
      if (ten === "transaction") {
        return (fn: Parameters<TestDb["transaction"]>[0], config?: Parameters<TestDb["transaction"]>[1]) => {
          cauHinh.push(config);
          return goc.transaction(fn, config);
        };
      }
      if (typeof ten === "string" && cam.has(ten) && !choPhep.includes(ten)) throw new Error(`doc ngoai anh chup: db.${ten}`);
      const v = Reflect.get(goc, ten, goc);
      return typeof v === "function" ? v.bind(goc) : v;
    },
  });
  return { boc, cauHinh };
}

/** Cua so nho cua PGlite ma phep dem dung toi; hai phuong thuc nay deu la kieu tong quat nen ta ta lai cho gon. */
type KhachPglite = {
  query: (...args: unknown[]) => unknown;
  transaction: (fn: (khach: KhachPglite) => unknown) => unknown;
};

/**
 * Dem SO CAU LENH SQL that ma fn gui xuong database, ke ca cac cau nam trong giao dich. Drizzle gui moi cau qua
 * client.query, con cac cau trong giao dich lai chay tren mot khach rieng do client.transaction trao ra, nen phai
 * dem ca hai cua. Hai phuong thuc bi thay tam roi tra lai o finally, vi ca tep kiem dung chung mot PGlite.
 * Dung de canh ngan sach truy van: mot bai kiem chi nhin ket qua khong bao gio thay duoc mot vong lap truy van.
 */
export async function demCauLenh(fn: () => Promise<unknown>): Promise<number> {
  if (!cached) throw new Error("demCauLenh can makeTestDb chay truoc");
  const client = cached.client as unknown as KhachPglite;
  const goc = { query: client.query.bind(client), transaction: client.transaction.bind(client) };
  let n = 0;
  const demTrong = (khach: KhachPglite): KhachPglite => {
    const q = khach.query.bind(khach);
    khach.query = (...args) => {
      n += 1;
      return q(...args);
    };
    return khach;
  };
  client.query = (...args) => {
    n += 1;
    return goc.query(...args);
  };
  client.transaction = (cb) => goc.transaction((trong) => cb(demTrong(trong)));
  try {
    await fn();
  } finally {
    client.query = goc.query;
    client.transaction = goc.transaction;
  }
  return n;
}
