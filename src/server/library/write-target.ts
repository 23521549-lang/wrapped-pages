import { desc, eq, sql } from "drizzle-orm";
import { books, drafts, pages } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/**
 * Cuon ma nut "Trang moi" mo man viet: cuon co ban nhap luu gan nhat cua ownerId; khong co ban nhap thi
 * cuon cua ownerId co hoat dong gan nhat (lan sua hoac tao, va lan dang trang cuoi); khong co cuon nao thi null.
 */
export async function pickWriteTarget(db: AnyDb, ownerId: string): Promise<string | null> {
  const [draft] = await db
    .select({ id: drafts.bookId })
    .from(drafts)
    .innerJoin(books, eq(books.id, drafts.bookId))
    .where(eq(books.ownerId, ownerId))
    .orderBy(desc(drafts.updatedAt))
    .limit(1);
  if (draft) return draft.id;

  // greatest() cua Postgres bo qua NULL, nen cuon chua co to nao chi xet updatedAt.
  const [book] = await db
    .select({ id: books.id })
    .from(books)
    .leftJoin(pages, eq(pages.bookId, books.id))
    .where(eq(books.ownerId, ownerId))
    .groupBy(books.id)
    .orderBy(desc(sql`greatest(${books.updatedAt}, max(${pages.publishedAt}))`), desc(books.createdAt))
    .limit(1);
  return book?.id ?? null;
}
