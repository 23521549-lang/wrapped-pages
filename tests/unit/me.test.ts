import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { seedHai } from "../helpers/seed";
import { accounts } from "@/server/db/schema";
import { loadMe } from "@/server/identity/me";

describe("loadMe", () => {
  it("du hai cho ngoi: tra ban than kem biet danh nguoi kia, o ca hai phia", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await loadMe(db, seat1.id)).toEqual({ accountId: seat1.id, seat: 1, nickname: "Linh", partnerNickname: "Manh" });
    expect(await loadMe(db, seat2.id)).toEqual({ accountId: seat2.id, seat: 2, nickname: "Manh", partnerNickname: "Linh" });
  });

  it("moi co mot cho ngoi thi tra null", async () => {
    const db = await makeTestDb();
    const [row] = await db
      .insert(accounts)
      .values({ seat: 1, nickname: "Linh", passwordHash: "h1", secretCipher: "c1", createdByDevice: "may-manh" })
      .returning();
    expect(await loadMe(db, row.id)).toBeNull();
  });

  it("ma tai khoan khong thuoc cho ngoi nao thi tra null", async () => {
    const { db } = await seedHai();
    expect(await loadMe(db, "0b8f3c2e-4d1a-4f6b-9c3d-2e1f0a9b8c7d")).toBeNull();
  });
});
