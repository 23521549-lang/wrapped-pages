import { and, eq } from "drizzle-orm";
import { bookCovers, books, bookTracks } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { GOP_DOI_MS, ghiHayGop, recordActivity } from "@/server/feed/record";
import type { BookInput, BookSettings, CoverKey } from "@/lib/book";
import { isUuid } from "@/lib/uuid";
import { attachCover, lockCover } from "@/server/media/cover";
import { deNghiDangCho, ghiMoiViet, rutDeNghi } from "@/server/viet-cung/de-nghi";
import { readableBy, writableBy } from "./quyen";
import { newestCover, newestTrack } from "./timeline";

export type Book = typeof books.$inferSelect;

/**
 * Book cong ba truong bia va nhac HIEN HANH, ghep tu hai dong thoi gian. Giao dien van dung ba cai ten nay (cover,
 * coverMediaId, youtubeId) nen khong mot thanh phan nao phai doi khi ba cot cu cua books bi bo o 0015.
 */
export type BookView = Book & { cover: CoverKey; coverMediaId: string | null; youtubeId: string | null };

/** Ket qua sua sach. Bia va nhac khong di qua day nua, nen khong con nhanh "invalid-cover". */
export type BookUpdate = "saved" | "not-found";

export { readableBy } from "./quyen";

/** Cuon viewer duoc doc (readableBy). Khong duoc doc thi tra null, giong het nhu cuon do khong ton tai. */
export async function findReadableBook(db: AnyDb, viewerId: string, bookId: string): Promise<Book | null> {
  if (!isUuid(bookId)) return null;
  const [row] = await db.select().from(books).where(and(eq(books.id, bookId), readableBy(viewerId)));
  return row ?? null;
}

/** Cuon cua chinh ownerId (nguoi tao). Chi cac thao tac cua rieng chu cuon di qua day: doi che do, moi viet cung. */
export async function findOwnBook(db: AnyDb, ownerId: string, bookId: string): Promise<Book | null> {
  if (!isUuid(bookId)) return null;
  const [row] = await db.select().from(books).where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)));
  return row ?? null;
}

/** Cuon viewer la nguoi viet (writableBy). Khong phai thi null, nhu cuon khong ton tai. */
export async function findWritableBook(db: AnyDb, viewerId: string, bookId: string): Promise<Book | null> {
  if (!isUuid(bookId)) return null;
  const [row] = await db.select().from(books).where(and(eq(books.id, bookId), writableBy(viewerId)));
  return row ?? null;
}

/**
 * Cuon cua chinh ownerId kem bia va nhac hien hanh. Doc trong MOT anh chup (readSnapshot) de dong books, o bia va o
 * nhac luon den tu cung mot trang thai: mot lan Dang chen vao giua khong the ghep bia cua trang thai nay voi nhac cua
 * trang thai kia. Cuon khong con o bia nao tra null: moi cuon luon phai co it nhat mot o bia (bat bien cua book_covers),
 * nen truong hop nay khong bao gio xay ra that, va lang le ve mot bia mac dinh thi la dung mot nguon su that thu hai.
 */
export async function readOwnBook(db: AnyDb, ownerId: string, bookId: string): Promise<BookView | null> {
  return docKemBiaNhac(db, (tx) => findOwnBook(tx, ownerId, bookId));
}

/** Nhu readOwnBook, cho nguoi viet cua cuon (writableBy): man viet, trang Viet tiep, Sua sach. */
export async function readWritableBook(db: AnyDb, viewerId: string, bookId: string): Promise<BookView | null> {
  return docKemBiaNhac(db, (tx) => findWritableBook(tx, viewerId, bookId));
}

/** Doc dong books bang ham tim roi ghep bia va nhac hien hanh, trong mot anh chup. */
function docKemBiaNhac(db: AnyDb, tim: (tx: AnyDb) => Promise<Book | null>): Promise<BookView | null> {
  return readSnapshot(db, async (tx) => {
    const book = await tim(tx);
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
export function createBook(db: AnyDb, ownerId: string, input: BookInput & { coverMediaId: null }, now?: Date): Promise<string>;
export function createBook(db: AnyDb, ownerId: string, input: BookInput, now?: Date): Promise<string | null>;
export async function createBook(db: AnyDb, ownerId: string, input: BookInput, now: Date = new Date()): Promise<string | null> {
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
    await recordActivity(tx, { kind: "tao-sach", actorId: ownerId, at: now, bookId: row.id, mode: input.mode });
    // Chon "Viết cùng" (5c muc C1): cuon chia se, gui loi moi ngay. Chua co nguoi kia thi cuon van tao, khong co loi moi.
    if (input.moi && input.mode === "chia-se") await ghiMoiViet(tx, { id: row.id, ownerId, mode: "chia-se", vietCungTu: null }, now);
    return row.id;
  });
}

/**
 * Doi ten (chu de) va che do cua mot cuon. Nguoi viet cua cuon sua duoc (chu cuon, hay ca hai o sach viet cung, 5c);
 * nguoi khac nhan "not-found" nhu cuon khong ton tai. Sach viet cung luon chia se: che do gui len bi bo qua (Sua sach cua
 * no khong co lua chon che do, va CHECK books_viet_cung la lop chan cuoi).
 * Bia va nhac KHONG o day: chung song o hai dong thoi gian va chi doi qua setCoverEntry / setTrackEntry, de mot gia tri
 * khong co hai duong ghi.
 */
export async function updateBook(
  db: AnyDb, writerId: string, bookId: string, input: BookSettings, now: Date = new Date(),
): Promise<BookUpdate> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<BookUpdate> => {
    // Nhu createBook: return trong giao dich la COMMIT chu khong phai ROLLBACK, nen duong return duoi day chi dung chung
    // nao truoc no chi con lenh doc. Khoa dong sach (FOR UPDATE) nhu moi duong ghi khac cua cuon: de nghi viet cung doc
    // va ghi o duoi phai xep hang voi xin, nhan loi, rut.
    const [book] = await tx.select().from(books).where(and(eq(books.id, bookId), writableBy(writerId))).for("update");
    if (!book) return "not-found";
    const vietCung = book.vietCungTu !== null;
    // Chon "Viết cùng" thi cuon phai chia se de nguoi kia doc duoc loi moi.
    const mode = vietCung || input.moi ? "chia-se" : input.mode;
    await tx.update(books).set({ title: input.title, mode, updatedAt: now }).where(eq(books.id, book.id));
    if (!vietCung) {
      // Chi chu cuon toi day (sach mot nguoi viet: nguoi viet la chu). 5c muc C1, C5, C6: chon "Viết cùng" thi moi (hay
      // dong y loi xin dang cho); bo chon thi rut loi moi cua minh; chuyen rieng tu thi rut ca loi xin cua nguoi kia.
      const cho = await deNghiDangCho(tx, book.id);
      if (input.moi) await ghiMoiViet(tx, { ...book, mode }, now);
      else if (cho !== null && (cho.loai === "moi-viet" || mode === "rieng-tu")) await rutDeNghi(tx, cho);
    }
    if (input.title !== book.title) {
      await ghiHayGop(tx, {
        kind: "doi-ten-sach", actorId: writerId, at: now, bookId: book.id, mode,
        detail: { truoc: book.title, sau: input.title },
      }, GOP_DOI_MS);
    }
    return "saved";
  });
}
