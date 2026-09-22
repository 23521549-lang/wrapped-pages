import { and, eq } from "drizzle-orm";
import { books, drafts, pages } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";

export type DeleteBookResult = "deleted" | "not-found" | "has-pages";
export type DiscardDraftResult = "discarded" | "not-found";

/**
 * Khoa dong sach cua chinh ownerId (FOR UPDATE): xep hang voi publishDraft, saveDraft va editRound tren cung khoa.
 * Chi SELECT ... FOR UPDATE, khong ghi gi, nen goi truoc moi duong tra ve som cua mot giao dich van an toan.
 */
export async function lockOwnBook(tx: AnyDb, ownerId: string, bookId: string): Promise<string | null> {
  const [book] = await tx
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
    .for("update");
  return book?.id ?? null;
}

/**
 * Xoa han mot cuon chua co to da dang cua chinh ownerId, trong mot giao dich: khoa dong sach, kiem khong co dong pages
 * nao, roi xoa sach. Khoa ngoai xoa theo don ban nhap, media (ca bia) va dau doc; object trong kho khong con dong media
 * nen buoc don rac xoa sau MEDIA_ORPHAN_MS. Co to da dang thi "has-pages", khong xoa gi. Khong ghi su kien Hoat dong.
 * Khoa dong sach nen mot lan dang trang cung luc chi co the xong truoc (thi day thay to, tra has-pages) hoac sau (thi
 * no khong thay sach, tra null): khong bao gio dang nua voi.
 */
export async function deleteUnpublishedBook(db: AnyDb, ownerId: string, bookId: string): Promise<DeleteBookResult> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<DeleteBookResult> => {
    // Hai duong return som deu nam truoc lenh ghi duy nhat (delete o cuoi); truoc do chi co lenh doc.
    const id = await lockOwnBook(tx, ownerId, bookId);
    if (!id) return "not-found";
    const [page] = await tx.select({ position: pages.position }).from(pages).where(eq(pages.bookId, id)).limit(1);
    if (page) return "has-pages";
    await tx.delete(books).where(and(eq(books.id, id), eq(books.ownerId, ownerId)));
    return "deleted";
  });
}

/**
 * Bo ban nhap cua mot cuon cua chinh ownerId: xoa dong drafts, sach va to da dang giu nguyen. Anh va ghi am chi nam
 * trong ban nhap thanh mo coi va bi don sau MEDIA_ORPHAN_MS nhu moi media khong con tai lieu nao tham chieu. Khoa dong
 * sach nhu saveDraft de mot lan luu nhap dang chay khong ghi de len ngay sau khi bo. Khong co ban nhap thi "not-found".
 */
export async function discardDraft(db: AnyDb, ownerId: string, bookId: string): Promise<DiscardDraftResult> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<DiscardDraftResult> => {
    const id = await lockOwnBook(tx, ownerId, bookId);
    if (!id) return "not-found";
    const removed = await tx.delete(drafts).where(eq(drafts.bookId, id)).returning({ bookId: drafts.bookId });
    return removed.length > 0 ? "discarded" : "not-found";
  });
}
