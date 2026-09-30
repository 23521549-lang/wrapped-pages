import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { books, bookTracks } from "@/server/db/schema";
import { createBook, updateBook } from "@/server/library/books";
import { renameRound } from "@/server/library/edit-round";
import { markRead } from "@/server/library/pages";
import { roundsOfBook } from "@/server/library/rounds";
import { listActivity } from "@/server/feed/list";
import { phienBanKe } from "@/server/feed/version";
import { baiCuaThang, thangCoNhac } from "@/server/nhac/so-nhac";
import { rutLai, xinViet } from "@/server/viet-cung/de-nghi";
import { dang, dangTen, haiCuon, vietCung } from "../helpers/library";
import { luotChu, taoLuot } from "../helpers/round";

/*
 * Hoat dong, phien ban ke va so nhac cua sach viet cung (5c muc I, J).
 */

const T = new Date("2026-09-22T02:00:00.000Z");
const sau = (phut: number) => new Date(T.getTime() + phut * 60_000);
const XA = new Date("2026-12-01T00:00:00.000Z");

describe("listActivity sach viet cung", () => {
  it("dang luot mang ten luot; doi ten luot mang so thu tu luot", async () => {
    const s = await vietCung();
    await dangTen(s.db, s.seat2.id, s.sach, "Bánh mì", "Mạnh viết");
    const [l1] = await roundsOfBook(s.db, s.sach);
    await renameRound(s.db, s.seat2.id, s.sach, l1.id, "Bánh mì chợ Hàng Da", sau(1));
    const feed = await listActivity(s.db, s.seat1.id, XA);
    expect(feed.find((i) => i.kind === "dang-trang")).toMatchObject({ tenLuot: "Bánh mì chợ Hàng Da", by: "partner" });
    expect(feed.find((i) => i.kind === "doi-ten-luot")).toMatchObject({ ordinal: 1, firstPosition: 1, by: "partner" });
  });

  it("da-doc o sach viet cung: nguoi viet kia thay; khong ai thay dong doc cua chinh minh", async () => {
    const s = await vietCung();
    await dangTen(s.db, s.seat1.id, s.sach, "Mưa", "Linh viết");
    await dangTen(s.db, s.seat2.id, s.sach, "Bánh mì", "Mạnh viết");
    await markRead(s.db, s.seat1.id, s.sach, [2], sau(1));
    await markRead(s.db, s.seat2.id, s.sach, [1], sau(2));
    const cuaLinh = (await listActivity(s.db, s.seat1.id, XA)).filter((i) => i.kind === "da-doc");
    const cuaManh = (await listActivity(s.db, s.seat2.id, XA)).filter((i) => i.kind === "da-doc");
    expect(cuaLinh.map((i) => i.by)).toEqual(["partner"]);
    expect(cuaManh.map((i) => i.by)).toEqual(["partner"]);
  });

  it("dong ghi luc cuon con rieng tu khong lo ra khi cuon thanh sach viet cung", async () => {
    const { db, seat1, seat2, rieng } = await haiCuon();
    await dang(db, seat1.id, rieng, "bí mật");
    await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se", moi: true }, sau(1));
    await db.update(books).set({ vietCungTu: sau(2) }).where(eq(books.id, rieng));
    const kinds = (await listActivity(db, seat2.id, XA)).filter((i) => i.bookId === rieng).map((i) => i.kind);
    expect(kinds).toEqual(["moi-viet"]);
  });
});

describe("phienBanKe", () => {
  it("doi khi co de nghi moi va khi de nghi bi rut", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    const truoc = await phienBanKe(db, seat1.id, XA);
    await xinViet(db, seat2.id, chung, T);
    const coXin = await phienBanKe(db, seat1.id, XA);
    expect(coXin).not.toBe(truoc);
    await rutLai(db, seat2.id, chung);
    expect(await phienBanKe(db, seat1.id, XA)).not.toBe(coXin);
  });
});

describe("so nhac: danh sach chung Hai Ngòi Bút", () => {
  const A = "aaaaaaaaaaa";
  const B = "bbbbbbbbbbb";
  const C = "ccccccccccc";
  const ngay = (d: number) => new Date(Date.UTC(2026, 8, d, 2));

  it("bai trong sach viet cung chi nam o danh sach chung, ghi ai dat theo nguoi viet luot", async () => {
    const s = await vietCung();
    await s.db.update(books).set({ createdAt: ngay(2) }).where(eq(books.id, s.sach));
    await s.db.insert(bookTracks).values({ bookId: s.sach, roundId: null, youtubeId: A });
    const l1 = await luotChu(s.db, s.sach, 1, 1, ngay(10));
    await s.db.insert(bookTracks).values({ bookId: s.sach, roundId: l1, youtubeId: B });
    const l2 = await taoLuot(s.db, s.sach, ngay(12), s.seat2.id);
    await s.db.insert(bookTracks).values({ bookId: s.sach, roundId: l2, youtubeId: C });
    const rieng = await createBook(s.db, s.seat2.id, { title: "Riêng của Mạnh", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    await s.db.update(books).set({ createdAt: ngay(3) }).where(eq(books.id, rieng));
    await s.db.insert(bookTracks).values({ bookId: rieng, roundId: null, youtubeId: "ddddddddddd" });
    const cuaLinh = await baiCuaThang(s.db, s.seat1.id, { y: 2026, m: 9 });
    expect(cuaLinh.minh).toEqual([]);
    expect(cuaLinh.kia.map((b) => b.youtubeId)).toEqual(["ddddddddddd"]);
    expect(cuaLinh.chung.map((b) => [b.youtubeId, b.ai])).toEqual([[A, "minh"], [B, "minh"], [C, "kia"]]);
    const cuaManh = await baiCuaThang(s.db, s.seat2.id, { y: 2026, m: 9 });
    expect(cuaManh.chung.map((b) => [b.youtubeId, b.ai])).toEqual([[A, "kia"], [B, "kia"], [C, "minh"]]);
    expect(await thangCoNhac(s.db, s.seat1.id, new Date("2026-10-05T00:00:00Z"))).toEqual([{ thang: "2026-09", soBai: 4, soDanhSach: 2 }]);
  });
});
