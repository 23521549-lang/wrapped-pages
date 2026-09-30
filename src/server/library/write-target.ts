import { and, desc, eq, sql } from "drizzle-orm";
import { books, drafts, pages } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { writableBy } from "./books";

/**
 * Cuon ma nut "Trang moi" mo man viet: cuon co ban nhap luu gan nhat CUA CHINH accountId; khong co ban nhap thi cuon
 * accountId viet duoc (cua minh, hay sach viet cung) co hoat dong gan nhat (lan sua hoac tao, va lan dang trang cuoi);
 * khong co cuon nao thi null. Nhap cua nguoi viet kia khong bao gio keo nguoi nay toi dau.
 * Hai cau doc doc lap, nen chay song song: mot vong mang thay vi hai khi chua co nhap.
 */
export async function pickWriteTarget(db: AnyDb, accountId: string): Promise<string | null> {
  const [[draft], [book]] = await Promise.all([
    db
      .select({ id: drafts.bookId })
      .from(drafts)
      .innerJoin(books, eq(books.id, drafts.bookId))
      .where(and(eq(drafts.accountId, accountId), writableBy(accountId)))
      .orderBy(desc(drafts.updatedAt))
      .limit(1),
    // greatest() cua Postgres bo qua NULL, nen cuon chua co to nao chi xet updatedAt.
    db
      .select({ id: books.id })
      .from(books)
      .leftJoin(pages, eq(pages.bookId, books.id))
      .where(writableBy(accountId))
      .groupBy(books.id)
      .orderBy(desc(sql`greatest(${books.updatedAt}, max(${pages.publishedAt}))`), desc(books.createdAt))
      .limit(1),
  ]);
  return draft?.id ?? book?.id ?? null;
}
