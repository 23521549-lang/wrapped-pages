import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { createSeat } from "@/server/identity/accounts";
import { renamePartner, readSecretHistory, revealSecret, readRevealedSecrets } from "@/server/identity/rename";
import { login } from "@/server/identity/login";
import { accounts } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

const KEY = "khoa-test";

async function seedHai() {
  const db = await makeTestDb();
  const a = await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-manh", serverKey: KEY });
  const b = await createSeat(db, { nickname: "Manh", secret: "hien nha", deviceId: "may-linh", serverKey: KEY });
  const rows = await db.select().from(accounts);
  const seat1 = rows.find((r) => r.seat === 1)!;
  const seat2 = rows.find((r) => r.seat === 2)!;
  return { db, a, b, seat1, seat2 };
}

describe("doi biet danh va loi nhan", () => {
  it("doi biet danh thi mat khau nguoi kia doi theo", async () => {
    const { db, a, seat2 } = await seedHai();
    const r = await renamePartner(db, {
      actorAccountId: seat2.id, nickname: "Linh Nhi", secret: "ben xe", serverKey: KEY,
    });
    expect(r.password).not.toBe(a.password);
    const ok = await login(db, { password: r.password, deviceId: "may-linh" });
    expect(ok.ok).toBe(true);
  });

  it("mat khau cu het dung sau khi doi", async () => {
    const { db, a, seat2 } = await seedHai();
    await renamePartner(db, { actorAccountId: seat2.id, nickname: "Linh Nhi", secret: "ben xe", serverKey: KEY });
    const r = await login(db, { password: a.password, deviceId: "may-linh" });
    expect(r).toEqual({ ok: false, reason: "sai-mat-khau" });
  });

  it("moi lan doi deu ghi them mot ban vao lich su", async () => {
    const { db, seat2 } = await seedHai();
    await renamePartner(db, { actorAccountId: seat2.id, nickname: "Linh", secret: "quan ca phe cu", serverKey: KEY });
    const h = await readSecretHistory(db, { actorAccountId: seat2.id, serverKey: KEY });
    expect(h).toHaveLength(2);
    expect(h[0].secret).toBe("quan ca phe cu");
    expect(h[1].secret).toBe("ben xe");
  });

  it("mac dinh khong ban nao duoc lo ra", async () => {
    const { db, seat1, seat2 } = await seedHai();
    const h = await readSecretHistory(db, { actorAccountId: seat2.id, serverKey: KEY });
    expect(h.every((x) => !x.revealed)).toBe(true);
    expect(await readRevealedSecrets(db, { accountId: seat1.id, serverKey: KEY })).toEqual([]);
  });

  it("bam Gui loi nhan thi dung ban do lo ra cho nguoi kia, cac ban khac van kin", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await renamePartner(db, { actorAccountId: seat2.id, nickname: "Linh", secret: "quan ca phe cu", serverKey: KEY });
    const h = await readSecretHistory(db, { actorAccountId: seat2.id, serverKey: KEY });
    await revealSecret(db, { actorAccountId: seat2.id, historyId: h[1].id });

    const seen = await readRevealedSecrets(db, { accountId: seat1.id, serverKey: KEY });
    expect(seen.map((x) => x.secret)).toEqual(["ben xe"]);
  });

  it("khong doi duoc biet danh cua chinh minh", async () => {
    const { db, seat1 } = await seedHai();
    // seat1 la tai khoan do nguoi mo dau tao ra; chu nhan cua no la nguoi ngoi seat1.
    // Neu chinh seat1 goi renamePartner voi actor la seat1 thi ham phai nham vao seat2, khong nham vao seat1.
    const r = await renamePartner(db, { actorAccountId: seat1.id, nickname: "Ten Moi", secret: "gi do", serverKey: KEY });
    const [self] = await db.select().from(accounts).where(eq(accounts.id, seat1.id));
    expect(self.nickname).toBe("Linh");
    expect(r.password).toBeTruthy();
  });

  it("mat khau moi cua nguoi kia khong bao gio trung mat khau cua chinh nguoi doi", async () => {
    const { db, b, seat2 } = await seedHai();
    // seat2 dat cho seat1 dung bo biet danh + loi nhan da sinh ra mat khau cua CHINH seat2
    const r = await renamePartner(db, {
      actorAccountId: seat2.id, nickname: "Manh", secret: "hien nha", serverKey: KEY,
    });
    expect(r.password).not.toBe(b.password);
    const vaoSeat1 = await login(db, { password: r.password, deviceId: "may-thu-ba" });
    const vaoSeat2 = await login(db, { password: b.password, deviceId: "may-thu-ba" });
    expect(vaoSeat1.ok && vaoSeat1.seat).toBe(1);
    expect(vaoSeat2.ok && vaoSeat2.seat).toBe(2);
  });

  it("nguoi thao tac khong ton tai thi tu choi va khong doi ten ai ca", async () => {
    const { db } = await seedHai();
    await expect(renamePartner(db, {
      actorAccountId: "00000000-0000-0000-0000-000000000000",
      nickname: "X", secret: "gi do", serverKey: KEY,
    })).rejects.toThrow("khong tim thay nguoi dang thao tac");
    const rows = await db.select().from(accounts);
    expect(rows.map((r) => r.nickname).sort()).toEqual(["Linh", "Manh"]);
  });

  it("neu ghi lich su hong thi mat khau cua nguoi kia khong doi", async () => {
    const { db, a, seat2 } = await seedHai();
    await db.execute(sql`alter table secret_history add constraint ep_loi check (false) not valid`);
    try {
      await expect(renamePartner(db, {
        actorAccountId: seat2.id, nickname: "Linh Nhi", secret: "ben xe", serverKey: KEY,
      })).rejects.toThrow();
    } finally {
      await db.execute(sql`alter table secret_history drop constraint ep_loi`);
    }
    const r = await login(db, { password: a.password, deviceId: "may-thu-ba" });
    expect(r.ok && r.seat).toBe(1);
  });
});
