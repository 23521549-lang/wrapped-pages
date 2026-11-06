import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { activity, activitySeen } from "@/server/db/schema";
import { listActivity } from "@/server/feed/list";
import { markSeen } from "@/server/feed/seen";
import { phienBanKe } from "@/server/feed/version";
import { recordActivity } from "@/server/feed/record";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

const NOW = new Date("2026-09-15T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

/**
 * Khung Hoat dong duoi Khoang Lang (task 3): bat co thi khong con dong nao cua doi phuong, dong cua minh con du,
 * markSeen khong danh dau dong da an, phien ban ke khong doi khi doi phuong lam gi.
 * Moi test deu co kiem soat duong: tat co thi dong doi phuong CO hien.
 */
async function ke() {
  const s = await haiCuon();
  const luot = await luotChu(s.db, s.chung, 1, 2);
  // Cac dong tao-sach do haiCuon ghi ra khong thuoc bai nay.
  await s.db.delete(activity);
  const dang = async (actorId: string, at: Date) =>
    recordActivity(s.db, { actorId, bookId: s.chung, mode: "chia-se", at, roundId: luot, kind: "dang-trang", sealId: null });
  return { ...s, dang };
}

describe("Khoang Lang: khung Hoat dong", () => {
  it("tat co thi dong doi phuong CO hien (kiem soat duong)", async () => {
    const { db, seat1, seat2, dang } = await ke();
    await dang(seat2.id, phut(-10));
    await dang(seat1.id, phut(-5));
    const dong = await listActivity(db, seat1.id, NOW, false);
    expect(dong.map((i) => i.by)).toEqual(["me", "partner"]);
  });

  it("bat co thi het dong cua doi phuong, dong cua minh con du", async () => {
    const { db, seat1, seat2, dang } = await ke();
    await dang(seat2.id, phut(-10));
    await dang(seat1.id, phut(-5));
    const dong = await listActivity(db, seat1.id, NOW, true);
    expect(dong.map((i) => i.by)).toEqual(["me"]);
    expect(dong).toHaveLength(1);
  });

  it("markSeen khong danh dau dong doi phuong da an khi bat co", async () => {
    const { db, seat1, seat2, dang } = await ke();
    await dang(seat2.id, phut(-10));
    const tat = await listActivity(db, seat1.id, NOW, false);
    const idDoiPhuong = tat.find((i) => i.by === "partner")!.id;
    await markSeen(db, seat1.id, [idDoiPhuong], NOW, true);
    const daXem = await db.select().from(activitySeen).where(eq(activitySeen.accountId, seat1.id));
    expect(daXem).toHaveLength(0);
    // Tat co thi danh dau duoc nhu cu.
    await markSeen(db, seat1.id, [idDoiPhuong], NOW, false);
    const sau = await db.select().from(activitySeen).where(eq(activitySeen.accountId, seat1.id));
    expect(sau).toHaveLength(1);
  });

  it("phien ban ke khong doi khi doi phuong lam gi trong luc bat co", async () => {
    const { db, seat1, seat2, dang } = await ke();
    const truoc = await phienBanKe(db, seat1.id, NOW, true);
    await dang(seat2.id, phut(-10));
    expect(await phienBanKe(db, seat1.id, NOW, true)).toBe(truoc);
    // Tat co thi phien ban doi nhu cu (kiem soat duong).
    expect(await phienBanKe(db, seat1.id, NOW, false)).not.toBe(truoc);
  });
});
