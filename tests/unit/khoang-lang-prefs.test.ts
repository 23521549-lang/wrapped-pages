import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { accounts } from "@/server/db/schema";
import { loadMe } from "@/server/identity/me";
import { setKhoangLang } from "@/server/identity/prefs";
import { seedHai } from "../helpers/seed";

/*
 * Co Khoang Lang luu theo tai khoan (task 1): setKhoangLang chi sua dong cua chinh nguoi do,
 * va loadMe tra dung co cua tung nguoi (doc kem trong cung cau select nhu anHoatDong).
 */

describe("co Khoang Lang theo tai khoan", () => {
  it("setKhoangLang chi sua dong cua chinh minh", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setKhoangLang(db, seat1.id, true);
    const rows = await db.select({ id: accounts.id, kl: accounts.khoangLang }).from(accounts);
    const mot = rows.find((r) => r.id === seat1.id);
    const hai = rows.find((r) => r.id === seat2.id);
    expect(mot?.kl).toBe(true);
    expect(hai?.kl).toBe(false);
    await setKhoangLang(db, seat1.id, false);
    const sau = await db.select({ kl: accounts.khoangLang }).from(accounts).where(eq(accounts.id, seat1.id));
    expect(sau[0]?.kl).toBe(false);
  });

  it("loadMe tra dung co Khoang Lang cua tung nguoi, mac dinh false", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setKhoangLang(db, seat1.id, true);
    const me1 = await loadMe(db, seat1.id);
    const me2 = await loadMe(db, seat2.id);
    expect(me1?.khoangLang).toBe(true);
    expect(me2?.khoangLang).toBe(false);
    // Co cu van nguyen: loadMe khong lam mat anHoatDong.
    expect(me1?.anHoatDong).toBe(false);
    expect(me2?.anHoatDong).toBe(false);
  });
});
