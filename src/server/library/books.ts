import { and, eq, sql, type SQL } from "drizzle-orm";
import { bookCovers, books, bookTracks } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookInput } from "@/lib/book";
import { isUuid } from "@/lib/uuid";
import { attachCover, lockCover } from "@/server/media/cover";

export type Book = typeof books.$inferSelect;

/** Ket qua sua sach. "invalid-cover": bia tu tai len khong dung duoc cho cuon nay (xem lockCover). */
export type BookUpdate = "saved" | "not-found" | "invalid-cover";

/**
 * Luat "viewer duoc doc cuon nay" viet bang SQL tren bang books: cua chinh minh, hoac cuon o che do chia se (web chi
 * co hai nguoi, nen cuon chia se khong phai cua minh thi la cua nguoi kia). Moi truy van can luat nay dung chung ham
 * nay de luat chi nam mot cho.
 */
export function readableBy(viewerId: string): SQL {
  return sql`(${eq(books.ownerId, viewerId)} or ${eq(books.mode, "chia-se")})`;
}

/** Cuon viewer duoc doc (readableBy). Khong duoc doc thi tra null, giong het nhu cuon do khong ton tai. */
export async function findReadableBook(db: AnyDb, viewerId: string, bookId: string): Promise<Book | null> {
  if (!isUuid(bookId)) return null;
  const [row] = await db.select().from(books).where(and(eq(books.id, bookId), readableBy(viewerId)));
  return row ?? null;
}

/** Cuon cua chinh ownerId. Moi thao tac ghi di qua day. */
export async function findOwnBook(db: AnyDb, ownerId: string, bookId: string): Promise<Book | null> {
  if (!isUuid(bookId)) return null;
  const [row] = await db.select().from(books).where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)));
  return row ?? null;
}

/**
 * Tao cuon moi cua ownerId. Co bia tu tai len thi trong cung giao dich: khoa va kiem bia (lockCover chi nhan bia
 * dang cho gan cua chinh ownerId), tao cuon, roi gan bia vao cuon. Bia khong dung duoc thi tra null va khong tao gi.
 * Khong co bia tu tai len thi luon tao duoc, nen kieu tra ve khi coverMediaId la null khong co null.
 */
export function createBook(db: AnyDb, ownerId: string, input: BookInput & { coverMediaId: null }): Promise<string>;
export function createBook(db: AnyDb, ownerId: string, input: BookInput): Promise<string | null>;
export async function createBook(db: AnyDb, ownerId: string, input: BookInput): Promise<string | null> {
  const { coverMediaId } = input;
  return db.transaction(async (tx) => {
    // Drizzle COMMIT giao dich khi ham tra ve binh thuong, chi ROLLBACK khi co loi nem ra. Nen moi duong return sau day
    // chi an toan chung nao KHONG co lenh ghi nao chay truoc no: lockCover chi SELECT ... FOR UPDATE (khoa dong, khong
    // ghi), nen tra null o day la commit mot giao dich khong sua gi. Them buoc ghi nao truoc dong nay thi phai doi sang
    // nem loi de rollback.
    if (coverMediaId !== null && !(await lockCover(tx, ownerId, null, coverMediaId))) return null;
    const [row] = await tx.insert(books).values({ ownerId, ...input }).returning({ id: books.id });
    if (coverMediaId !== null) await attachCover(tx, row.id, coverMediaId);
    // O MO DAU cua hai dong thoi gian, chen ngay trong giao dich tao sach: cuon vua tao chua dang luot nao van dung tren
    // ke va van phai co bia de ve. Day la lop dau cua bat bien "moi cuon luon con it nhat mot o bia".
    await tx.insert(bookCovers).values({ bookId: row.id, roundId: null, cover: input.cover, coverMediaId });
    if (input.youtubeId !== null) {
      await tx.insert(bookTracks).values({ bookId: row.id, roundId: null, youtubeId: input.youtubeId });
    }
    return row.id;
  });
}

/**
 * Doi ten, che do, bia, nhac nen. Chi chu sach sua duoc; cuon cua nguoi khac la "not-found" nhu cuon khong ton tai.
 * Bia tu tai len phai la bia cua chinh chu, dang cho gan hoac da thuoc cuon nay (lockCover); bia cho gan duoc gan vao
 * cuon trong cung giao dich. coverMediaId null la bo bia tu tai len, ve lai tranh ve san.
 */
export async function updateBook(db: AnyDb, ownerId: string, bookId: string, input: BookInput): Promise<BookUpdate> {
  if (!isUuid(bookId)) return "not-found";
  const { coverMediaId } = input;
  return db.transaction(async (tx): Promise<BookUpdate> => {
    // Nhu createBook: return trong giao dich la COMMIT chu khong phai ROLLBACK, nen hai duong return duoi day chi dung
    // chung nao truoc chung chi con lenh doc - findOwnBook la SELECT, lockCover la SELECT ... FOR UPDATE. Lenh ghi dau
    // tien (tx.update) nam sau ca hai, va phai giu nguyen thu tu do.
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return "not-found";
    if (coverMediaId !== null && !(await lockCover(tx, ownerId, book.id, coverMediaId))) return "invalid-cover";
    await tx.update(books).set({ ...input, updatedAt: new Date() }).where(and(eq(books.id, book.id), eq(books.ownerId, ownerId)));
    if (coverMediaId !== null) await attachCover(tx, book.id, coverMediaId);
    return "saved";
  });
}
