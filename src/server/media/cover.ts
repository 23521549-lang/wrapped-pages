import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { books, media } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";
import { writableBy } from "@/server/library/quyen";

/**
 * Bia tu tai len co dung duoc cho cuon bookId khong, chong muon id: mediaId phai la dong media loai bia, va hoac dang cho
 * gan (book_id null) VA do chinh actorId tai len, hoac da thuoc dung cuon nay VA (do chinh actorId tai len, hay cuon la
 * sach viet cung: kho anh cua cuon ai tai len thi hai nguoi viet cung dung chung, 5c). bookId null la luc tao sach, khi do
 * chi nhan bia dang cho gan cua chinh minh. Noi goi da kiem actorId la nguoi viet cua bookId (khoa dong sach truoc). Chi
 * khoa dong media (FOR UPDATE OF media), dong books da do noi goi khoa; hai lan gan cung mot bia cho gan chay cung luc chi
 * mot lan thanh cong.
 */
export async function lockCover(tx: AnyDb, actorId: string, bookId: string | null, mediaId: string): Promise<boolean> {
  if (!isUuid(mediaId)) return false;
  const [row] = await tx
    .select({ bookId: media.bookId, ownerId: media.ownerId, vietCungTu: books.vietCungTu })
    .from(media)
    .leftJoin(books, eq(books.id, media.bookId))
    .where(and(eq(media.id, mediaId), eq(media.kind, "bia")))
    .for("update", { of: media });
  if (row === undefined) return false;
  if (row.bookId === null) return row.ownerId === actorId;
  return bookId !== null && row.bookId === bookId && (row.ownerId === actorId || row.vietCungTu !== null);
}

/**
 * Gan bia dang cho vao cuon: book_id cua dong media thanh bookId; bia da thuoc cuon thi khong doi. Goi sau lockCover va
 * sau khi dong books da co (khoa ngoai media.book_id), trong cung giao dich. Key object giu tien to cho, vi key khong
 * bao gio doi sau khi put.
 */
export async function attachCover(tx: AnyDb, bookId: string, mediaId: string): Promise<void> {
  await tx.update(media).set({ bookId }).where(and(eq(media.id, mediaId), isNull(media.bookId)));
}

/** Mot anh trong kho bia cua mot cuon. cuaToi: nguoi xem tai len (sach viet cung co anh cua ca hai, 5c). */
export type CoverPhoto = { id: string; createdAt: Date; cuaToi: boolean };

/**
 * Kho anh bia cua mot cuon: moi dong media loai bia dang thuoc cuon do, moi nhat truoc. Quyen xet theo NGUOI VIET cua
 * cuon (chu cuon, hay ca hai o sach viet cung, 5c) chu khong theo nguoi tai len: kho la tai san cua cuon, va cuon nguoi
 * xem khong viet duoc tra danh sach rong y nhu cuon khong ton tai.
 * Anh trong kho khong bao gio bi thay hay bi don (sweepMedia giu moi bia da thuoc mot cuon), ke ca anh chua o nao chon,
 * nen danh sach nay chi dai ra. Xep them theo id de hai anh tai cung mot khac van co thu tu xac dinh.
 */
export async function khoBia(db: AnyDb, viewerId: string, bookId: string): Promise<CoverPhoto[]> {
  if (!isUuid(bookId)) return [];
  return db
    .select({ id: media.id, createdAt: media.createdAt, cuaToi: sql<boolean>`${media.ownerId} = ${viewerId}`.mapWith(Boolean) })
    .from(media)
    .innerJoin(books, eq(books.id, media.bookId))
    .where(and(eq(media.bookId, bookId), eq(media.kind, "bia"), writableBy(viewerId)))
    .orderBy(desc(media.createdAt), desc(media.id));
}
