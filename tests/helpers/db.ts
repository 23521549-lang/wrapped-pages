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
