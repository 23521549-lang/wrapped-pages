import { and, desc, eq, max, notExists, sql } from "drizzle-orm";
import { books, drafts, pages, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookMode, CoverKey } from "@/lib/book";
import { normalizeSheets } from "@/lib/doc/continuation";
import type { DocJson } from "@/lib/doc/types";
import { docExcerpt, trimTrailingBlank } from "@/lib/doc/text";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";
import { isUuid } from "@/lib/uuid";
import { sealTeaser } from "@/lib/seal/teaser";
import type { SealInput } from "@/lib/seal/types";
import { recordActivity } from "@/server/feed/record";
import { bindMedia } from "@/server/media/access";
import { insertSeal } from "@/server/seal/seals";
import { findOwnBook } from "./books";

/**
 * Luu (hoac ghi de) ban nhap duy nhat cua mot cuon. Chi chu sach. Tai lieu qua bindMedia truoc khi ghi: khoi media
 * mang id cua nguoi kia, cua cuon khac, sai loai hay da nam trong to da dang thi khong ghi gi, ban nhap dang co giu
 * nguyen. Nhap luu thuoc tinh media lay tu bang media. Tra thoi diem luu; "not-found" khi khong phai cuon cua ownerId,
 * "invalid-media" khi co khoi media khong gan duoc.
 * Chay trong giao dich va khoa dong sach (FOR UPDATE) nhu editRound va publishDraft: bindMedia cua ba ham doc cac to da
 * dang va ban nhap roi moi ghi, nen phai xep hang tren cung mot khoa. Khong thi mot anh vua tai len co the cung luc lot
 * vao nhap (the nay) va vao to dang sua (the kia), va lan dang nhap sau bi tu choi mai.
 */
export async function saveDraft(
  db: AnyDb, ownerId: string, bookId: string, content: DocJson, sheetCount: number,
): Promise<Date | "not-found" | "invalid-media"> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
      .for("update");
    // Hai duong tra ve som deu nam truoc lenh ghi duy nhat (insert o cuoi), truoc do chi co lenh doc.
    if (!book) return "not-found";
    const bound = await bindMedia(tx, ownerId, book.id, content);
    if (!bound) return "invalid-media";
    const n = Number.isInteger(sheetCount) && sheetCount >= 1 ? Math.min(sheetCount, 999) : 1;
    const now = new Date();
    await tx
      .insert(drafts)
      .values({ bookId: book.id, content: bound, sheetCount: n, updatedAt: now })
      .onConflictDoUpdate({ target: drafts.bookId, set: { content: bound, sheetCount: n, updatedAt: now } });
    return now;
  });
}

/** Ban nhap cua mot cuon. Voi nguoi khong phai chu, no nhu khong ton tai. */
export async function readDraft(db: AnyDb, ownerId: string, bookId: string) {
  const book = await findOwnBook(db, ownerId, bookId);
  if (!book) return null;
  const [row] = await db
    .select({ content: drafts.content, sheetCount: drafts.sheetCount, updatedAt: drafts.updatedAt })
    .from(drafts)
    .where(eq(drafts.bookId, book.id));
  return row ?? null;
}

export type DraftItem = {
  bookId: string; title: string; mode: BookMode; cover: CoverKey; coverMediaId: string | null; sheetCount: number; updatedAt: Date;
  excerpt: string;
  /** Cuon da co to dang: /ban-nhap chi cho bo ban nhap, khong cho xoa sach. */
  hasPages: boolean;
};

/** Moi ban nhap cua rieng ownerId, moi nhat truoc. */
export async function listDrafts(db: AnyDb, ownerId: string): Promise<DraftItem[]> {
  const rows = await db
    .select({
      bookId: drafts.bookId, title: books.title, mode: books.mode, cover: books.cover, coverMediaId: books.coverMediaId,
      sheetCount: drafts.sheetCount, updatedAt: drafts.updatedAt, content: drafts.content,
      hasPages: sql<boolean>`exists (select 1 from ${pages} where ${pages.bookId} = ${drafts.bookId})`.mapWith(Boolean),
    })
    .from(drafts)
    .innerJoin(books, eq(books.id, drafts.bookId))
    .where(eq(books.ownerId, ownerId))
    .orderBy(desc(drafts.updatedAt));
  // rest la vat the moi tao rieng cho tung dong (tu destructuring), khong ai khac giu tham chieu,
  // nen gan thang excerpt vao do re hon tao vat the sao chep lai lan nua.
  return rows.map(({ content, ...rest }) => Object.assign(rest, { excerpt: docExcerpt(content) }));
}

export type UnwrittenBook = { bookId: string; title: string; mode: BookMode; cover: CoverKey; coverMediaId: string | null; createdAt: Date };

/**
 * Cuon cua rieng ownerId chua co to nao va chua co ban nhap (vua tao, chua go chu nao), moi tao truoc. /ban-nhap hien
 * chung canh cac ban nhap de moi cuon chua dang deu xoa duoc tu mot noi.
 */
export async function listUnwrittenBooks(db: AnyDb, ownerId: string): Promise<UnwrittenBook[]> {
  return db
    .select({ bookId: books.id, title: books.title, mode: books.mode, cover: books.cover, coverMediaId: books.coverMediaId, createdAt: books.createdAt })
    .from(books)
    .where(and(
      eq(books.ownerId, ownerId),
      notExists(db.select({ position: pages.position }).from(pages).where(eq(pages.bookId, books.id))),
      notExists(db.select({ bookId: drafts.bookId }).from(drafts).where(eq(drafts.bookId, books.id))),
    ))
    .orderBy(desc(books.createdAt), desc(books.id));
}

/**
 * Moi lan dang la mot luot (bang rounds): mot dong rounds, cac to cung published_at = now. Dau noiTiep cua cac to duoc
 * chuan hoa (normalizeSheets): to dau khong co dau, to sau chi co tren nhanh dau.
 * Dang cac to thanh to that, noi tiep sau to cuoi cua cuon, roi xoa ban nhap.
 * sheets la tai lieu cua tung to do man viet da cat san theo bo xep trang (dong bang nhu sach in).
 * Cac to trong o cuoi bi bo; to chi co media khong trong. Dong sach bi khoa trong giao dich de hai lan dang cung luc
 * khong tranh nhau vi tri; unique index (book_id, position) la lop chan cuoi.
 * Moi to qua bindMedia trong giao dich, sau khi khoa dong sach va truoc khi chen to nao: sai mot id o bat ky to nao
 * thi khong dang gi, va to luu thuoc tinh media lay tu bang media. Id da nam trong to da dang cua cuon bi tu choi, nen
 * khong the dang lai media cua mot to con khoa o to mo.
 * seal gan mot niem phong phu dung cac to cua lan dang nay. Cau do va trao doi chi gan duoc vao sach
 * chia se; che do duoc kiem lai ngay trong giao dich vi no co the bi doi sau luc action doc.
 * Su kien Hoat dong ghi cung giao dich va cung now voi cac to: trao doi thay cho dang-trang, hen gio ghi san
 * mo-hen-gio voi at = opensAt.
 */
export async function publishDraft(
  db: AnyDb, ownerId: string, bookId: string, sheets: DocJson[], seal: SealInput | null = null, now: Date = new Date(),
): Promise<{ firstPosition: number; count: number } | null> {
  if (!isUuid(bookId)) return null;
  const kept = normalizeSheets(trimTrailingBlank(sheets));
  if (kept.length === 0 || kept.length > MAX_SHEETS_PER_PUBLISH) return null;

  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id, mode: books.mode })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
      .for("update");
    // Drizzle COMMIT giao dich khi ham tra ve binh thuong, chi ROLLBACK khi co loi nem ra. Ba duong return duoi day deu
    // nam TRUOC lenh ghi dau tien (tx.insert(rounds) o duoi), va moi thu chay truoc chung chi la lenh doc: SELECT ...
    // FOR UPDATE o tren va bindMedia (chi SELECT). Khong duoc them lenh ghi nao vao khoang nay - lam vay thi mot lan
    // dang bi tu choi se commit nua phan viec da ghi.
    if (!book) return null;
    if (seal && seal.kind !== "hen-gio" && book.mode !== "chia-se") return null;
    const bound = (await Promise.all(kept.map((sheet) => bindMedia(tx, ownerId, book.id, sheet)))).filter((doc) => doc !== null);
    if (bound.length !== kept.length) return null;
    const [{ last }] = await tx.select({ last: max(pages.position) }).from(pages).where(eq(pages.bookId, book.id));
    const first = (last ?? 0) + 1;
    const [round] = await tx.insert(rounds).values({ bookId: book.id, publishedAt: now }).returning({ id: rounds.id });
    const su = { actorId: ownerId, bookId: book.id, roundId: round.id, mode: book.mode, at: now };
    await tx.insert(pages).values(bound.map((content, i) => ({ bookId: book.id, roundId: round.id, position: first + i, content, publishedAt: now })));
    if (seal) {
      const sealId = await insertSeal(tx, book.id, round.id, seal, sealTeaser(bound[0]));
      await recordActivity(tx, { ...su, kind: seal.kind === "trao-doi" ? "moi-trao-doi" : "dang-trang", sealId });
      if (seal.kind === "hen-gio") await recordActivity(tx, { ...su, kind: "mo-hen-gio", sealId, at: seal.opensAt });
    } else {
      await recordActivity(tx, { ...su, kind: "dang-trang", sealId: null });
    }
    await tx.delete(drafts).where(eq(drafts.bookId, book.id));
    return { firstPosition: first, count: bound.length };
  });
}
