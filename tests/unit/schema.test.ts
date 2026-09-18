import { describe, it, expect } from "vitest";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is, sql } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import * as schema from "@/server/db/schema";
import { accounts } from "@/server/db/schema";

/** Moi bang khai trong schema.ts, tu gom ca bang moi (cung cach tests/helpers/db.ts lam). */
const TABLES = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));

describe("bang accounts", () => {
  it("ghi va doc lai duoc mot cho ngoi", async () => {
    const db = await makeTestDb();
    await db.insert(accounts).values({
      seat: 1, nickname: "Linh", passwordHash: "h",
      secretCipher: "c", createdByDevice: "dev-a",
    });
    const rows = await db.select().from(accounts);
    expect(rows).toHaveLength(1);
    expect(rows[0].seat).toBe(1);
  });

  it("khong cho hai ban ghi cung so cho ngoi", async () => {
    const db = await makeTestDb();
    const row = { nickname: "Linh", passwordHash: "h", secretCipher: "c", createdByDevice: "dev-a" };
    await db.insert(accounts).values({ seat: 1, ...row });
    await expect(
      db.insert(accounts).values({ seat: 1, ...row }),
    ).rejects.toThrow();
  });

  it("khong cho so cho ngoi ngoai 1 va 2", async () => {
    const db = await makeTestDb();
    await expect(
      db.insert(accounts).values({
        seat: 3, nickname: "X", passwordHash: "h",
        secretCipher: "c", createdByDevice: "dev-a",
      }),
    ).rejects.toThrow();
  });

  it("SQL trong makeTestDb khop dung tung cot voi schema.ts", async () => {
    const db = await makeTestDb();
    for (const table of TABLES) {
      const cfg = getTableConfig(table);
      const want = cfg.columns.map((c) => c.name).sort();
      const res = await db.execute(
        sql`select column_name from information_schema.columns where table_name = ${cfg.name}`,
      );
      const got = (res.rows as { column_name: string }[]).map((r) => r.column_name).sort();
      expect(got, `bang ${cfg.name} lech cot`).toEqual(want);
    }
  });

  it("moi lan goi makeTestDb deu tra ve database trong, du dung chung mot PGlite", async () => {
    const a = await makeTestDb();
    await a.insert(accounts).values({
      seat: 1, nickname: "A", passwordHash: "h", secretCipher: "c", createdByDevice: "d",
    });
    const b = await makeTestDb();
    expect(await b.select().from(accounts)).toHaveLength(0);
  });

  it("SQL trong makeTestDb co du cac index ma schema.ts khai bao", async () => {
    const db = await makeTestDb();
    for (const table of TABLES) {
      const cfg = getTableConfig(table);
      const want = cfg.indexes.map((i) => i.config.name).sort();
      const res = await db.execute(
        sql`select indexname from pg_indexes where tablename = ${cfg.name}
            and indexname not in (select conname from pg_constraint)`,
      );
      const got = (res.rows as { indexname: string }[]).map((r) => r.indexname).sort();
      expect(got, `bang ${cfg.name} lech index`).toEqual(want);
    }
  });
});
