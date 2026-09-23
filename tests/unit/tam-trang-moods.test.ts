import { describe, it, expect } from "vitest";
import { asc } from "drizzle-orm";
import { moods } from "@/server/db/schema";
import { currentMoods, moodCalendar, setMood, withdrawMood } from "@/server/mood/moods";
import { chiaTamTrang, MOOD_TTL_MS } from "@/lib/tam-trang/lich";
import { seedHai } from "../helpers/seed";

const T = new Date("2026-09-22T01:00:00.000Z");
const SAU = (ms: number) => new Date(T.getTime() + ms);
const PHUT = 60_000;

describe("tha tam trang", () => {
  it("tha: mot dong giu dung 24 gio, la tam trang hien tai cua nguoi do", async () => {
    const { db, seat1 } = await seedHai();
    const m = await setMood(db, seat1.id, "mua-phun", "Nhớ cậu một chút thôi.", T);
    expect(m).toMatchObject({ accountId: seat1.id, weather: "mua-phun", note: "Nhớ cậu một chút thôi.", setAt: T, endsAt: SAU(MOOD_TTL_MS) });
    expect(await currentMoods(db, SAU(PHUT))).toEqual([m]);
  });

  it("tha moi thay tam trang cu: cu ket thuc dung luc thay, lich su giu ca hai, chi mot dong con hieu luc", async () => {
    const { db, seat1 } = await seedHai();
    const cu = await setMood(db, seat1.id, "nang-am", null, T);
    const moi = await setMood(db, seat1.id, "giong", "Nhiều chuyện quá.", SAU(10 * PHUT));
    const rows = await db.select().from(moods).orderBy(asc(moods.setAt));
    // Bi thay khong phai thu lai: dong cu van la lich su cua lich hoa.
    expect(rows.map((r) => r.withdrawn)).toEqual([false, false]);
    expect(rows.map((r) => [r.id, r.endsAt.toISOString()])).toEqual([
      [cu?.id, SAU(10 * PHUT).toISOString()],
      [moi?.id, SAU(10 * PHUT + MOOD_TTL_MS).toISOString()],
    ]);
    expect((await currentMoods(db, SAU(11 * PHUT))).map((m) => m.id)).toEqual([moi?.id]);
  });

  it("tam trang cua nguoi nay khong cham tam trang cua nguoi kia; chia dung theo nguoi xem", async () => {
    const { db, seat1, seat2 } = await seedHai();
    const a = await setMood(db, seat1.id, "cau-vong", null, T);
    const b = await setMood(db, seat2.id, "suong-mu", null, SAU(PHUT));
    const hienTai = await currentMoods(db, SAU(2 * PHUT));
    expect(hienTai).toHaveLength(2);
    expect(chiaTamTrang(hienTai, seat1.id)).toEqual({ minh: a, kia: b });
    expect(chiaTamTrang(hienTai, seat2.id)).toEqual({ minh: b, kia: a });
  });

  it("het han dung 24 gio: truoc do mot mili giay con, dung moc thi het", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "troi-trong", null, T);
    expect(await currentMoods(db, SAU(MOOD_TTL_MS - 1))).toHaveLength(1);
    expect(await currentMoods(db, SAU(MOOD_TTL_MS))).toEqual([]);
  });

  it("tha sau khi het han khong sua dong da het", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "troi-trong", null, T);
    await setMood(db, seat1.id, "may-nhe", null, SAU(MOOD_TTL_MS + PHUT));
    const rows = await db.select().from(moods).orderBy(asc(moods.setAt));
    expect(rows[0].endsAt).toEqual(SAU(MOOD_TTL_MS));
  });

  it("tai khoan khong ton tai: tra null, khong ghi gi", async () => {
    const { db } = await seedHai();
    expect(await setMood(db, "0b8f3c2e-4d1a-4f6b-9c3d-2e1f0a9b8c7d", "nang-am", null, T)).toBeNull();
    expect(await db.select().from(moods)).toEqual([]);
  });
});

describe("thu lai", () => {
  it("thu lai ket thuc ngay, dong van con trong lich su; thu lai lan hai khong co gi de thu", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "mua-rao", null, T);
    expect(await withdrawMood(db, seat1.id, SAU(5 * PHUT))).toBe(true);
    expect(await currentMoods(db, SAU(5 * PHUT))).toEqual([]);
    const [dong] = await db.select().from(moods);
    expect(dong.endsAt).toEqual(SAU(5 * PHUT));
    expect(dong.withdrawn).toBe(true);
    expect(await withdrawMood(db, seat1.id, SAU(6 * PHUT))).toBe(false);
  });

  it("chi thu lai cua chinh minh", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setMood(db, seat2.id, "gio-thoang", null, T);
    expect(await withdrawMood(db, seat1.id, SAU(PHUT))).toBe(false);
    expect(await currentMoods(db, SAU(PHUT))).toHaveLength(1);
  });

  it("dong ho lech (now som hon set_at): ends_at dung bang set_at, khong pham CHECK", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "nang-am", null, T);
    expect(await withdrawMood(db, seat1.id, SAU(-5 * PHUT))).toBe(true);
    const [dong] = await db.select().from(moods);
    expect(dong.endsAt).toEqual(T);
    expect(await currentMoods(db, T)).toEqual([]);
  });
});

describe("lich hoa", () => {
  it("moi nguoi moi ngay gio Viet Nam mot dong: dong tha muon nhat; ranh gioi ngay la 00:00 gio Viet Nam", async () => {
    const { db, seat1, seat2 } = await seedHai();
    // 21.09 23:30 va 22.09 00:10 gio Viet Nam: hai ngay khac nhau du chi cach 40 phut.
    const dem = await setMood(db, seat1.id, "suong-mu", null, new Date("2026-09-21T16:30:00.000Z"));
    await setMood(db, seat1.id, "nang-am", null, new Date("2026-09-21T17:10:00.000Z"));
    const cuoi = await setMood(db, seat1.id, "cau-vong", "Nhẹ cả người.", new Date("2026-09-22T09:00:00.000Z"));
    const kia = await setMood(db, seat2.id, "mua-phun", null, new Date("2026-09-22T14:40:00.000Z"));

    const lich = await moodCalendar(db, { y: 2026, m: 9 });
    const gon = lich.map((d) => [d.accountId === seat1.id ? "a" : "b", d.ngay, d.weather, d.id]).sort();
    expect(gon).toEqual([
      ["a", "2026-09-21", "suong-mu", dem?.id],
      ["a", "2026-09-22", "cau-vong", cuoi?.id],
      ["b", "2026-09-22", "mua-phun", kia?.id],
    ]);
    expect(lich.find((d) => d.id === cuoi?.id)).toMatchObject({ note: "Nhẹ cả người.", setAt: new Date("2026-09-22T09:00:00.000Z") });
  });

  it("thu lai tam trang cuoi ngay: ngay do lui ve tam trang truoc do trong cung ngay, ke ca tam trang da bi thay", async () => {
    const { db, seat1 } = await seedHai();
    const sang = await setMood(db, seat1.id, "nang-am", null, new Date("2026-09-22T01:00:00.000Z"));
    await setMood(db, seat1.id, "cau-vong", "Nhẹ cả người.", new Date("2026-09-22T09:00:00.000Z"));
    expect(await withdrawMood(db, seat1.id, new Date("2026-09-22T09:30:00.000Z"))).toBe(true);
    const lich = await moodCalendar(db, { y: 2026, m: 9 });
    expect(lich.map((d) => [d.ngay, d.weather, d.id])).toEqual([["2026-09-22", "nang-am", sang?.id]]);
  });

  it("thu lai tam trang duy nhat trong ngay thi ngay do trong, cua nguoi kia khong doi", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setMood(db, seat1.id, "suong-mu", null, new Date("2026-09-10T03:00:00.000Z"));
    await withdrawMood(db, seat1.id, new Date("2026-09-10T03:10:00.000Z"));
    const kia = await setMood(db, seat2.id, "may-nhe", null, new Date("2026-09-10T04:00:00.000Z"));
    const lich = await moodCalendar(db, { y: 2026, m: 9 });
    expect(lich.map((d) => [d.accountId, d.ngay, d.id])).toEqual([[seat2.id, "2026-09-10", kia?.id]]);
  });

  it("tam trang bi thay khong phai thu lai: het han roi lich van giu lan tha cuoi ngay", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "nang-am", null, new Date("2026-09-15T01:00:00.000Z"));
    const moi = await setMood(db, seat1.id, "giong", null, new Date("2026-09-15T02:00:00.000Z"));
    // Mot ngay sau ca hai deu da het: thu lai luc nay khong cham dong nao.
    expect(await withdrawMood(db, seat1.id, new Date("2026-09-16T03:00:00.000Z"))).toBe(false);
    const lich = await moodCalendar(db, { y: 2026, m: 9 });
    expect(lich.map((d) => [d.ngay, d.weather, d.id])).toEqual([["2026-09-15", "giong", moi?.id]]);
  });

  it("thang lay dung theo gio Viet Nam: 00:30 ngay 1 thuoc thang moi, 23:30 ngay cuoi thuoc thang cu", async () => {
    const { db, seat1 } = await seedHai();
    await setMood(db, seat1.id, "giong", null, new Date("2026-08-31T16:30:00.000Z"));
    await setMood(db, seat1.id, "nang-am", null, new Date("2026-08-31T17:30:00.000Z"));
    await setMood(db, seat1.id, "may-nhe", null, new Date("2026-09-30T16:59:00.000Z"));
    await setMood(db, seat1.id, "mua-rao", null, new Date("2026-09-30T17:00:00.000Z"));
    expect((await moodCalendar(db, { y: 2026, m: 9 })).map((d) => d.ngay).sort()).toEqual(["2026-09-01", "2026-09-30"]);
    expect((await moodCalendar(db, { y: 2026, m: 8 })).map((d) => d.ngay)).toEqual(["2026-08-31"]);
    expect((await moodCalendar(db, { y: 2026, m: 10 })).map((d) => d.ngay)).toEqual(["2026-10-01"]);
  });

  it("thang khong ai tha thi rong", async () => {
    const { db } = await seedHai();
    expect(await moodCalendar(db, { y: 2026, m: 7 })).toEqual([]);
  });
});
