import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BookInput } from "@/lib/book";
import { bookCovers, books } from "@/server/db/schema";
import { readOwnBook, updateBook } from "@/server/library/books";
import { listDrafts, saveDraft } from "@/server/library/drafts";
import { readBook } from "@/server/library/pages";
import { listShelf } from "@/server/library/shelf";
import { setCoverEntry, setTrackEntry } from "@/server/library/timeline";
import { canViewMedia, recordUpload } from "@/server/media/access";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { luotCua } from "../helpers/round";

const CHUNG: BookInput = { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null };
const RIENG: BookInput = { title: "Cuốn không đặt tên", mode: "rieng-tu", cover: "chim-bay", youtubeId: null, coverMediaId: null };

/**
 * seat1 tai mot bia cho gan qua duong that (setCoverEntry, duong ghi bia duy nhat cua dong thoi gian) roi dat no vao o
 * bia MO DAU cua cuon; tra id bia. Dich cuoi la "bia va nhac chi song o mot noi, la hai bang nay" (spec 6.2).
 * Hai dong ghi thang books ben duoi la mot cai neo TAM: man doc da doc bia va nhac tu hai dong thoi gian, nhung ke sach,
 * ban nhap va cong tai media van doc ba cot cu cua books. Xoa hai dong do ngay khi ba noi con lai chuyen sang
 * newestCovers; khong dat chung qua updateBook vi duong ghi do sap chi con ten sach va che do (B2).
 */
async function datBia(db: TestDb, ownerId: string, bookId: string, input: BookInput): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  expect(await setCoverEntry(db, ownerId, bookId, null, { cover: input.cover, coverMediaId: id })).toBe("saved");
  await db.update(books).set({ cover: input.cover, coverMediaId: id }).where(eq(books.id, bookId));
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
    expect(await updateBook(s.db, s.seat1.id, s.chung, { ...CHUNG, mode: "rieng-tu", coverMediaId: bia })).toBe("saved");
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
