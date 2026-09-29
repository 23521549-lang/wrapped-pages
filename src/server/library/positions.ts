import { and, eq, max } from "drizzle-orm";
import { books, pages, readingPositions } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";
import { readableBy } from "./books";

/**
 * Luu trang dang doc do cua viewerId trong mot cuon (spec 5a muc F1): cuon viewer doc duoc (chu sach, hay cuon chia se
 * cua nguoi kia) va trang co that trong cuon. Moi tai khoan mot dong moi cuon, lan sau ghi de. Tra false khi khong luu
 * (dau vao sai, khong doc duoc cuon, trang khong ton tai), giong nhau cho moi truong hop: khong lo cuon nao ton tai.
 */
export async function savePosition(
  db: AnyDb, viewerId: string, bookId: string, position: number, now: Date = new Date(),
): Promise<boolean> {
  if (!isUuid(bookId) || !Number.isInteger(position) || position < 1) return false;
  return db.transaction(async (tx) => {
    // Khoa chia se dong sach nhu markRead: doi che do hay xoa cuon cho lenh ghi nay xong, khong chen vao giua.
    const [book] = await tx
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), readableBy(viewerId)))
      .for("share");
    if (!book) return false;
    const [{ cuoi }] = await tx.select({ cuoi: max(pages.position) }).from(pages).where(eq(pages.bookId, book.id));
    // Duong tra ve nay nam truoc lenh ghi duy nhat, truoc do chi co lenh doc.
    if (cuoi === null || position > cuoi) return false;
    await tx
      .insert(readingPositions)
      .values({ accountId: viewerId, bookId: book.id, position, updatedAt: now })
      .onConflictDoUpdate({
        target: [readingPositions.accountId, readingPositions.bookId],
        set: { position, updatedAt: now },
      });
    return true;
  });
}
