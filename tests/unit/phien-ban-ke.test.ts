import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { activity, readSheets } from "@/server/db/schema";
import { recordActivity } from "@/server/feed/record";
import { markSeen } from "@/server/feed/seen";
import { phienBanKe } from "@/server/feed/version";
import { setMood, withdrawMood } from "@/server/mood/moods";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

/*
 * Phien ban cua trang Ke sach (spec 5a muc G1): mot chuoi re, doi khi co gi nguoi xem thay duoc vua doi (dong Hoat dong
 * moi hay vua gop, tam trang tha, thu lai hay het han, to minh vua doc them), va KHONG doi khi nguoi xem chi xem (dau Moi).
 */

const NOW = new Date("2026-09-20T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function bo() {
  const s = await haiCuon();
  const luot = await luotChu(s.db, s.chung, 1);
  await s.db.delete(activity);
  return { ...s, luot };
}

describe("phienBanKe", () => {
  it("doi khi nguoi kia co viec moi hay dong gop cap nhat; khong doi khi chi minh xem", async () => {
    const { db, seat1, seat2, chung, luot } = await bo();
    const v0 = await phienBanKe(db, seat2.id, NOW);
    await recordActivity(db, { kind: "sua-trang", actorId: seat1.id, at: phut(-5), bookId: chung, roundId: luot, mode: "chia-se" });
    const v1 = await phienBanKe(db, seat2.id, NOW);
    expect(v1).not.toBe(v0);
    const [dong] = await db.select({ id: activity.id }).from(activity);
    await markSeen(db, seat2.id, [dong.id], NOW);
    expect(await phienBanKe(db, seat2.id, NOW)).toBe(v1);
    await db.update(activity).set({ at: phut(-1) }).where(eq(activity.id, dong.id));
    expect(await phienBanKe(db, seat2.id, NOW)).not.toBe(v1);
  });

  it("dong nguoi xem khong thay duoc khong lam doi phien ban cua ho", async () => {
    const { db, seat1, seat2, rieng } = await bo();
    const luotRieng = await luotChu(db, rieng, 1);
    const v0 = await phienBanKe(db, seat2.id, NOW);
    const cua1 = await phienBanKe(db, seat1.id, NOW);
    await recordActivity(db, { kind: "sua-trang", actorId: seat1.id, at: phut(-5), bookId: rieng, roundId: luotRieng, mode: "rieng-tu" });
    expect(await phienBanKe(db, seat2.id, NOW)).toBe(v0);
    expect(await phienBanKe(db, seat1.id, NOW)).not.toBe(cua1);
  });

  it("tam trang: tha, thu lai, het han deu doi phien ban", async () => {
    const { db, seat1, seat2 } = await bo();
    const v0 = await phienBanKe(db, seat1.id, NOW);
    const m = await setMood(db, seat2.id, "nang-am", null, phut(-10));
    if (!m) throw new Error("khong tha duoc");
    const v1 = await phienBanKe(db, seat1.id, NOW);
    expect(v1).not.toBe(v0);
    await withdrawMood(db, seat2.id, phut(-5));
    const v2 = await phienBanKe(db, seat1.id, NOW);
    expect(v2).not.toBe(v1);
    const m2 = await setMood(db, seat2.id, "mua-phun", null, phut(-4));
    if (!m2) throw new Error("khong tha duoc");
    const v3 = await phienBanKe(db, seat1.id, NOW);
    expect(v3).not.toBe(v2);
    // Het han: tam trang khong con giu, dai troi phai tat ma khong ai lam gi.
    const sauHan = new Date(m2.endsAt.getTime() + 60_000);
    const truocHan = new Date(m2.endsAt.getTime() - 60_000);
    expect(await phienBanKe(db, seat1.id, sauHan)).not.toBe(await phienBanKe(db, seat1.id, truocHan));
  });

  it("to minh vua doc them doi phien ban; dong ghi san toi gio thi doi", async () => {
    const { db, seat1, seat2, chung } = await bo();
    const v0 = await phienBanKe(db, seat2.id, NOW);
    await db.insert(readSheets).values({ accountId: seat2.id, bookId: chung, position: 1 });
    const v1 = await phienBanKe(db, seat2.id, NOW);
    expect(v1).not.toBe(v0);
    await recordActivity(db, { kind: "tao-sach", actorId: seat1.id, at: phut(30), bookId: chung, mode: "chia-se" });
    expect(await phienBanKe(db, seat2.id, NOW)).toBe(v1);
    expect(await phienBanKe(db, seat2.id, phut(31))).not.toBe(v1);
  });
});
