import { describe, it, expect } from "vitest";
import { asc, eq } from "drizzle-orm";
import { activity, activitySeen, seals } from "@/server/db/schema";
import { listActivity } from "@/server/feed/list";
import { recordActivity } from "@/server/feed/record";
import { markSeen, SEEN_TOI_DA } from "@/server/feed/seen";
import { setAnHoatDong } from "@/server/identity/prefs";
import { setMood } from "@/server/mood/moods";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

/*
 * markSeen: nguoi xem bao nhung dong Hoat dong vua lot vao mat. May chu chi ghi dong cua NGUOI KIA ma nguoi xem duoc
 * thay (theo dung thayDuoc cua listActivity), seen_at la at cua dong (dong gom thu sai: lan thu moi nhat cua nhom), va
 * khong bao gio lui moc da xem.
 */

const NOW = new Date("2026-09-15T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

/** Hai cho ngoi va hai cuon cua seat1, bo cac dong tao-sach cua buoc dung; mot luot o to 1 cua moi cuon. */
async function bo() {
  const s = await haiCuon();
  const luotChung = await luotChu(s.db, s.chung, 1);
  const luotRieng = await luotChu(s.db, s.rieng, 1);
  await s.db.delete(activity);
  return { ...s, luotChung, luotRieng };
}

/** Id cua dong vua ghi luc at (moi bai dung moc rieng cho tung dong). */
async function idLuc(db: TestDb, at: Date): Promise<string> {
  const [r] = await db.select({ id: activity.id }).from(activity).where(eq(activity.at, at));
  return r.id;
}

async function daXem(db: TestDb, accountId: string) {
  return (await db
    .select({ id: activitySeen.activityId, luc: activitySeen.seenAt })
    .from(activitySeen)
    .where(eq(activitySeen.accountId, accountId))
    .orderBy(asc(activitySeen.seenAt)))
    .map((r) => [r.id, r.luc]);
}

describe("markSeen", () => {
  it("chi ghi dong cua nguoi kia ma nguoi xem thay duoc; bo id sai dang; seen_at bang at cua dong", async () => {
    const { db, seat1, seat2, chung, rieng, luotChung, luotRieng } = await bo();
    await recordActivity(db, { kind: "dang-trang", actorId: seat1.id, at: phut(-9), bookId: chung, roundId: luotChung, mode: "chia-se", sealId: null });
    await recordActivity(db, { kind: "sua-trang", actorId: seat1.id, at: phut(-8), bookId: rieng, roundId: luotRieng, mode: "rieng-tu" });
    await setMood(db, seat2.id, "nang-am", null, phut(-7));
    // Dong ghi san cho mot luc sau now (nhu mo-hen-gio) thi chua hien, nen chua xem duoc.
    await recordActivity(db, { kind: "tao-sach", actorId: seat1.id, at: phut(5), bookId: chung, mode: "chia-se" });
    const [chungId, riengId, minhId, sauId] = await Promise.all([phut(-9), phut(-8), phut(-7), phut(5)].map((at) => idLuc(db, at)));

    await markSeen(db, seat2.id, [chungId, riengId, minhId, sauId, "khong-phai-uuid", chungId], NOW);
    expect(await daXem(db, seat2.id)).toEqual([[chungId, phut(-9)]]);
    expect(await daXem(db, seat1.id)).toEqual([]);
  });

  it(`toi da ${SEEN_TOI_DA} id moi lan, id lap chi tinh mot`, async () => {
    const { db, seat1, seat2, chung } = await bo();
    const ids: string[] = [];
    for (let i = 1; i <= SEEN_TOI_DA + 5; i++) {
      await recordActivity(db, { kind: "tao-sach", actorId: seat1.id, at: phut(-i), bookId: chung, mode: "chia-se" });
      ids.push(await idLuc(db, phut(-i)));
    }
    await markSeen(db, seat2.id, [ids[0], ...ids], NOW);
    expect(new Set((await daXem(db, seat2.id)).map(([id]) => id))).toEqual(new Set(ids.slice(0, SEEN_TOI_DA)));
  });

  it("dong gop cap nhat at thi lai Moi va xem lai duoc; khong bao gio lui moc da xem", async () => {
    const { db, seat1, seat2, chung, luotChung } = await bo();
    await recordActivity(db, { kind: "sua-trang", actorId: seat1.id, at: phut(-10), bookId: chung, roundId: luotChung, mode: "chia-se" });
    const id = await idLuc(db, phut(-10));
    const moi = async () => (await listActivity(db, seat2.id, NOW)).map((i) => i.isNew);
    expect(await moi()).toEqual([true]);
    await markSeen(db, seat2.id, [id], NOW);
    expect(await moi()).toEqual([false]);
    await db.update(activity).set({ at: phut(-1) }).where(eq(activity.id, id));
    expect(await moi()).toEqual([true]);
    await markSeen(db, seat2.id, [id], NOW);
    expect(await daXem(db, seat2.id)).toEqual([[id, phut(-1)]]);
    await db.update(activitySeen).set({ seenAt: phut(60) }).where(eq(activitySeen.activityId, id));
    await markSeen(db, seat2.id, [id], NOW);
    expect(await daXem(db, seat2.id)).toEqual([[id, phut(60)]]);
  });

  it("dong gom thu sai: xem la xem toi lan thu moi nhat cua nhom; them lan thu thi lai Moi; nhom ngay khac khong dong toi", async () => {
    const { db, seat1, seat2, chung, luotChung } = await bo();
    const [cauDo] = await db
      .insert(seals)
      .values({ bookId: chung, roundId: luotChung, kind: "cau-do", question: "Ở đâu?", answers: ["ben xe"], teaser: "" })
      .returning({ id: seals.id });
    const thu = (at: Date) => recordActivity(db, {
      kind: "thu-sai", actorId: seat2.id, at, bookId: chung, roundId: luotChung, mode: "chia-se", sealId: cauDo.id,
    });
    await thu(phut(-24 * 60));
    await thu(phut(-30));
    await thu(phut(-10));
    const moi = async () => (await listActivity(db, seat1.id, NOW)).map((i) => [i.count, i.isNew]);
    expect(await moi()).toEqual([[2, true], [1, true]]);
    const [homNay] = await listActivity(db, seat1.id, NOW);
    await markSeen(db, seat1.id, [homNay.id], NOW);
    expect(await moi()).toEqual([[2, false], [1, true]]);
    await thu(phut(-5));
    expect(await moi()).toEqual([[3, true], [1, true]]);
  });
});

/*
 * An hoat dong (06/10): markSeen di qua thayDuoc nen khong cham dong an. Rieng truy van con tinh moc cua nhom thu sai
 * doc THANG bang activity, khong qua thayDuoc, nen no phai tu loc: khong loc thi moc bi day toi gio cua mot lan thu
 * sai da an, va mot nhom dang hien bi coi la da xem oan.
 */
describe("an hoat dong: markSeen va nhom thu sai", () => {
  it("khong ghi moc da xem cho dong an", async () => {
    const s = await bo();
    await setAnHoatDong(s.db, s.seat1.id, true);
    await recordActivity(s.db, { kind: "tha-cam-xuc", actorId: s.seat1.id, at: NOW, detail: { cam: "yeu" } });
    const id = await idLuc(s.db, NOW);
    await markSeen(s.db, s.seat2.id, [id], NOW);
    expect(await daXem(s.db, s.seat2.id)).toEqual([]);
  });

  it("moc cua nhom thu sai dang hien khong lay gio cua lan thu da an", async () => {
    const { db, seat1, seat2, chung, luotChung } = await bo();
    const [cauDo] = await db
      .insert(seals)
      .values({ bookId: chung, roundId: luotChung, kind: "cau-do", question: "Ở đâu?", answers: ["ben xe"], teaser: "" })
      .returning({ id: seals.id });
    const thu = (at: Date) => recordActivity(db, {
      kind: "thu-sai", actorId: seat2.id, at, bookId: chung, roundId: luotChung, mode: "chia-se", sealId: cauDo.id,
    });
    // Hai lan thu luc chua an (nhom dang hien), roi bat an va thu lan nua cung ngay gio Viet Nam.
    await thu(phut(-40));
    await thu(phut(-35));
    await setAnHoatDong(db, seat2.id, true);
    await thu(phut(-5));

    const [nhom] = await listActivity(db, seat1.id, NOW);
    expect(nhom.count).toBe(2);
    await markSeen(db, seat1.id, [nhom.id], NOW);
    // Moc phai la phut(-35), lan thu moi nhat DANG HIEN, chu khong phai phut(-5) cua lan da an.
    expect((await daXem(db, seat1.id)).map((r) => r[1])).toEqual([phut(-35)]);
  });
});
