import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * Kieu chung cho ca db that (postgres-js) lan db test (PGlite).
 * Moi ham trong src/server/identity/ nhan kieu nay lam tham so,
 * de cung mot ham chay duoc tren database that va database kiem thu.
 */
export type AnyDb = PgDatabase<any, any, any>;
