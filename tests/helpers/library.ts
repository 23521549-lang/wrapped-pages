import { eq } from "drizzle-orm";
import { seedHai } from "./seed";
import { books } from "@/server/db/schema";
import type { TestDb } from "./db";
import { createBook } from "@/server/library/books";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import type { DocJson } from "@/lib/doc/types";

/** Tai lieu mot doan chu. */
export const to = (chu: string): DocJson => ({
  type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }],
});

/** Hai cho ngoi; seat1 co mot cuon chia se va mot cuon rieng tu. */
export async function haiCuon() {
  const s = await seedHai();
  const chung = await createBook(s.db, s.seat1.id, { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
  const rieng = await createBook(s.db, s.seat1.id, { title: "Cuốn không đặt tên", mode: "rieng-tu", cover: "chim-bay", youtubeId: null, coverMediaId: null });
  return { ...s, chung, rieng };
}

/** Dang cac to vao mot cuon qua dung duong that: luu nhap roi dang. */
export async function dang(db: TestDb, ownerId: string, bookId: string, ...chu: string[]) {
  return dangTen(db, ownerId, bookId, null, ...chu);
}

/** Nhu dang, kem ten luot (bat buoc voi sach viet cung, 5c). writerId la nguoi dang. */
export async function dangTen(db: TestDb, writerId: string, bookId: string, ten: string | null, ...chu: string[]) {
  await saveDraft(db, writerId, bookId, to(chu[0]), chu.length);
  const r = await publishDraft(db, writerId, bookId, chu.map(to), null, new Date(), ten);
  if (r === null || typeof r === "string") throw new Error(`khong dang duoc: ${String(r)}`);
  return r;
}

/**
 * Hai cho ngoi va mot cuon chia se cua seat1 da la SACH VIET CUNG (dot nam 5c). Dat viet_cung_tu thang vao bang, khong qua
 * duong moi va nhan loi (co bai rieng): test quyen nguoi viet khong can phu thuoc vao luong de nghi.
 */
export async function vietCung(tu: Date = new Date("2026-09-20T00:00:00.000Z")) {
  const s = await seedHai();
  const sach = await createBook(s.db, s.seat1.id, { title: "Những bữa sáng", mode: "chia-se", cover: "hoa-dao", youtubeId: null, coverMediaId: null });
  await s.db.update(books).set({ vietCungTu: tu }).where(eq(books.id, sach));
  return { ...s, sach };
}
