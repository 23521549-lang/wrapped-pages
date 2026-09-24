import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BookInput } from "@/lib/book";
import { bookCovers } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { createBook, readOwnBook, updateBook } from "@/server/library/books";
import { listDrafts, listUnwrittenBooks, saveDraft } from "@/server/library/drafts";
import { readBook } from "@/server/library/pages";
import { listShelf } from "@/server/library/shelf";
import { setCoverEntry, setTrackEntry } from "@/server/library/timeline";
import { canViewMedia, recordUpload } from "@/server/media/access";
import { ANH_CHUP, chiQuaAnhChup, demCauLenh, type TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { luotCua } from "../helpers/round";

const CHUNG: BookInput = { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null };
const RIENG: BookInput = { title: "Cuốn không đặt tên", mode: "rieng-tu", cover: "chim-bay", youtubeId: null, coverMediaId: null };

/**
 * seat1 tai mot bia cho gan qua duong that (setCoverEntry, duong ghi bia duy nhat cua dong thoi gian) roi dat no vao o
 * bia MO DAU cua cuon; tra id bia. Dich cuoi la "bia va nhac chi song o mot noi, la hai bang nay" (spec 6.2), va gio
 * ham nay da di tron duong do: cai neo TAM ghi thang books.cover_media_id khong con, vi ca buoc don rac (sweepMedia)
 * lan cong tai media (canViewMedia) deu da doc book_covers. books.cover khong con noi nao doc nen khong ghi nua.
 */
async function datBia(db: TestDb, ownerId: string, bookId: string, input: BookInput): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  expect(await setCoverEntry(db, ownerId, bookId, null, { cover: input.cover, coverMediaId: id })).toBe("saved");
  return id;
}

describe("bia tu tai len tren ke, man doc va ban nhap", () => {
  it("chua dat bia tu tai len thi coverMediaId null", async () => {
    const s = await haiCuon();
    expect((await listShelf(s.db, s.seat1.id)).map((b) => b.coverMediaId)).toEqual([null, null]);
  });

  it("chu sach nhan bia cua moi cuon; nguoi kia chi nhan bia cua cuon chia se, va /m cho ho tai dung bia do", async () => {
    const s = await haiCuon();
    const biaChung = await datBia(s.db, s.seat1.id, s.chung, CHUNG);
    const biaRieng = await datBia(s.db, s.seat1.id, s.rieng, RIENG);
    const now = new Date();

    const cuaChu = await listShelf(s.db, s.seat1.id, now);
    expect(new Map(cuaChu.map((b) => [b.id, b.coverMediaId]))).toEqual(new Map([[s.chung, biaChung], [s.rieng, biaRieng]]));

    const cuaNguoiKia = await listShelf(s.db, s.seat2.id, now);
    expect(cuaNguoiKia.map((b) => [b.id, b.coverMediaId])).toEqual([[s.chung, biaChung]]);
    expect(JSON.stringify(cuaNguoiKia)).not.toContain(biaRieng);
    expect(await canViewMedia(s.db, s.seat2.id, biaChung, now)).not.toBeNull();
    expect(await canViewMedia(s.db, s.seat2.id, biaRieng, now)).toBeNull();
  });

  it("cuon chuyen rieng tu: nguoi kia mat ca the sach lan bia ngay lan doc sau", async () => {
    const s = await haiCuon();
    const bia = await datBia(s.db, s.seat1.id, s.chung, CHUNG);
    expect(await updateBook(s.db, s.seat1.id, s.chung, { title: CHUNG.title, mode: "rieng-tu" })).toBe("saved");
    expect(await listShelf(s.db, s.seat2.id)).toEqual([]);
    expect(await readBook(s.db, s.seat2.id, s.chung)).toBeNull();
    expect(await canViewMedia(s.db, s.seat2.id, bia, new Date())).toBeNull();
  });

  it("man doc cua nguoi kia va ban nhap cua chu mang bia tu tai len cua cuon", async () => {
    const s = await haiCuon();
    const bia = await datBia(s.db, s.seat1.id, s.chung, CHUNG);
    expect((await readBook(s.db, s.seat2.id, s.chung))?.book.coverMediaId).toBe(bia);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, to("Em toi som"), 1)).toBeInstanceOf(Date);
    expect((await listDrafts(s.db, s.seat1.id)).map((d) => [d.bookId, d.coverMediaId])).toEqual([[s.chung, bia]]);
  });
});

describe("bia va nhac hien hanh cua man doc", () => {
  it("man doc lay bia cua o MOI NHAT, khong phai o mo dau", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const luot = await luotCua(s.db, s.chung, 1);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, luot, { cover: "hoa-dao", coverMediaId: null })).toBe("saved");
    expect((await readBook(s.db, s.seat2.id, s.chung))?.book.cover).toBe("hoa-dao");
  });

  it("man doc phat nhac MOI NHAT cua cuon, va im khi o moi nhat la o go nhac", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const luot = await luotCua(s.db, s.chung, 1);
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, null, { youtubeId: "5qap5aO4i9A" })).toBe("saved");
    expect((await readBook(s.db, s.seat2.id, s.chung))?.book.youtubeId).toBe("5qap5aO4i9A");
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, luot, { youtubeId: null })).toBe("saved");
    expect((await readBook(s.db, s.seat2.id, s.chung))?.book.youtubeId).toBeNull();
  });

  it("cuon khong con o bia nao thi coi nhu khong ton tai", async () => {
    const s = await haiCuon();
    await s.db.delete(bookCovers).where(eq(bookCovers.bookId, s.chung));
    expect(await readBook(s.db, s.seat1.id, s.chung)).toBeNull();
    expect(await readOwnBook(s.db, s.seat1.id, s.chung)).toBeNull();
  });
});

describe("bia moi nhat tren ke, o ban nhap va o cuon chua viet", () => {
  it("the tren ke luon mang bia cua o MOI NHAT, ca voi nguoi kia", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const luot = await luotCua(s.db, s.chung, 1);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, luot, { cover: "hoa-dao", coverMediaId: null })).toBe("saved");
    for (const ai of [s.seat1.id, s.seat2.id]) {
      expect((await listShelf(s.db, ai)).find((b) => b.id === s.chung)?.cover).toBe("hoa-dao");
    }
  });

  it("cuon khong con o bia nao thi bien khoi ke, khoi ban nhap va khoi muc chua viet", async () => {
    const s = await haiCuon();
    expect(await saveDraft(s.db, s.seat1.id, s.chung, to("Em toi som"), 1)).toBeInstanceOf(Date);
    await s.db.delete(bookCovers).where(eq(bookCovers.bookId, s.chung));
    expect((await listShelf(s.db, s.seat1.id)).map((b) => b.id)).toEqual([s.rieng]);
    expect(await listDrafts(s.db, s.seat1.id)).toEqual([]);
    expect((await listUnwrittenBooks(s.db, s.seat1.id)).map((b) => b.bookId)).toEqual([s.rieng]);
    await s.db.delete(bookCovers).where(eq(bookCovers.bookId, s.rieng));
    expect(await listUnwrittenBooks(s.db, s.seat1.id)).toEqual([]);
  });

  it("the ban nhap va cuon chua viet cung lay bia cua o moi nhat", async () => {
    const s = await haiCuon();
    expect(await setCoverEntry(s.db, s.seat1.id, s.rieng, null, { cover: "cau-go", coverMediaId: null })).toBe("saved");
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const luot = await luotCua(s.db, s.chung, 1);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, luot, { cover: "hoa-dao", coverMediaId: null })).toBe("saved");
    expect(await saveDraft(s.db, s.seat1.id, s.chung, to("Em toi som"), 1)).toBeInstanceOf(Date);
    expect((await listDrafts(s.db, s.seat1.id)).map((d) => [d.bookId, d.cover])).toEqual([[s.chung, "hoa-dao"]]);
    expect((await listUnwrittenBooks(s.db, s.seat1.id)).map((b) => [b.bookId, b.cover])).toEqual([[s.rieng, "cau-go"]]);
  });

  it("ke sach tra dung MOT cau lenh cho bia, va so cau lenh khong tang theo so cuon", async () => {
    const s = await haiCuon();
    // Tam cau: mot cau mo anh chup, sau cau doc cua ke, va dung mot cau cho bia ca ke (ngan sach cua spec 6.12).
    expect(await demCauLenh(() => listShelf(s.db, s.seat1.id))).toBe(8);
    for (let i = 0; i < 4; i += 1) {
      await createBook(s.db, s.seat1.id, { title: `Cuốn ${i}`, mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    }
    expect((await listShelf(s.db, s.seat1.id)).length).toBe(6);
    expect(await demCauLenh(() => listShelf(s.db, s.seat1.id))).toBe(8);
  });

  it("ban nhap va cuon chua viet doc bia trong cung anh chup voi phan con lai", async () => {
    const s = await haiCuon();
    expect(await saveDraft(s.db, s.seat1.id, s.chung, to("Em toi som"), 1)).toBeInstanceOf(Date);
    const quaAnhChup = async <T>(doc: (db: AnyDb, ownerId: string) => Promise<T>) => {
      const { boc, cauHinh } = chiQuaAnhChup(s.db);
      expect(await doc(boc, s.seat1.id)).toEqual(await doc(s.db, s.seat1.id));
      expect(cauHinh).toEqual([ANH_CHUP]);
    };
    await quaAnhChup(listDrafts);
    await quaAnhChup(listUnwrittenBooks);
  });
});
