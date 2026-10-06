import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { seedHai } from "../helpers/seed";
import { accounts } from "@/server/db/schema";
import { loadMe } from "@/server/identity/me";
import { setAnHoatDong } from "@/server/identity/prefs";

describe("loadMe", () => {
  it("du hai cho ngoi: tra ban than kem biet danh nguoi kia, o ca hai phia", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await loadMe(db, seat1.id)).toEqual({ accountId: seat1.id, seat: 1, nickname: "Linh", partnerNickname: "Manh", anHoatDong: false });
    expect(await loadMe(db, seat2.id)).toEqual({ accountId: seat2.id, seat: 2, nickname: "Manh", partnerNickname: "Linh", anHoatDong: false });
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

/*
 * An hoat dong (06/10): co nay di kem loadMe chu khong co ham doc rieng, vi cau select cua loadMe von da cham bang
 * accounts va readMe duoc boc cache() theo request. Bai nay khoa viec do lai: co phai den dung nguoi, va chi nguoi do.
 */
describe("loadMe mang co an hoat dong", () => {
  it("co cua ai ve nguoi do, khong lan sang nguoi kia", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setAnHoatDong(db, seat1.id, true);
    expect((await loadMe(db, seat1.id))?.anHoatDong).toBe(true);
    expect((await loadMe(db, seat2.id))?.anHoatDong).toBe(false);
  });

  it("tat lai thi ve false", async () => {
    const { db, seat1 } = await seedHai();
    await setAnHoatDong(db, seat1.id, true);
    await setAnHoatDong(db, seat1.id, false);
    expect((await loadMe(db, seat1.id))?.anHoatDong).toBe(false);
  });
});
