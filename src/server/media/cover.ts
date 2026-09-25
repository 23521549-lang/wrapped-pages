import { and, desc, eq, isNull } from "drizzle-orm";
import { books, media } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";

/**
 * Bia tu tai len co dung duoc cho cuon bookId khong, chong muon id: mediaId phai la dong media loai bia cua
 * chinh ownerId, dang cho gan (book_id null) hoac da thuoc dung cuon nay. bookId null la luc tao sach, khi do chi nhan
 * bia dang cho gan. Dong media bi khoa toi het giao dich cua noi goi, nen hai lan gan cung mot bia cho gan chay cung luc
 * chi mot lan thanh cong. Goi trong giao dich cua createBook va updateBook, truoc khi ghi books.
 */
export async function lockCover(tx: AnyDb, ownerId: string, bookId: string | null, mediaId: string): Promise<boolean> {
  if (!isUuid(mediaId)) return false;
  const [row] = await tx
    .select({ bookId: media.bookId })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.ownerId, ownerId), eq(media.kind, "bia")))
    .for("update");
  return row !== undefined && (row.bookId === null || row.bookId === bookId);
}

/**
 * Gan bia dang cho vao cuon: book_id cua dong media thanh bookId; bia da thuoc cuon thi khong doi. Goi sau lockCover va
 * sau khi dong books da co (khoa ngoai media.book_id), trong cung giao dich. Key object giu tien to cho, vi key khong
 * bao gio doi sau khi put.
 */
export async function attachCover(tx: AnyDb, bookId: string, mediaId: string): Promise<void> {
  await tx.update(media).set({ bookId }).where(and(eq(media.id, mediaId), isNull(media.bookId)));
}

/** Mot anh trong kho bia cua mot cuon. */
export type CoverPhoto = { id: string; createdAt: Date };

/**
 * Kho anh bia cua mot cuon: moi dong media loai bia dang thuoc cuon do, moi nhat truoc. Quyen xet theo CHU CUON chu
 * khong theo nguoi tai len: kho la tai san cua cuon, va cuon cua nguoi khac tra danh sach rong y nhu cuon khong ton tai.
 * Anh trong kho khong bao gio bi thay hay bi don (sweepMedia giu moi bia da thuoc mot cuon), ke ca anh chua o nao chon,
 * nen danh sach nay chi dai ra. Xep them theo id de hai anh tai cung mot khac van co thu tu xac dinh.
 */
export async function khoBia(db: AnyDb, ownerId: string, bookId: string): Promise<CoverPhoto[]> {
  if (!isUuid(bookId)) return [];
  return db
    .select({ id: media.id, createdAt: media.createdAt })
    .from(media)
    .innerJoin(books, eq(books.id, media.bookId))
    .where(and(eq(media.bookId, bookId), eq(media.kind, "bia"), eq(books.ownerId, ownerId)))
    .orderBy(desc(media.createdAt), desc(media.id));
}
