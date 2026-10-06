import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { books, bookTracks } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { demCauLenh } from "../helpers/db";
import { setAnHoatDong } from "@/server/identity/prefs";
import { recordActivity } from "@/server/feed/record";
import { baiCuaThang, thangCoNhac } from "@/server/nhac/so-nhac";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

/*
 * So nhac thang (5b, spec B1, B2): bai moi nguoi dat cho sach cua minh trong thang (gio Viet Nam): o mo dau (luc tao
 * sach), o cua luot (luc dang), bai doi o Sua sach (dong doi-nhac co sau.youtubeId). O go nhac khong tinh; cung bai chi
 * mot lan, giu lan dau; cuon rieng tu chi chu sach thay.
 */

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const D = "ddddddddddd";
const E = "eeeeeeeeeee";
const F = "fffffffffff";
const G = "ggggggggggg";
const H = "hhhhhhhhhhh";

const ngay = (thang: number, d: number, gioUtc = 2) => new Date(Date.UTC(2026, thang - 1, d, gioUtc));

async function oNhac(db: TestDb, bookId: string, roundId: string | null, youtubeId: string | null) {
  await db.insert(bookTracks).values({ bookId, roundId, youtubeId });
}

async function taoLuc(db: TestDb, bookId: string, at: Date) {
  await db.update(books).set({ createdAt: at }).where(eq(books.id, bookId));
}

/**
 * Linh (seat1): cuon chung tao 2.9 kem bai A; luot 1 (10.9) bai B; luot 2 (15.9) go nhac; luot 3 (3.10) bai C; luot 4
 * dang 00:30 ngay 1.10 gio Viet Nam, bai H; doi nhac o Sua sach 20.9 ve lai A (trung), 21.9 sang E, 22.9 "phat tiep bai
 * truoc" va "tat nhac" (khong tinh). Cuon rieng tu tao 5.9 kem bai D. Manh (seat2): cuon chung, luot 11.9 bai F; cuon
 * rieng tu, luot 12.9 bai G.
 */
async function dung() {
  const s = await haiCuon();
  const { db, seat1, seat2, chung, rieng } = s;
  await taoLuc(db, chung, ngay(9, 2));
  await db.delete(bookTracks).where(eq(bookTracks.bookId, chung));
  await oNhac(db, chung, null, A);
  await oNhac(db, chung, await luotChu(db, chung, 1, 1, ngay(9, 10)), B);
  await oNhac(db, chung, await luotChu(db, chung, 2, 2, ngay(9, 15)), null);
  await oNhac(db, chung, await luotChu(db, chung, 3, 3, ngay(10, 3)), C);
  await oNhac(db, chung, await luotChu(db, chung, 4, 4, new Date("2026-09-30T17:30:00.000Z")), H);
  const doi = (at: Date, sau: { youtubeId: string | null } | null) => recordActivity(db, {
    kind: "doi-nhac", actorId: seat1.id, bookId: chung, roundId: null, mode: "chia-se", at, detail: { truoc: null, sau },
  });
  await doi(ngay(9, 20), { youtubeId: A });
  await doi(ngay(9, 21), { youtubeId: E });
  await doi(ngay(9, 22), null);
  await doi(ngay(9, 22, 5), { youtubeId: null });
  await taoLuc(db, rieng, ngay(9, 5));
  await db.delete(bookTracks).where(eq(bookTracks.bookId, rieng));
  await oNhac(db, rieng, null, D);

  const kia = await createBook(db, seat2.id, { title: "Những bữa sáng", mode: "chia-se", cover: "hoa-dao", youtubeId: null, coverMediaId: null });
  const kiaRieng = await createBook(db, seat2.id, { title: "Góc riêng", mode: "rieng-tu", cover: "cau-go", youtubeId: null, coverMediaId: null });
  await oNhac(db, kia, await luotChu(db, kia, 1, 1, ngay(9, 11)), F);
  await oNhac(db, kiaRieng, await luotChu(db, kiaRieng, 1, 1, ngay(9, 12)), G);
  return s;
}

const gon = (ds: readonly { youtubeId: string; bookTitle: string; ordinal: number | null; rieng: boolean }[]) =>
  ds.map((b) => `${b.youtubeId.slice(0, 1)} ${b.bookTitle} ${b.ordinal ?? "tao"}${b.rieng ? " rieng" : ""}`);

describe("baiCuaThang", () => {
  it("ba nguon, theo luc dat, bo trung giu lan dau, bo o go nhac; thang theo gio Viet Nam", async () => {
    const { db, seat1 } = await dung();
    const t9 = await baiCuaThang(db, seat1.id, { y: 2026, m: 9 });
    expect(gon(t9.minh)).toEqual([
      "a Chuyện chưa kể tao",
      "d Cuốn không đặt tên tao rieng",
      "b Chuyện chưa kể 1",
      "e Chuyện chưa kể tao",
    ]);
    expect(t9.minh.map((b) => b.at)).toEqual([ngay(9, 2), ngay(9, 5), ngay(9, 10), ngay(9, 21)]);
    expect(gon(t9.kia)).toEqual(["f Những bữa sáng 1"]);
    const t10 = await baiCuaThang(db, seat1.id, { y: 2026, m: 10 });
    expect(gon(t10.minh)).toEqual(["h Chuyện chưa kể 4", "c Chuyện chưa kể 3"]);
  });

  it("cuon rieng tu chi chu sach thay: nguoi kia khong thay bai nao cua cuon do", async () => {
    const { db, seat2 } = await dung();
    const t9 = await baiCuaThang(db, seat2.id, { y: 2026, m: 9 });
    expect(gon(t9.kia)).toEqual(["a Chuyện chưa kể tao", "b Chuyện chưa kể 1", "e Chuyện chưa kể tao"]);
    expect(gon(t9.minh)).toEqual(["f Những bữa sáng 1", "g Góc riêng 1 rieng"]);
    expect(JSON.stringify(t9)).not.toContain(D);
  });

  it("cuon chia se chuyen sang rieng tu: nguoi kia khong con thay bai cua no", async () => {
    const { db, seat2, chung } = await dung();
    await db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, chung));
    expect((await baiCuaThang(db, seat2.id, { y: 2026, m: 9 })).kia).toEqual([]);
  });
});

describe("thangCoNhac", () => {
  it("chi thang da khep co bai nguoi xem thay, dem sau bo trung, moi nhat truoc", async () => {
    const { db, seat1, seat2 } = await dung();
    expect(await thangCoNhac(db, seat1.id, new Date("2026-10-05T02:00:00.000Z"))).toEqual([
      { thang: "2026-09", soBai: 5, soDanhSach: 2 },
    ]);
    expect(await thangCoNhac(db, seat1.id, new Date("2026-11-02T02:00:00.000Z"))).toEqual([
      { thang: "2026-10", soBai: 2, soDanhSach: 1 },
      { thang: "2026-09", soBai: 5, soDanhSach: 2 },
    ]);
    expect(await thangCoNhac(db, seat2.id, new Date("2026-10-05T02:00:00.000Z"))).toEqual([
      { thang: "2026-09", soBai: 5, soDanhSach: 2 },
    ]);
    expect(await thangCoNhac(db, seat1.id, new Date("2026-09-20T02:00:00.000Z"))).toEqual([]);
  });
});

/*
 * An hoat dong (06/10) KHONG duoc lam mat bai nao khoi So nhac thang. Day la ly do ca thiet ke chon "van ghi, an luc
 * doc": bang book_tracks chi giu bai HIEN TAI, nen lich su doi nhac o Sua sach khong co o dau khac ngoai dong doi-nhac.
 * so-nhac.ts loc theo quyen doc CUON (owner_id hay che do chia se), co y khong qua thayDuoc, nen dong bi an van nuoi so.
 * Ca nay do la: nghia la mot ngay nao do So nhac bi doi sang loc qua thayDuoc, va bai cua nguoi dang an bien mat vinh vien.
 */
describe("an hoat dong khong lam mat bai trong So nhac thang", () => {
  it("bai doi o Sua sach trong luc dang an van nam trong so", async () => {
    const { db, seat1, chung } = await haiCuon();
    await taoLuc(db, chung, ngay(9, 2));
    await setAnHoatDong(db, seat1.id, true);
    await recordActivity(db, {
      kind: "doi-nhac", actorId: seat1.id, bookId: chung, roundId: null, mode: "chia-se",
      at: ngay(9, 21), detail: { truoc: null, sau: { youtubeId: E } },
    });
    const t9 = await baiCuaThang(db, seat1.id, { y: 2026, m: 9 });
    expect(gon(t9.minh)).toEqual(["e Chuyện chưa kể tao"]);
    expect(t9.minh.map((b) => b.at)).toEqual([ngay(9, 21)]);
  });
});

/*
 * NGAN SACH TRUY VAN cua So nhac thang. Truoc day ham nay doc thu tu luot bang mot cau lenh cho MOI cuon
 * (`map(bookId => roundsOfBook(tx, bookId))`), tuc N+1 giong het khung sach lon cua ke sach. Bai nay khoa lai: so cau
 * lenh khong duoc tang theo so cuon co bai trong thang.
 */
describe("ngan sach truy van cua So nhac thang", () => {
  it("so cau lenh khong tang theo so cuon co bai trong thang", async () => {
    const { db, seat1 } = await dung();
    const motThang = await demCauLenh(() => baiCuaThang(db, seat1.id, { y: 2026, m: 10 }));
    const nhieuThang = await demCauLenh(() => baiCuaThang(db, seat1.id, { y: 2026, m: 9 }));
    // Thang 9 co bai cua nhieu cuon hon han thang 10, nhung so cau lenh phai y nhau.
    expect(nhieuThang).toBe(motThang);
  });
});
