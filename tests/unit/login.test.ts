import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { createSeat } from "@/server/identity/accounts";
import { login } from "@/server/identity/login";
import { renamePartner } from "@/server/identity/rename";
import { MAX_FAILS, UNTRUSTED_MAX_FAILS } from "@/server/identity/rate-limit";
import { ghiLanSai } from "../helpers/lan-sai";
import { loginAttempts, trustedDevices } from "@/server/db/schema";

const KEY = "khoa-test";

describe("login", () => {
  it("dung mat khau va khac may nguoi tao thi vao duoc", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    const r = await login(db, { password, deviceId: "may-cua-linh" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.seat).toBe(1);
  });

  it("sai mat khau thi tu choi", async () => {
    const db = await makeTestDb();
    await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY });
    const r = await login(db, { password: "sai-sai-sai-99", deviceId: "may-cua-linh" });
    expect(r).toEqual({ ok: false, reason: "sai-mat-khau" });
  });

  it("chinh may cua nguoi tao thi bi chan, du go dung mat khau", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    const r = await login(db, { password, deviceId: "may-cua-manh" });
    expect(r).toEqual({ ok: false, reason: "nguoi-tao-khong-duoc-vao" });
  });

  it("khong co o ten dang nhap: chi mat khau da chi ra dung chu nhan", async () => {
    const db = await makeTestDb();
    const a = await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-a", serverKey: KEY });
    const b = await createSeat(db, { nickname: "Manh", secret: "hien nha", deviceId: "may-b", serverKey: KEY });
    const ra = await login(db, { password: a.password, deviceId: "may-b" });
    const rb = await login(db, { password: b.password, deviceId: "may-a" });
    expect(ra.ok && ra.seat).toBe(1);
    expect(rb.ok && rb.seat).toBe(2);
  });

  it("sai qua nguong thi bi khoa, ke ca sau do go dung", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    for (let i = 0; i < MAX_FAILS; i++) {
      await login(db, { password: "sai-sai-sai-00", deviceId: "may-la" });
    }
    const r = await login(db, { password, deviceId: "may-la" });
    expect(r).toEqual({ ok: false, reason: "bi-khoa" });
  });

  it("lo hong cu: doi cookie moi sau moi lan sai khong con do mai duoc - toi nguong chung thi trinh duyet la bi chan", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) {
      expect(await login(db, { password: "sai-sai-sai-00", deviceId: `cookie-bo-di-${i}` }))
        .toEqual({ ok: false, reason: "sai-mat-khau" });
    }
    // Ke do co go dung di nua (vi du trung mot mat khau) thi van bi chan: khoa truoc khi xet mat khau.
    expect(await login(db, { password, deviceId: "cookie-moi-tinh" })).toEqual({ ok: false, reason: "khoa-chung" });
  });

  it("dang nhap thanh cong thi trinh duyet thanh tin cay va khong bi mot tran do mat khau khoa ngoai", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    expect((await login(db, { password, deviceId: "may-cua-linh" })).ok).toBe(true);
    expect(await db.select({ d: trustedDevices.deviceId }).from(trustedDevices)).toEqual([{ d: "may-cua-linh" }]);

    for (let i = 0; i < UNTRUSTED_MAX_FAILS * 3; i++) await ghiLanSai(db, `ke-xau-${i}`);
    // Go nham mot lan giua luc bi tan cong van chi nhan "sai", roi go dung thi vao.
    expect(await login(db, { password: "sai-sai-sai-00", deviceId: "may-cua-linh" }))
      .toEqual({ ok: false, reason: "sai-mat-khau" });
    expect((await login(db, { password, deviceId: "may-cua-linh" })).ok).toBe(true);
  });

  it("go dung tren may nguoi tao khong de lai lan sai va khong lam may do thanh tin cay", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    await login(db, { password, deviceId: "may-cua-manh" });
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
    expect(await db.select().from(trustedDevices)).toHaveLength(0);
  });

  it("sai mat khau thi de lai dung mot dong, dang nhap dung khong de lai dong nao va khong xoa lan sai cu", async () => {
    const db = await makeTestDb();
    const { password } = await createSeat(db, {
      nickname: "Linh", secret: "ben xe", deviceId: "may-cua-manh", serverKey: KEY,
    });
    await login(db, { password: "sai-sai-sai-00", deviceId: "may-cua-linh" });
    expect(await db.select().from(loginAttempts)).toHaveLength(1);
    await login(db, { password, deviceId: "may-cua-linh" });
    expect(await db.select().from(loginAttempts)).toHaveLength(1);
  });

  it("nguoi trong cuoc khong do duoc mat khau nguoi kia bang vong 'sai 4 lan, dang nhap dung bang mat khau minh'", async () => {
    const db = await makeTestDb();
    const a = await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-a", serverKey: KEY });
    const b = await createSeat(db, { nickname: "Manh", secret: "hien nha", deviceId: "may-b", serverKey: KEY });
    // Trinh duyet cua nguoi ngoi cho 2 da tin cay (dang nhap dung bang mat khau cua chinh ho).
    expect((await login(db, { password: b.password, deviceId: "may-a" })).ok).toBe(true);

    const ketQua: string[] = [];
    for (let vong = 0; vong < 3; vong++) {
      for (let i = 0; i < MAX_FAILS - 1; i++) {
        const r = await login(db, { password: `doan-${vong}-${i}-00`, deviceId: "may-a" });
        ketQua.push(r.ok ? "vao" : r.reason);
      }
      const r = await login(db, { password: b.password, deviceId: "may-a" });
      ketQua.push(r.ok ? "vao" : r.reason);
    }
    // Chi duoc doan sai toi da MAX_FAILS lan trong cua so, dang nhap dung xen giua khong xoa bo dem.
    expect(ketQua.filter((k) => k === "sai-mat-khau")).toHaveLength(MAX_FAILS);
    expect(ketQua.at(-1)).toBe("bi-khoa");
    // Mat khau nguoi kia go dung luc nay cung bi chan: khoa xet truoc mat khau.
    expect(await login(db, { password: a.password, deviceId: "may-a" })).toEqual({ ok: false, reason: "bi-khoa" });
  });

  it("doi mat khau nguoi kia khong xoa tin cay cua trinh duyet nguoi do: van vao duoc bang mat khau moi giua luc bi tan cong", async () => {
    const db = await makeTestDb();
    const a = await createSeat(db, { nickname: "Linh", secret: "ben xe", deviceId: "may-a", serverKey: KEY });
    const b = await createSeat(db, { nickname: "Manh", secret: "hien nha", deviceId: "may-b", serverKey: KEY });
    const ra = await login(db, { password: a.password, deviceId: "may-b" });
    expect((await login(db, { password: b.password, deviceId: "may-a" })).ok).toBe(true);
    if (!ra.ok) throw new Error("khong dang nhap duoc");

    const { password: moi } = await renamePartner(db, {
      actorAccountId: ra.accountId, nickname: "Manh Moi", secret: "hien nha", serverKey: KEY,
    });
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) await ghiLanSai(db, `ke-xau-${i}`);
    expect(await login(db, { password: b.password, deviceId: "may-a" })).toEqual({ ok: false, reason: "sai-mat-khau" });
    expect((await login(db, { password: moi, deviceId: "may-a" })).ok).toBe(true);
  });
});
