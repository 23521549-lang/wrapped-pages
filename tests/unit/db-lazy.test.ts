import { describe, it, expect, vi } from "vitest";

describe("ket noi database luoi", () => {
  it("import khong nem loi khi thieu DATABASE_URL, chi nem khi dung toi", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      vi.resetModules();
      const mod = await import("@/server/db");
      expect(() => mod.db.select).toThrow("thieu DATABASE_URL");
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});
