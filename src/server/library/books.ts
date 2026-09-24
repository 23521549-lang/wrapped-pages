import { and, eq, sql, type SQL } from "drizzle-orm";
import { bookCovers, books, bookTracks } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { BookInput, BookSettings, CoverKey } from "@/lib/book";
import { isUuid } from "@/lib/uuid";
import { attachCover, lockCover } from "@/server/media/cover";
import { newestCover, newestTrack } from "./timeline";

export type Book = typeof books.$inferSelect;

/**
 * Book cong ba truong bia va nhac HIEN HANH, ghep tu hai dong thoi gian. Giao dien van dung ba cai ten nay (cover,
 * coverMediaId, youtubeId) nen khong mot thanh phan nao phai doi khi ba cot cu cua books bi bo o 0015.
 */
export type BookView = Book & { cover: CoverKey; coverMediaId: string | null; youtubeId: string | null };

/** Ket qua sua sach. Bia va nhac khong di qua day nua, nen khong con nhanh "invalid-cover". */
export type BookUpdate = "saved" | "not-found";

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
 * Cuon cua chinh ownerId kem bia va nhac hien hanh. Doc trong MOT anh chup (readSnapshot) de dong books, o bia va o
 * nhac luon den tu cung mot trang thai: mot lan Dang chen vao giua khong the ghep bia cua trang thai nay voi nhac cua
 * trang thai kia. Cuon khong con o bia nao tra null: moi cuon luon phai co it nhat mot o bia (bat bien cua book_covers),
 * nen truong hop nay khong bao gio xay ra that, va lang le ve mot bia mac dinh thi la dung mot nguon su that thu hai.
 */
export async function readOwnBook(db: AnyDb, ownerId: string, bookId: string): Promise<BookView | null> {
  return readSnapshot(db, async (tx) => {
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return null;
    const [bia, nhac] = await Promise.all([newestCover(tx, book.id), newestTrack(tx, book.id)]);
    return bia === null ? null : { ...book, ...bia, youtubeId: nhac };
  });
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
    const [row] = await tx.insert(books).values({ ownerId, title: input.title, mode: input.mode }).returning({ id: books.id });
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
 * Doi ten va che do cua mot cuon. Chi chu sach sua duoc; cuon cua nguoi khac la "not-found" nhu cuon khong ton tai.
 * Bia va nhac KHONG o day: chung song o hai dong thoi gian va chi doi qua setCoverEntry / setTrackEntry, de mot gia tri
 * khong co hai duong ghi.
 */
export async function updateBook(db: AnyDb, ownerId: string, bookId: string, input: BookSettings): Promise<BookUpdate> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<BookUpdate> => {
    // Nhu createBook: return trong giao dich la COMMIT chu khong phai ROLLBACK, nen duong return duoi day chi dung chung
    // nao truoc no chi con lenh doc - findOwnBook la SELECT. Lenh ghi duy nhat (tx.update) nam sau no.
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return "not-found";
    await tx.update(books).set({ ...input, updatedAt: new Date() }).where(and(eq(books.id, book.id), eq(books.ownerId, ownerId)));
    return "saved";
  });
}
