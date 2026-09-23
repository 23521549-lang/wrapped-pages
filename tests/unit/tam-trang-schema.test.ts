import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { accounts, moods } from "@/server/db/schema";
import { WEATHERS } from "@/lib/tam-trang/troi";
import { viPham } from "../helpers/db";
import { seedHai } from "../helpers/seed";

const T = new Date("2026-09-22T01:00:00.000Z");
const SAU = (ms: number) => new Date(T.getTime() + ms);
const NGAY = 86_400_000;

describe("bang moods", () => {
  it("CHECK moods_weather chua dung cac gia tri cua WEATHERS, cung thu tu, khong thua khong thieu", async () => {
    const { db } = await seedHai();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'moods_weather'`);
    const def = (res.rows as { def: string }[])[0].def;
    expect([...def.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...WEATHERS]);
  });

  it("nhan dong hop le; set_at mac dinh la now() cua database", async () => {
    const { db, seat1 } = await seedHai();
    await db.insert(moods).values({ accountId: seat1.id, weather: "cau-vong", endsAt: sql`now() + interval '24 hours'` });
    const rows = await db.select().from(moods);
    expect(rows).toHaveLength(1);
    expect(rows[0].endsAt.getTime() - rows[0].setAt.getTime()).toBe(NGAY);
    expect(rows[0].note).toBeNull();
    expect(rows[0].withdrawn).toBe(false);
  });

  it("tu choi kieu troi la (moods_weather)", async () => {
    const { db, seat1 } = await seedHai();
    await viPham(db.insert(moods).values({ accountId: seat1.id, weather: "bao-tuyet" as never, setAt: T, endsAt: SAU(NGAY) }), "moods_weather");
  });

  it("loi nhan: rong va 81 ky tu bi tu choi (moods_note); 80 ky tu co dau duoc nhan", async () => {
    const { db, seat1 } = await seedHai();
    const mot = { accountId: seat1.id, weather: "mua-phun" as const, setAt: T, endsAt: SAU(NGAY) };
    await viPham(db.insert(moods).values({ ...mot, note: "" }), "moods_note");
    await viPham(db.insert(moods).values({ ...mot, note: "ữ".repeat(81) }), "moods_note");
    await db.insert(moods).values({ ...mot, note: "ữ".repeat(80) });
    expect(await db.select().from(moods)).toHaveLength(1);
  });

  it("ends_at nam trong [set_at, set_at + 24 gio] (moods_ends_at)", async () => {
    const { db, seat1 } = await seedHai();
    const mot = { accountId: seat1.id, weather: "giong" as const, setAt: T };
    await viPham(db.insert(moods).values({ ...mot, endsAt: SAU(-1) }), "moods_ends_at");
    await viPham(db.insert(moods).values({ ...mot, endsAt: SAU(NGAY + 1) }), "moods_ends_at");
    await db.insert(moods).values({ ...mot, endsAt: T });
    await db.insert(moods).values({ ...mot, endsAt: SAU(NGAY) });
    expect(await db.select().from(moods)).toHaveLength(2);
  });

  it("xoa tai khoan thi tam trang cua nguoi do mat theo, cua nguoi kia con nguyen", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await db.insert(moods).values([
      { accountId: seat1.id, weather: "nang-am", setAt: T, endsAt: SAU(NGAY) },
      { accountId: seat2.id, weather: "suong-mu", setAt: T, endsAt: SAU(NGAY) },
    ]);
    await db.delete(accounts).where(eq(accounts.id, seat1.id));
    expect((await db.select().from(moods)).map((m) => m.accountId)).toEqual([seat2.id]);
  });
});
