import { describe, it, expect } from "vitest";
import { hash as argonHash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { createSeat } from "@/server/identity/accounts";
import { renamePartner } from "@/server/identity/rename";
import { recoverCreatedSeat } from "@/server/identity/recover";
import { accounts } from "@/server/db/schema";

const KEY = "khoa-test";
const mk = (over: Partial<Parameters<typeof createSeat>[1]> = {}) => ({
  nickname: "Linh", secret: "ben xe", deviceId: "dev-a", serverKey: KEY, ...over,
});

describe("recoverCreatedSeat", () => {
  it("dung lai dung mat khau vua tao", async () => {
    const db = await makeTestDb();
    const created = await createSeat(db, mk({ deviceId: "dev-a" }));
    const found = await recoverCreatedSeat(db, { deviceId: "dev-a", serverKey: KEY });
    expect(found).toEqual({ seat: created.seat, password: created.password });
  });

  it("thiet bi la khong tao cho nao thi tra null", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ deviceId: "dev-a" }));
    const found = await recoverCreatedSeat(db, { deviceId: "dev-la", serverKey: KEY });
    expect(found).toBeNull();
  });

  it("theo kip lan doi ten: tra ve mat khau MOI sau renamePartner, khong phai mat khau cu", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ deviceId: "dev-a" }));
    await createSeat(db, mk({ nickname: "Manh", secret: "hien nha", deviceId: "dev-b" }));

    const rows = await db.select().from(accounts);
    const actor = rows.find((r) => r.seat === 1)!;

    const renamed = await renamePartner(db, {
      actorAccountId: actor.id, nickname: "Manh Moi", secret: "chuyen tau moi", serverKey: KEY,
    });

    const found = await recoverCreatedSeat(db, { deviceId: "dev-b", serverKey: KEY });
    expect(found).toEqual({ seat: 2, password: renamed.password });
  });

  it("mot thiet bi tao ca hai cho thi tra ve cho tao SAU", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ deviceId: "dev-x" }));
    // Dam bao createdAt cua cho 1 som hon han cho 2, khong le thuoc do phan giai dong ho.
    await db.update(accounts).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(accounts.seat, 1));
    const second = await createSeat(db, mk({ nickname: "Manh", secret: "hien nha", deviceId: "dev-x" }));

    const found = await recoverCreatedSeat(db, { deviceId: "dev-x", serverKey: KEY });
    expect(found).toEqual({ seat: second.seat, password: second.password });
  });

  it("hop dong sinh mat khau vo thi lo ra loi, khong lang le tra null", async () => {
    const db = await makeTestDb();
    await createSeat(db, mk({ deviceId: "dev-a" }));
    const badHash = await argonHash("khong-lien-quan");
    await db.update(accounts).set({ passwordHash: badHash }).where(eq(accounts.seat, 1));

    await expect(
      recoverCreatedSeat(db, { deviceId: "dev-a", serverKey: KEY }),
    ).rejects.toThrow("khong dung lai duoc mat khau cua cho ngoi");
  });
});
