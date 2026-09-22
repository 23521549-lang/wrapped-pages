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

  it("journal: idx lien nhau tu 0, when tang ngat, moi muc co tep sql va snapshot", () => {
    // Migrator cua drizzle chi chay migration co when lon hon when cua migration cuoi da chay: mot muc moi co when
    // khong lon hon muc truoc se bi bo qua lang le tren database that.
    const journal = JSON.parse(readFileSync(`${META}/_journal.json`, "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
    expect(journal.entries.map((m) => m.idx)).toEqual(journal.entries.map((_, i) => i));
    for (const [i, m] of journal.entries.entries()) {
      if (i > 0) expect(m.when, m.tag).toBeGreaterThan(journal.entries[i - 1].when);
      expect(existsSync(`drizzle/${m.tag}.sql`), m.tag).toBe(true);
      expect(existsSync(`${META}/${m.tag.slice(0, 4)}_snapshot.json`), m.tag).toBe(true);
    }
  });
});
