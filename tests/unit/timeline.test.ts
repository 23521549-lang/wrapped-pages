import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { bookCovers, books, bookTracks } from "@/server/db/schema";
import { coverSlots, newestCover, newestCovers, newestTrack, trackSlots } from "@/server/library/timeline";
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

/*
 * Hai ham nay tra CA O TRONG: mot luot da dang nhung chua chon bia van la mot cho trong co that ma man Sua sach phai
 * dien vao duoc. Vi vay do dai mang luon bang so luot cong mot, con o da co thi nam trong truong o.
 */
describe("coverSlots va trackSlots", () => {
  it("o mo dau dung truoc, cac o sau xep theo to dau cua luot, kem so thu tu va khoang to", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 2);
    const l2 = await luotChu(s.db, s.chung, 3, 5, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l2, cover: "cau-go" });
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    const ds = await coverSlots(s.db, s.chung);
    expect(ds.map((o) => [o.roundId, o.ordinal, o.first, o.last, o.o?.cover])).toEqual([
      [null, null, null, null, "nui-xa"],
      [l1, 1, 1, 2, "hoa-dao"],
      [l2, 2, 3, 5, "cau-go"],
    ]);
  });

  it("luot chua co o bia van giu cho cua no, khong bien mat khoi danh sach", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 2);
    const l2 = await luotChu(s.db, s.chung, 3, 5, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l2, cover: "cau-go" });
    const ds = await coverSlots(s.db, s.chung);
    expect(ds).toHaveLength(3);
    expect(ds[1].roundId).toBe(l1);
    expect(ds[1].o).toBeNull();
    expect(ds[2].o?.cover).toBe("cau-go");
  });

  it("o go nhac khac han o chua dung toi nhac", async () => {
    const s = await haiCuon();
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    const l2 = await luotChu(s.db, s.chung, 2, 2, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: l1, youtubeId: null });
    const ds = await trackSlots(s.db, s.chung);
    expect(ds.map((o) => [o.roundId, o.o])).toEqual([
      [null, null],
      [l1, { id: expect.any(String), youtubeId: null }],
      [l2, null],
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
    const ds = await coverSlots(s.db, s.chung);
    expect(ds[0].at).toEqual(cuon.createdAt);
    expect(ds[1].at).toEqual(moc);
  });

  it("dong thoi gian nhac giu ca o go nhac, va cuon chua co luot nao chi con o mo dau", async () => {
    const s = await haiCuon();
    const l1 = await luotChu(s.db, s.chung, 1, 1);
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: null, youtubeId: "5qap5aO4i9A" });
    await s.db.insert(bookTracks).values({ bookId: s.chung, roundId: l1, youtubeId: null });
    expect((await trackSlots(s.db, s.chung)).map((o) => [o.roundId, o.ordinal, o.o?.youtubeId ?? null])).toEqual([
      [null, null, "5qap5aO4i9A"],
      [l1, 1, null],
    ]);
    const rieng = await trackSlots(s.db, s.rieng);
    expect(rieng).toHaveLength(1);
    expect(rieng[0].o).toBeNull();
  });

  it("chi doc dung cuon duoc hoi", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    await oMoDau(s.db, s.rieng, "hoa-dao");
    expect((await coverSlots(s.db, s.rieng)).map((o) => o.o?.cover)).toEqual(["hoa-dao"]);
  });

  it("cuon khong ton tai tra danh sach rong chu khong nem loi", async () => {
    const s = await haiCuon();
    expect(await coverSlots(s.db, randomUUID())).toEqual([]);
    expect(await trackSlots(s.db, randomUUID())).toEqual([]);
  });

  it("o cuoi cung co bia cua coverSlots chinh la bia newestCover tra ve", async () => {
    const s = await haiCuon();
    await oMoDau(s.db, s.chung, "nui-xa");
    const l1 = await luotChu(s.db, s.chung, 1, 2);
    const l2 = await luotChu(s.db, s.chung, 3, 5, new Date(MOC_LUOT.getTime() + 60_000));
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l1, cover: "hoa-dao" });
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: l2, cover: "cau-go" });
    const daCo = (await coverSlots(s.db, s.chung)).filter((o) => o.o !== null);
    expect(daCo.at(-1)?.o?.cover).toBe((await newestCover(s.db, s.chung))?.cover);
  });
});
