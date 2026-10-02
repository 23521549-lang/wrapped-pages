import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { books, readSheets } from "@/server/db/schema";
import { updateBook } from "@/server/library/books";
import { markRead, readBook } from "@/server/library/pages";
import { submitRoundReply } from "@/server/library/round-replies";
import { roundsOfBook } from "@/server/library/rounds";
import { listShelf } from "@/server/library/shelf";
import { unreadRounds } from "@/server/library/unread-rounds";
import { dang, dangTen, haiCuon, vietCung } from "../helpers/library";
import { CAU_DO, dangNiemPhong } from "../helpers/seal";
import { traLoi, xinViet } from "@/server/viet-cung/de-nghi";

/*
 * Doc sach viet cung theo nguoi viet tung luot (5c muc E2, E5, G4, G5): trang cua chinh minh khong bao gio la "trang
 * moi" voi minh, khong ghi da doc; trang cua nguoi kia thi nhu doc sach cua nguoi kia.
 */

const T = new Date("2026-09-22T02:00:00.000Z");

/** Sach viet cung ba luot: to 1 cua Linh, to 2 cua Manh, to 3 cua Linh. */
async function baLuot() {
  const s = await vietCung();
  await dangTen(s.db, s.seat1.id, s.sach, "Mưa phùn đầu ngõ", "Linh một");
  await dangTen(s.db, s.seat2.id, s.sach, "Bánh mì", "Mạnh một");
  await dangTen(s.db, s.seat1.id, s.sach, "Cháo gà", "Linh hai");
  return s;
}

const daXem = async (db: Awaited<ReturnType<typeof vietCung>>["db"], accountId: string) =>
  (await db.select({ p: readSheets.position }).from(readSheets).where(eq(readSheets.accountId, accountId)).orderBy(asc(readSheets.position)))
    .map((r) => r.p);

describe("markRead theo nguoi viet luot", () => {
  it("chi ghi trang cua nguoi kia; trang cua minh bo qua", async () => {
    const s = await baLuot();
    // Moi lan gui toi da mot khung sach (hai to).
    expect(await markRead(s.db, s.seat2.id, s.sach, [1, 2], T)).toEqual([1]);
    expect(await markRead(s.db, s.seat2.id, s.sach, [2, 3], T)).toEqual([3]);
    expect(await markRead(s.db, s.seat1.id, s.sach, [1, 2], T)).toEqual([2]);
    expect(await markRead(s.db, s.seat1.id, s.sach, [3], T)).toEqual([]);
    expect(await daXem(s.db, s.seat2.id)).toEqual([1, 3]);
    expect(await daXem(s.db, s.seat1.id)).toEqual([2]);
  });

  it("sach mot nguoi viet: chu sach khong ghi gi nhu cu, nguoi kia ghi nhu cu", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một", "hai");
    expect(await markRead(db, seat1.id, chung, [1, 2], T)).toEqual([]);
    expect(await markRead(db, seat2.id, chung, [1, 2], T)).toEqual([1, 2]);
  });
});

describe("readBook sach viet cung", () => {
  it("luot mang ten va mine theo nguoi viet; vietCung; trang chua doc dau tien bo trang cua minh", async () => {
    const s = await baLuot();
    const v = await readBook(s.db, s.seat2.id, s.sach, T);
    expect(v?.vietCung).toBe(true);
    expect(v?.rounds.map((r) => [r.ordinal, r.ten, r.mine])).toEqual([
      [1, "Mưa phùn đầu ngõ", false], [2, "Bánh mì", true], [3, "Cháo gà", false],
    ]);
    expect(v?.firstUnread).toBe(1);
    await markRead(s.db, s.seat2.id, s.sach, [1], T);
    expect((await readBook(s.db, s.seat2.id, s.sach, T))?.firstUnread).toBe(3);
    await markRead(s.db, s.seat2.id, s.sach, [3], T);
    expect((await readBook(s.db, s.seat2.id, s.sach, T))?.firstUnread).toBe(0);
    expect((await readBook(s.db, s.seat1.id, s.sach, T))?.firstUnread).toBe(2);
  });

  it("loi hoi dap cu truoc khi viet cung van tra ve (chi doc)", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một");
    const [r] = await roundsOfBook(db, chung);
    await submitRoundReply(db, seat2.id, r.id, "Thương ghê", T);
    await db.update(books).set({ vietCungTu: T }).where(eq(books.id, chung));
    expect((await readBook(db, seat2.id, chung, T))?.replies.map((x) => x.body)).toEqual(["Thương ghê"]);
  });
});

describe("listShelf sach viet cung", () => {
  it("trang moi chi dem trang chua doc cua nguoi kia; so luot; vietCung", async () => {
    const s = await baLuot();
    const cuaManh = (await listShelf(s.db, s.seat2.id, T)).find((b) => b.id === s.sach);
    const cuaLinh = (await listShelf(s.db, s.seat1.id, T)).find((b) => b.id === s.sach);
    expect(cuaManh).toMatchObject({ vietCung: true, newCount: 2, roundCount: 3, pageCount: 3, moiCho: null });
    expect(cuaLinh).toMatchObject({ vietCung: true, newCount: 1, roundCount: 3 });
    await markRead(s.db, s.seat2.id, s.sach, [1], T);
    expect((await listShelf(s.db, s.seat2.id, T)).find((b) => b.id === s.sach)?.newCount).toBe(1);
  });

  it("loi moi dang cho: ca hai ben deu thay, moi ben mot phia; cuon van chua la sach viet cung", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await updateBook(db, seat1.id, chung, { title: "Chuyện chưa kể", mode: "chia-se", moi: true }, T);
    expect((await listShelf(db, seat1.id, T)).find((b) => b.id === chung)).toMatchObject({ moiCho: "toi-moi", vietCung: false });
    expect((await listShelf(db, seat2.id, T)).find((b) => b.id === chung)).toMatchObject({ moiCho: "moi-toi", vietCung: false });
  });

  it("loi XIN dang cho khong lam cuon doi ngan: moiCho null ca hai ben", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    expect(await xinViet(db, seat2.id, chung, T)).toBe("sent");
    expect((await listShelf(db, seat1.id, T)).find((b) => b.id === chung)).toMatchObject({ moiCho: null, vietCung: false });
    expect((await listShelf(db, seat2.id, T)).find((b) => b.id === chung)).toMatchObject({ moiCho: null, vietCung: false });
  });

  it("sach mot nguoi viet giu nguyen: cuon cua minh khong co trang moi, cuon nguoi kia dem nhu cu", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một", "hai");
    expect((await listShelf(db, seat1.id, T)).find((b) => b.id === chung)).toMatchObject({ newCount: 0, roundCount: 1, vietCung: false });
    expect((await listShelf(db, seat2.id, T)).find((b) => b.id === chung)).toMatchObject({ newCount: 2 });
  });
});

describe("unreadRounds sach viet cung", () => {
  it("luot nguoi kia chua doc la cua khung sach lon; luot cua minh nguoi kia chua doc thi mine", async () => {
    const s = await baLuot();
    const voiManh = await unreadRounds(s.db, s.seat2.id, T);
    expect(voiManh.map((l) => [l.first, l.mine])).toEqual([[3, false], [2, true], [1, false]]);
    await markRead(s.db, s.seat1.id, s.sach, [2], T);
    await markRead(s.db, s.seat2.id, s.sach, [1], T);
    expect((await unreadRounds(s.db, s.seat2.id, T)).map((l) => [l.first, l.mine])).toEqual([[3, false]]);
    expect((await unreadRounds(s.db, s.seat1.id, T)).map((l) => [l.first, l.mine])).toEqual([[3, true]]);
  });
});

describe("niem phong cu khi cuon thanh sach viet cung (5c muc B5)", () => {
  it("trang niem phong cu van khoa voi nguoi kia: chi dong he lo, khong ghi da doc, van dem la trang khoa", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "Mở");
    await dangNiemPhong(db, seat1.id, chung, CAU_DO, "Hé lộ", "Bí mật thật");
    expect(await xinViet(db, seat2.id, chung, T)).toBe("sent");
    expect(await traLoi(db, seat1.id, chung, true, T)).toBe("accepted");
    const v = await readBook(db, seat2.id, chung, T);
    expect(v?.vietCung).toBe(true);
    // Luot niem phong co hai to (to 2, to 3), ca hai con khoa; khong to nao mang chu that.
    expect(v?.sheets.map((s) => s.locked)).toEqual([false, true, true]);
    expect(JSON.stringify(v?.sheets)).not.toContain("Bí mật thật");
    expect(await markRead(db, seat2.id, chung, [1, 2], T)).toEqual([1]);
    expect((await listShelf(db, seat2.id, T)).find((b) => b.id === chung)).toMatchObject({ vietCung: true, lockedCount: 2 });
  });
});
