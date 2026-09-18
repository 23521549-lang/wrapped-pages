import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "@/server/db/schema";

const META = "drizzle/meta";

describe("schema.ts khop migration moi nhat", () => {
  it("sua schema.ts thi phai sinh migration: khong con cau lenh nao dang cho", async () => {
    const snaps = existsSync(META) ? readdirSync(META).filter((f) => f.endsWith("_snapshot.json")).sort() : [];
    expect(snaps.length, "chua co migration nao, chay npm run db:generate").toBeGreaterThan(0);
    const last = JSON.parse(readFileSync(`${META}/${snaps.at(-1)}`, "utf8"));
    const pending = await generateMigration(last, generateDrizzleJson(schema, last.id));
    expect(pending, "schema.ts co thay doi chua sinh migration, chay npm run db:generate").toEqual([]);
  });
});
