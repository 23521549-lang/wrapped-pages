import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { createSeat } from "@/server/identity/accounts";
import { createSession, readSession, destroySession, SESSION_DAYS } from "@/server/identity/session";
import { accounts, sessions } from "@/server/db/schema";

const KEY = "khoa-test";

async function seed() {
  const db = await makeTestDb();
  await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-a", serverKey: KEY });
  const [row] = await db.select().from(accounts);
  return { db, accountId: row.id };
}

describe("phien dang nhap", () => {
  it("tao roi doc lai duoc", async () => {
    const { db, accountId } = await seed();
    const token = await createSession(db, accountId);
    expect(await readSession(db, token)).toMatchObject({ accountId, seat: 1 });
  });

  it("token bia dat thi tra ve null", async () => {
    const { db } = await seed();
    expect(await readSession(db, "token-bia")).toBeNull();
  });

  it("hai lan tao cho ra hai token khac nhau", async () => {
    const { db, accountId } = await seed();
    expect(await createSession(db, accountId)).not.toBe(await createSession(db, accountId));
  });

  it("het han thi tra ve null", async () => {
    const { db, accountId } = await seed();
    const token = await createSession(db, accountId);
    const sau = new Date(Date.now() + (SESSION_DAYS + 1) * 86400_000);
    expect(await readSession(db, token, sau)).toBeNull();
  });

  it("xoa roi thi tra ve null", async () => {
    const { db, accountId } = await seed();
    const token = await createSession(db, accountId);
    await destroySession(db, token);
    expect(await readSession(db, token)).toBeNull();
  });

  it("database chi luu ban bam cua token, khong luu token that", async () => {
    const { db, accountId } = await seed();
    const token = await createSession(db, accountId);
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].token).not.toBe(token);
    expect(rows[0].token).not.toContain(token);
  });

  it("lay duoc gia tri trong database cung khong dung no lam token duoc", async () => {
    const { db, accountId } = await seed();
    await createSession(db, accountId);
    const [row] = await db.select().from(sessions);
    expect(await readSession(db, row.token)).toBeNull();
  });

  it("dung phien khi da qua nua han thi phien duoc gia han them 90 ngay tu luc do", async () => {
    const { db, accountId } = await seed();
    const t0 = new Date("2026-01-01T00:00:00Z");
    const token = await createSession(db, accountId, t0);
    const t50 = new Date(t0.getTime() + 50 * 86_400_000);
    const s = await readSession(db, token, t50);
    expect(s?.expiresAt.getTime()).toBe(t50.getTime() + SESSION_DAYS * 86_400_000);
    const t100 = new Date(t0.getTime() + 100 * 86_400_000);
    expect(await readSession(db, token, t100)).not.toBeNull();
  });

  it("dung phien khi con hon nua han thi khong doi han", async () => {
    const { db, accountId } = await seed();
    const t0 = new Date("2026-01-01T00:00:00Z");
    const token = await createSession(db, accountId, t0);
    const t10 = new Date(t0.getTime() + 10 * 86_400_000);
    const s = await readSession(db, token, t10);
    expect(s?.expiresAt.getTime()).toBe(t0.getTime() + SESSION_DAYS * 86_400_000);
  });
});
