import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { roundAt } from "@/lib/round";
import { pages, rounds } from "@/server/db/schema";
import { readBook } from "@/server/library/pages";
import { roundFirst, roundsOfBook } from "@/server/library/rounds";
import { giftKey } from "@/server/seal/unlock";
import { sealsOfBook } from "@/server/seal/seals";
import { dang, haiCuon } from "../helpers/library";
import { CAU_DO, dangNiemPhong, henGio } from "../helpers/seal";

describe("luot dang", () => {
  it("moi lan dang la mot luot: so thu tu, khoang to, moc dang chung cua cac to", async () => {
    const { db, seat1, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Một", "Hai");
    await dang(db, seat1.id, chung, "Ba");
    await dang(db, seat1.id, chung, "Bốn", "Năm", "Sáu");
    const luot = await roundsOfBook(db, chung);
    expect(luot.map((r) => [r.ordinal, r.first, r.last, r.editedAt])).toEqual([[1, 1, 2, null], [2, 3, 3, null], [3, 4, 6, null]]);
    const cacTo = await db.select({ roundId: pages.roundId, publishedAt: pages.publishedAt }).from(pages).where(eq(pages.bookId, chung));
    for (const r of luot) {
      const cua = cacTo.filter((t) => t.roundId === r.id);
      expect(cua.length).toBe(r.last - r.first + 1);
      expect(cua.every((t) => t.publishedAt.getTime() === r.publishedAt.getTime())).toBe(true);
    }
    expect(roundAt(luot, 5)?.ordinal).toBe(3);
    expect(roundAt(luot, 7)).toBeUndefined();
    expect(await roundFirst(db, luot[2].id)).toBe(4);
  });

  it("cuon chua co to nao thi khong co luot nao", async () => {
    const { db, chung } = await haiCuon();
    expect(await roundsOfBook(db, chung)).toEqual([]);
  });

  it("niem phong lay khoang to tu luot cua no", async () => {
    const { db, seat1, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Một");
    await dangNiemPhong(db, seat1.id, chung, CAU_DO, "Hai", "Ba");
    const [s] = await sealsOfBook(db, chung);
    const [, luot2] = await roundsOfBook(db, chung);
    expect([s.roundId, s.firstPosition, s.lastPosition]).toEqual([luot2.id, 2, 3]);
  });

  it("readBook: to mang luot cua no, moc sua lay tu luot, to khoa voi nguoi xem khong lo moc sua, luot con dong danh dau sealed", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Một");
    await dangNiemPhong(db, seat1.id, chung, CAU_DO, "Hai");
    const sua = new Date(Date.now() + 60_000);
    await db.update(rounds).set({ editedAt: sua }).where(eq(rounds.bookId, chung));
    const [l1, l2] = await roundsOfBook(db, chung);
    const cuaNguoiKia = (await readBook(db, seat2.id, chung))!;
    expect(cuaNguoiKia.sheets.map((s) => [s.roundId, s.locked, s.editedAt])).toEqual([[l1.id, false, sua], [l2.id, true, null]]);
    expect(cuaNguoiKia.rounds).toEqual([
      { id: l1.id, ordinal: 1, first: 1, last: 1, sealed: false },
      { id: l2.id, ordinal: 2, first: 2, last: 2, sealed: true },
    ]);
    const cuaChu = (await readBook(db, seat1.id, chung))!;
    expect(cuaChu.sheets.map((s) => s.editedAt)).toEqual([sua, sua]);
    expect(cuaChu.rounds.map((r) => r.sealed)).toEqual([false, true]);
  });

  it("readBook: moi to lay dung moc sua cua luot minh, luot chua sua thi null", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Một", "Hai");
    await dang(db, seat1.id, chung, "Ba");
    await dang(db, seat1.id, chung, "Bốn", "Năm");
    const [l1, , l3] = await roundsOfBook(db, chung);
    const suaMot = new Date(Date.now() + 60_000);
    const suaBa = new Date(Date.now() + 120_000);
    await db.update(rounds).set({ editedAt: suaMot }).where(eq(rounds.id, l1.id));
    await db.update(rounds).set({ editedAt: suaBa }).where(eq(rounds.id, l3.id));
    for (const viewer of [seat1.id, seat2.id]) {
      const view = (await readBook(db, viewer, chung))!;
      expect(view.sheets.map((s) => [s.position, s.editedAt])).toEqual([[1, suaMot], [2, suaMot], [3, null], [4, suaBa], [5, suaBa]]);
    }
  });

  it("readBook: hen gio chua toi gio che moc sua voi ca chu sach, toi gio thi hien", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    const now = new Date();
    const moLuc = new Date(now.getTime() + 3_600_000);
    await dangNiemPhong(db, seat1.id, chung, henGio(moLuc), "Một", "Hai");
    const sua = new Date(now.getTime() + 60_000);
    await db.update(rounds).set({ editedAt: sua }).where(eq(rounds.bookId, chung));
    for (const viewer of [seat1.id, seat2.id]) {
      const truoc = (await readBook(db, viewer, chung, now))!;
      expect(truoc.sheets.map((s) => [s.locked, s.editedAt])).toEqual([[true, null], [true, null]]);
      expect(truoc.rounds.map((r) => r.sealed)).toEqual([true]);
      const sau = (await readBook(db, viewer, chung, new Date(moLuc.getTime() + 1)))!;
      expect(sau.sheets.map((s) => [s.locked, s.editedAt])).toEqual([[false, sua], [false, sua]]);
      expect(sau.rounds.map((r) => r.sealed)).toEqual([false]);
    }
  });

  it("readBook: cau do mo roi thi nguoi kia thay moc sua cua luot", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dangNiemPhong(db, seat1.id, chung, CAU_DO, "Một");
    const sua = new Date(Date.now() + 60_000);
    await db.update(rounds).set({ editedAt: sua }).where(eq(rounds.bookId, chung));
    const [s] = await sealsOfBook(db, chung);
    expect((await readBook(db, seat2.id, chung))!.sheets.map((t) => t.editedAt)).toEqual([null]);
    expect(await giftKey(db, seat1.id, s.id, "")).toMatchObject({ status: "opened", firstPosition: 1 });
    const sau = (await readBook(db, seat2.id, chung))!;
    expect(sau.sheets.map((t) => [t.locked, t.editedAt])).toEqual([[false, sua]]);
    expect(sau.rounds.map((r) => r.sealed)).toEqual([false]);
  });
});
