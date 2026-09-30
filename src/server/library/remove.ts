import { and, eq, isNull } from "drizzle-orm";
import { books, drafts, pages } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookMode } from "@/lib/book";
import { writableBy } from "./quyen";
import { isUuid } from "@/lib/uuid";

export type DeleteBookResult = "deleted" | "not-found" | "has-pages";
export type DiscardDraftResult = "discarded" | "not-found";

/**
 * Khoa dong sach cua chinh ownerId (FOR UPDATE): xep hang voi publishDraft, saveDraft va editRound tren cung khoa.
 * Chi SELECT ... FOR UPDATE, khong ghi gi, nen goi truoc moi duong tra ve som cua mot giao dich van an toan.
 * Tra ca che do cuon (doc tren chinh dong vua khoa): su kien Hoat dong ghi trong giao dich can biet cuon co chia se.
 */
export async function lockOwnBook(tx: AnyDb, ownerId: string, bookId: string): Promise<{ id: string; mode: BookMode } | null> {
  const [book] = await tx
    .select({ id: books.id, mode: books.mode })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
    .for("update");
  return book ?? null;
}

/**
 * Khoa dong sach ma viewerId la nguoi viet (writableBy, dot nam 5c), FOR UPDATE nhu lockOwnBook va tren cung dong: moi
 * duong ghi cap cuon cua nguoi viet (nhap, dang luot, sua luot, o bia, o nhac) xep hang tren dong sach nay. Chi SELECT ...
 * FOR UPDATE, khong ghi gi. Tra che do, chu cuon va co sach viet cung, doc tren chinh dong vua khoa.
 */
export async function lockWritableBook(
  tx: AnyDb, viewerId: string, bookId: string,
): Promise<{ id: string; mode: BookMode; ownerId: string; vietCung: boolean } | null> {
  const [book] = await tx
    .select({ id: books.id, mode: books.mode, ownerId: books.ownerId, vietCungTu: books.vietCungTu })
    .from(books)
    .where(and(eq(books.id, bookId), writableBy(viewerId)))
    .for("update");
  return book ? { id: book.id, mode: book.mode, ownerId: book.ownerId, vietCung: book.vietCungTu !== null } : null;
}

/**
 * Xoa han mot cuon chua co to da dang cua chinh ownerId, trong mot giao dich: khoa dong sach, kiem khong co dong pages
 * nao, roi xoa sach. Khoa ngoai xoa theo don ban nhap, media (ca bia) va dau doc; object trong kho khong con dong media
 * nen buoc don rac xoa sau MEDIA_ORPHAN_MS. Co to da dang thi "has-pages", khong xoa gi. Khong ghi su kien Hoat dong.
 * Khoa dong sach nen mot lan dang trang cung luc chi co the xong truoc (thi day thay to, tra has-pages) hoac sau (thi
 * no khong thay sach, tra null): khong bao gio dang nua voi.
 * Sach viet cung khong xoa mot minh duoc, ke ca khi chua co trang nao (5c muc D3): "not-found" nhu cuon khong ton tai.
 */
export async function deleteUnpublishedBook(db: AnyDb, ownerId: string, bookId: string): Promise<DeleteBookResult> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<DeleteBookResult> => {
    // Hai duong return som deu nam truoc lenh ghi duy nhat (delete o cuoi); truoc do chi co lenh doc.
    const [sach] = await tx
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId), isNull(books.vietCungTu)))
      .for("update");
    const id = sach?.id;
    if (!id) return "not-found";
    const [page] = await tx.select({ position: pages.position }).from(pages).where(eq(pages.bookId, id)).limit(1);
    if (page) return "has-pages";
    await tx.delete(books).where(and(eq(books.id, id), eq(books.ownerId, ownerId)));
    return "deleted";
  });
}

/**
 * Bo ban nhap CUA CHINH writerId trong mot cuon ho la nguoi viet: xoa dong drafts cua ho; sach, to da dang va nhap cua
 * nguoi viet kia giu nguyen. Anh va ghi am chi nam trong ban nhap thanh mo coi va bi don sau MEDIA_ORPHAN_MS nhu moi media
 * khong con tai lieu nao tham chieu. Khoa dong sach nhu saveDraft de mot lan luu nhap dang chay khong ghi de len ngay sau
 * khi bo. Khong co ban nhap thi "not-found".
 */
export async function discardDraft(db: AnyDb, writerId: string, bookId: string): Promise<DiscardDraftResult> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<DiscardDraftResult> => {
    const id = (await lockWritableBook(tx, writerId, bookId))?.id;
    if (!id) return "not-found";
    const removed = await tx
      .delete(drafts)
      .where(and(eq(drafts.bookId, id), eq(drafts.accountId, writerId)))
      .returning({ bookId: drafts.bookId });
    return removed.length > 0 ? "discarded" : "not-found";
  });
}
