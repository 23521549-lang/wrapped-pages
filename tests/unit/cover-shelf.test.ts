import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { BookInput } from "@/lib/book";
import { updateBook } from "@/server/library/books";
import { listDrafts, saveDraft } from "@/server/library/drafts";
import { readBook } from "@/server/library/pages";
import { listShelf } from "@/server/library/shelf";
import { canViewMedia, recordUpload } from "@/server/media/access";
import type { TestDb } from "../helpers/db";
import { haiCuon, to } from "../helpers/library";

const CHUNG: BookInput = { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null };
const RIENG: BookInput = { title: "Cuốn không đặt tên", mode: "rieng-tu", cover: "chim-bay", youtubeId: null, coverMediaId: null };

/** seat1 tai mot bia cho gan qua duong that roi dat lam bia cua cuon; tra id bia. */
async function datBia(db: TestDb, ownerId: string, bookId: string, input: BookInput): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  expect(await updateBook(db, ownerId, bookId, { ...input, coverMediaId: id })).toBe("saved");
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
