import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { accounts } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/errors";

const row = { nickname: "A", passwordHash: "h", secretCipher: "c", createdByDevice: "d" };

describe("isUniqueViolation", () => {
  it("nhan ra loi trung cho ngoi that tu database", async () => {
    const db = await makeTestDb();
    await db.insert(accounts).values({ seat: 1, ...row });
    const e = await db.insert(accounts).values({ seat: 1, ...row }).catch((x: unknown) => x);
    expect(isUniqueViolation(e)).toBe(true);
  });

  it("khong nham loi vi pham check (cho ngoi 3) la loi trung", async () => {
    const db = await makeTestDb();
    const e = await db.insert(accounts).values({ seat: 3, ...row }).catch((x: unknown) => x);
    expect(e).toBeTruthy();
    expect(isUniqueViolation(e)).toBe(false);
  });

  it("loi thuong va gia tri rong thi khong phai loi trung", () => {
    expect(isUniqueViolation(new Error("thieu SERVER_KEY"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
