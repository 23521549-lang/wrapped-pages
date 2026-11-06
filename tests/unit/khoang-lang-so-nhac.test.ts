import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { books, bookTracks } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { baiCuaThang, thangCoNhac } from "@/server/nhac/so-nhac";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu, taoLuot } from "../helpers/round";

const A = "aaaaaaaaaaa";
const F = "fffffffffff";
const X = "xxxxxxxxxxx";
const Y = "yyyyyyyyyyy";

const ngay = (thang: number, d: number, gioUtc = 2) => new Date(Date.UTC(2026, thang - 1, d, gioUtc));

async function oNhac(db: TestDb, bookId: string, roundId: string | null, youtubeId: string | null) {
  await db.insert(bookTracks).values({ bookId, roundId, youtubeId });
}

/*
 * Khoang Lang tren so nhac (task 8): tat co thi kia co bai, chung co bai doi phuong dat; bat co thi kia rong, chung
 * chi con bai minh dat, thangCoNhac dem dung so danh sach con lai.
 * Nguoi xem la seat2 (Manh): bai A o cuon chia se cua seat1 (kia); bai F o cuon cua minh; bai X/Y o sach viet cung
 * (X do minh dat, Y do doi phuong dat).
 */
async function dung() {
  const s = await haiCuon();
  const { db, seat1, seat2, chung } = s;
  await db.update(books).set({ createdAt: ngay(9, 2) }).where(eq(books.id, chung));
  await db.delete(bookTracks).where(eq(bookTracks.bookId, chung));
  await oNhac(db, chung, null, A);
  const cuaMinh = await createBook(db, seat2.id, { title: "Sổ của Mạnh", mode: "chia-se", cover: "hoa-dao", youtubeId: null, coverMediaId: null });
  await oNhac(db, cuaMinh, await luotChu(db, cuaMinh, 1, 1, ngay(9, 11)), F);
  const vc = await createBook(db, seat1.id, { title: "Cùng viết", mode: "chia-se", cover: "hoa-dao", youtubeId: null, coverMediaId: null });
  await db.update(books).set({ vietCungTu: new Date("2026-09-01T00:00:00.000Z") }).where(eq(books.id, vc));
  await oNhac(db, vc, await taoLuot(db, vc, ngay(9, 10), seat2.id), X);
  await oNhac(db, vc, await taoLuot(db, vc, ngay(9, 12), seat1.id), Y);
  return s;
}

const T9 = { y: 2026, m: 9 };
const SAU_THANG = new Date("2026-10-05T00:00:00.000Z");

describe("Khoang Lang: so nhac thang", () => {
  it("tat co (kiem soat duong): kia co bai, chung co bai doi phuong dat, dem du 3 danh sach", async () => {
    const { db, seat2 } = await dung();
    const bai = await baiCuaThang(db, seat2.id, T9);
    expect(bai.kia.map((b) => b.youtubeId)).toEqual([A]);
    expect(bai.minh.map((b) => b.youtubeId)).toEqual([F]);
    expect(bai.chung.map((b) => [b.youtubeId, b.ai])).toEqual([[X, "minh"], [Y, "kia"]]);
    expect(await thangCoNhac(db, seat2.id, SAU_THANG)).toEqual([{ thang: "2026-09", soBai: 4, soDanhSach: 3 }]);
  });

  it("bat co: kia rong, chung chi con bai minh dat, dem chi con 2 danh sach", async () => {
    const { db, seat2 } = await dung();
    const bai = await baiCuaThang(db, seat2.id, T9, true);
    expect(bai.kia).toEqual([]);
    expect(bai.minh.map((b) => b.youtubeId)).toEqual([F]);
    expect(bai.chung.map((b) => [b.youtubeId, b.ai])).toEqual([[X, "minh"]]);
    expect(await thangCoNhac(db, seat2.id, SAU_THANG, true)).toEqual([{ thang: "2026-09", soBai: 2, soDanhSach: 2 }]);
  });
});
