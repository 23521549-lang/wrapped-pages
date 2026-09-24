import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { bookCovers, books, bookTracks } from "@/server/db/schema";
import { coversOfBook, newestCover, newestCovers, newestTrack, tracksOfBook } from "@/server/library/timeline";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu, MOC_LUOT } from "../helpers/round";

/**
 * O mo dau cua mot cuon, ghi thang vao bang. Ghi de o dang co truoc, chi chen khi cuon chua co o nao: moi cuon nhieu
 * nhat mot o mo dau (book_covers_mo_dau_idx), va duong tao sach se tu chen o do, nen chen them mot dong nua se va
 * chi muc. Viet kieu nay thi ham dung duoc ca khi cuon da co o lan khi chua.
 */
async function oMoDau(db: TestDb, bookId: string, cover: "nui-xa" | "hoa-dao" | "cau-go", coverMediaId: string | null = null) {
  const da = await db
    .update(bookCovers)
    .set({ cover, coverMediaId })
    .where(and(eq(bookCovers.bookId, bookId), isNull(bookCovers.roundId)))
    .returning({ id: bookCovers.id });
  if (da.length === 0) await db.insert(bookCovers).values({ bookId, roundId: null, cover, coverMediaId });
}

describe("newestCovers va newestCover", () => {
  it("cuon mot o: o mo dau chinh la bia hien hanh", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "nui-xa", coverMediaId: null });
  });

  it("cuon nhieu o: lay o cua luot co to dau lon nhat, khong phai o mo dau", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 2);
    const l2 = await luotChu(s.db, s.chung, 3, 3, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l2, cover: "cau-go" });
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "cau-go", coverMediaId: null });
  });

  it("luot khong co o thi khong keo bia tut lai: o moi nhat van la o cua luot mang o", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    await luotChu(s.db, s.chung, 2, 2, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "hoa-dao", coverMediaId: null });
  });

  it("nhieu cuon mot luot, moi cuon mot dong, cuon khong co o thi khong co dong", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    await s.db.delete(bookCovers).where(eq(bookCovers.bookId, s.rieng));
    expect(await newestCovers(s.db, [s.chung, s.rieng])).toEqual([{ bookId: s.chung, cover: "nui-xa", coverMediaId: null }]);
    expect(await newestCovers(s.db, [])).toEqual([]);
  });

  it("cuon khong co o bia nao tra null", async () => {
    const s = await haiCuon();
    await s.db.delete(bookCovers).where(eq(bookCovers.bookId, s.chung));
    expect(await newestCover(s.db, s.chung)).toBeNull();
  });

  it("giu nguyen anh bia cua o", async () => {
    const s = await haiCuon();
    const id = randomUUID();
    await s.db.execute(sql`insert into media (id, owner_id, book_id, kind, mime, bytes, width, height, store_key)
      values (${id}::uuid, ${s.seat1.id}::uuid, ${s.chung}::uuid, 'bia', 'image/webp', 1024, 1200, 720, ${s.chung} || '/' || ${id} || '.webp')`);
    await oMoDau(s.db, s.chung, "nui-xa", id);
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "nui-xa", coverMediaId: id });
  });
});

describe("newestTrack", () => {
  it("cuon khong co o nhac nao tra null", async () => {
    const s = await haiCuon();
    expect(await newestTrack(s.db, s.chung)).toBeNull();
  });

  it("o moi nhat la o go nhac thi tra null, du truoc do cuon co nhac", async () => {
    const s = await haiCuon();
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: null, youtubeId: "5qap5aO4i9A" });
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: l1, youtubeId: null });
    expect(await newestTrack(s.db, s.chung)).toBeNull();
  });

  it("o moi nhat co ma video thi tra ma do", async () => {
    const s = await haiCuon();
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: null, youtubeId: "5qap5aO4i9A" });
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: l1, youtubeId: "dQw4w9WgXcQ" });
    expect(await newestTrack(s.db, s.chung)).toBe("dQw4w9WgXcQ");
  });
});

describe("coversOfBook va tracksOfBook", () => {
  it("o mo dau dung truoc, cac o sau xep theo to dau cua luot, kem so thu tu va khoang to", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 2);
    const l2 = await luotChu(s.db, s.chung, 3, 5, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l2, cover: "cau-go" });
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    const ds = await coversOfBook(s.db, s.chung);
    expect(ds.map((o) => [o.roundId, o.ordinal, o.first, o.last, o.cover])).toEqual([
      [null, null, null, null, "nui-xa"],
      [l1, 1, 1, 2, "hoa-dao"],
      [l2, 2, 3, 5, "cau-go"],
    ]);
  });

  it("moc thoi gian: o mo dau lay luc tao sach, o cua luot lay luc dang", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const [cuon] = await s.db.select({ createdAt: books.createdAt }).from(books).where(eq(books.id, s.chung));
    // Luot phai dang SAU luc tao sach de moc cua hai o khac nhau that: MOC_LUOT mac dinh la mot ngay co dinh trong qua
    // khu, con books.created_at la gio chay bai kiem, nen lay thang moc mac dinh se cho o mo dau muon hon o cua luot.
    const moc = new Date(cuon.createdAt.getTime() + 60_000);
    const l1 = await luotChu(s.db, s.chung, 1, 1, moc);
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    const ds = await coversOfBook(s.db, s.chung);
    expect(ds[0].at).toEqual(cuon.createdAt);
    expect(ds[1].at).toEqual(moc);
  });

  it("dong thoi gian nhac giu ca o go nhac, va cuon khong o nao thi rong", async () => {
    const s = await haiCuon();
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: null, youtubeId: "5qap5aO4i9A" });
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: l1, youtubeId: null });
    expect((await tracksOfBook(s.db, s.chung)).map((o) => [o.roundId, o.ordinal, o.youtubeId])).toEqual([
      [null, null, "5qap5aO4i9A"],
      [l1, 1, null],
    ]);
    expect(await tracksOfBook(s.db, s.rieng)).toEqual([]);
  });

  it("chi doc dung cuon duoc hoi", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    await oMoDau(s.db, s.rieng, "hoa-dao");
    expect((await coversOfBook(s.db, s.rieng)).map((o) => o.cover)).toEqual(["hoa-dao"]);
  });
});
