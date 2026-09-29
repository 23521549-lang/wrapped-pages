import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { readingPositions } from "@/server/db/schema";
import { editRound, readRoundForEdit } from "@/server/library/edit-round";
import { readBook } from "@/server/library/pages";
import { savePosition } from "@/server/library/positions";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";

/*
 * Trang dang doc do (spec 5a muc F): moi tai khoan mot vi tri cho moi cuon doc duoc. savePosition kiem quyen doc va
 * trang ton tai; readBook tra vi tri cua dung nguoi xem; sua luot lam so trang doi thi vi tri doi theo nhu read_sheets.
 */

const T = new Date("2026-09-20T08:00:00.000Z");
const GIO = 60 * 60_000;

async function viTri(db: TestDb, accountId: string, bookId: string): Promise<number | null> {
  const [r] = await db
    .select({ p: readingPositions.position })
    .from(readingPositions)
    .where(and(eq(readingPositions.accountId, accountId), eq(readingPositions.bookId, bookId)));
  return r?.p ?? null;
}

describe("savePosition", () => {
  it("chu sach luu o ca cuon rieng tu; nguoi kia luu o cuon chia se; lan sau ghi de, moc cap nhat theo now", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai", "Ba");
    await dang(s.db, s.seat1.id, s.rieng, "Riêng");
    expect(await savePosition(s.db, s.seat1.id, s.rieng, 1, T)).toBe(true);
    expect(await savePosition(s.db, s.seat2.id, s.chung, 2, T)).toBe(true);
    expect(await savePosition(s.db, s.seat2.id, s.chung, 3, new Date(T.getTime() + GIO))).toBe(true);
    expect([await viTri(s.db, s.seat1.id, s.rieng), await viTri(s.db, s.seat2.id, s.chung), await viTri(s.db, s.seat1.id, s.chung)])
      .toEqual([1, 3, null]);
    const [dong] = await s.db.select().from(readingPositions).where(eq(readingPositions.accountId, s.seat2.id));
    expect(dong.updatedAt).toEqual(new Date(T.getTime() + GIO));
  });

  it("khong doc duoc cuon, trang khong ton tai, hay dau vao sai dang thi false va khong ghi gi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
    await dang(s.db, s.seat1.id, s.rieng, "Riêng");
    const sai: [string, string, unknown][] = [
      [s.seat2.id, s.rieng, 1],
      [s.seat2.id, s.chung, 0],
      [s.seat2.id, s.chung, 3],
      [s.seat2.id, s.chung, 1.5],
      [s.seat2.id, s.chung, "1"],
      [s.seat2.id, "khong-phai-uuid", 1],
      [s.seat2.id, "99999999-9999-4999-8999-999999999999", 1],
    ];
    for (const [ai, sach, p] of sai) expect(await savePosition(s.db, ai, sach, p as number, T), `${sach} ${String(p)}`).toBe(false);
    expect(await s.db.select().from(readingPositions)).toEqual([]);
  });
});

describe("readBook: lastPosition", () => {
  it("tra vi tri cua dung nguoi xem; chua co thi null", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai", "Ba");
    await savePosition(s.db, s.seat2.id, s.chung, 3, T);
    expect((await readBook(s.db, s.seat2.id, s.chung))?.lastPosition).toBe(3);
    expect((await readBook(s.db, s.seat1.id, s.chung))?.lastPosition).toBeNull();
  });
});

describe("editRound: doi vi tri dang doc do", () => {
  /** Sua luot thu ordinal cua cuon chung bang cac to mot doan chu, moc sua sau moc dang that. */
  async function sua(s: Awaited<ReturnType<typeof haiCuon>>, ordinal: number, chu: string[]) {
    const r = await readRoundForEdit(s.db, s.seat1.id, s.chung, ordinal);
    if (!r) throw new Error("khong thay luot");
    return editRound(s.db, s.seat1.id, s.chung, r.id, chu.map(to), new Date(r.version), new Date(Date.now() + GIO));
  }

  it("luot dai them: vi tri sau luot cong theo; vi tri trong va truoc luot dung yen", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await dang(s.db, s.seat1.id, s.chung, "C");
    await savePosition(s.db, s.seat2.id, s.chung, 4, T);
    await savePosition(s.db, s.seat1.id, s.chung, 3, T);
    expect(await sua(s, 2, ["B1", "B2", "B3"])).toMatchObject({ status: "saved" });
    expect([await viTri(s.db, s.seat2.id, s.chung), await viTri(s.db, s.seat1.id, s.chung)]).toEqual([5, 3]);
  });

  it("luot ngan lai: vi tri sau luot lui theo; vi tri o phan bi cat thi kep ve to cuoi cua luot", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2", "A3");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await savePosition(s.db, s.seat2.id, s.chung, 5, T);
    await savePosition(s.db, s.seat1.id, s.chung, 3, T);
    expect(await sua(s, 1, ["A1 A2 A3"])).toMatchObject({ status: "saved" });
    expect([await viTri(s.db, s.seat2.id, s.chung), await viTri(s.db, s.seat1.id, s.chung)]).toEqual([3, 1]);
  });
});
