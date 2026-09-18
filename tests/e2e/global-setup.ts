import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { e2eUrls } from "./env";
import { rethrowSafely } from "./safe-error";

/**
 * Chuan bi database e2e:
 * 1) Dung chuoi cua database app CHI de tao database mqce_e2e neu chua co (khong pha gi).
 * 2) Chay migration that (drizzle/) len database mqce_e2e, giong het cach app that migrate.
 * Ham nay idempotent - goi lai lan nao cung an toan (buoc 1 tu kiem truoc khi tao,
 * migrate cua drizzle tu bo qua migration da ap dung roi).
 */
export default async function globalSetup(): Promise<void> {
  const { appUrl, e2eUrl } = e2eUrls();

  // onnotice tat NOTICE cua Postgres (vd "schema already exists, skipping") de output sach.
  const admin = postgres(appUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await admin`select 1 from pg_database where datname = 'mqce_e2e'`;
    if (rows.length === 0) {
      await admin.unsafe("create database mqce_e2e");
    }
  } catch (e) {
    rethrowSafely(e);
  } finally {
    await admin.end();
  }

  const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } catch (e) {
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}
