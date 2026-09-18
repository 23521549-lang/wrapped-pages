import { describe, it, expect, afterEach } from "vitest";
import { is } from "drizzle-orm";
import { PgDatabase } from "drizzle-orm/pg-core";

const SAVED = process.env.DATABASE_URL;

afterEach(() => {
  if (SAVED === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = SAVED;
});

describe("proxy cua db chuyen tiep getPrototypeOf", () => {
  it("is(db, PgDatabase) tra ve dung", async () => {
    process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/khong-can-that";
    const { db } = await import("@/server/db");
    expect(is(db, PgDatabase)).toBe(true);
  });

  it("db instanceof PgDatabase cung dung", async () => {
    process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/khong-can-that";
    const { db } = await import("@/server/db");
    expect(db instanceof PgDatabase).toBe(true);
  });
});
