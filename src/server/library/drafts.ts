import { and, desc, eq, max, notExists, sql } from "drizzle-orm";
import { bookCovers, books, bookTracks, drafts, pages, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { COVERS, type BookMode, type CoverKey } from "@/lib/book";
import { normalizeSheets } from "@/lib/doc/continuation";
import { TRANG_TRONG, type DocJson } from "@/lib/doc/types";
import { docExcerpt, trimTrailingBlank } from "@/lib/doc/text";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";
import { isUuid } from "@/lib/uuid";
import { YOUTUBE_ID } from "@/lib/youtube";
import { sealTeaser } from "@/lib/seal/teaser";
import type { SealInput } from "@/lib/seal/types";
import { recordActivity } from "@/server/feed/record";
import { bindMedia } from "@/server/media/access";
import { attachCover, lockCover } from "@/server/media/cover";
import { insertSeal } from "@/server/seal/seals";
import { findOwnBook } from "./books";
import { lockOwnBook } from "./remove";

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

/** Hai o ma nguoi viet chon o trang Viet tiep, chua thanh o that: chung chi thanh o luc dang. */
export type DraftTrim = {
  /** null la luot nay khong them o bia nao. */
  cover: CoverKey | null;
  /** Chi co nghia khi cover khac null. */
  coverMediaId: string | null;
  /** Ma video cua o nhac; null cong dropTrack false la luot nay khong them o nhac nao. */
  youtubeId: string | null;
  /** Luot nay la o GO NHAC. Khong di cung mot ma video. */
  dropTrack: boolean;
};

export type DraftTrimResult = "saved" | "not-found" | "invalid" | "invalid-cover";

/**
 * Ghi lua chon bia va nhac cua LUOT SAP DANG vao chinh dong drafts cua cuon. Mot o chi ton tai khi co luot, ma luot chi
 * sinh ra luc dang, nen ban nhap (luot dang soan) la cho tu nhien nhat de giu ba gia tri nay; dung round_id null la
 * khong duoc vi cho do da la o mo dau.
 * KHONG cham content va sheet_count: nhap dang co chu khong duoc bi xoa. Cuon chua co nhap thi tao dong nhap voi
 * TRANG_TRONG, dung tai lieu man viet dung lam trang trong; tu luc do cuon roi muc "chua viet" sang muc ban nhap.
 * Chay trong giao dich va khoa dong sach (FOR UPDATE) nhu saveDraft va publishDraft, roi moi lockCover: giu dung thu tu
 * khoa thuong truc cua du an. Tra "invalid" khi gia tri tu no da sai, "invalid-cover" khi anh bia khong dung duoc cho
 * cuon nay.
 */
export async function setDraftTrim(
  db: AnyDb, ownerId: string, bookId: string, trim: DraftTrim, now: Date = new Date(),
): Promise<DraftTrimResult> {
  if (!isUuid(bookId)) return "not-found";
  const { cover, coverMediaId, youtubeId, dropTrack } = trim;
  if (cover !== null && !(COVERS as readonly string[]).includes(cover)) return "invalid";
  if (coverMediaId !== null && (cover === null || !isUuid(coverMediaId))) return "invalid";
  if (youtubeId !== null && !YOUTUBE_ID.test(youtubeId)) return "invalid";
  if (dropTrack && youtubeId !== null) return "invalid";
  return db.transaction(async (tx): Promise<DraftTrimResult> => {
    // Hai duong tra ve som deu nam truoc lenh ghi dau tien (insert o duoi); truoc do chi co lenh doc:
    // lockOwnBook la SELECT ... FOR UPDATE, lockCover cung vay.
    const id = await lockOwnBook(tx, ownerId, bookId);
    if (!id) return "not-found";
    if (coverMediaId !== null && !(await lockCover(tx, ownerId, id, coverMediaId))) return "invalid-cover";
    await tx
      .insert(drafts)
      .values({ bookId: id, content: TRANG_TRONG, cover, coverMediaId, youtubeId, dropTrack, updatedAt: now })
      .onConflictDoUpdate({ target: drafts.bookId, set: { cover, coverMediaId, youtubeId, dropTrack, updatedAt: now } });
    // Gan anh vao cuon ngay: tu day no la tai san cua cuon, nen buoc don rac khong bao gio cham toi no nua.
    if (coverMediaId !== null) await attachCover(tx, id, coverMediaId);
    return "saved";
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
 * Lua chon bia va nhac cua luot nam tren dong nhap (setDraftTrim) va thanh o that o day: nhieu nhat mot o bia va mot o
 * nhac cho moi luot, ep bang chi muc unique (round_id). Nhap khong chon gi thi lan dang nay khong sinh o nao va cuon
 * giu nguyen bia voi nhac dang co.
 * seal gan mot niem phong phu dung cac to cua lan dang nay. Cau do va trao doi chi gan duoc vao sach
 * chia se; che do duoc kiem lai ngay trong giao dich vi no co the bi doi sau luc action doc.
 * Su kien Hoat dong ghi cung giao dich va cung now voi cac to: trao doi thay cho dang-trang, hen gio ghi san
 * mo-hen-gio voi at = opensAt.
 */
export async function publishDraft(
  db: AnyDb, ownerId: string, bookId: string, sheets: DocJson[], seal: SealInput | null = null, now: Date = new Date(),
): Promise<{ firstPosition: number; count: number } | "invalid-cover" | null> {
  if (!isUuid(bookId)) return null;
  const kept = normalizeSheets(trimTrailingBlank(sheets));
  if (kept.length === 0 || kept.length > MAX_SHEETS_PER_PUBLISH) return null;

  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id, mode: books.mode })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
      .for("update");
    // Drizzle COMMIT giao dich khi ham tra ve binh thuong, chi ROLLBACK khi co loi nem ra. Bon duong return duoi day deu
    // nam TRUOC lenh ghi dau tien (tx.insert(rounds)), va moi thu chay truoc chung chi la lenh doc: SELECT ... FOR UPDATE
    // o tren, cau doc dong nhap, lockCover (cung la SELECT ... FOR UPDATE) va bindMedia (chi SELECT). Khong duoc them
    // lenh ghi nao vao khoang nay - lam vay thi mot lan dang bi tu choi se commit nua phan viec da ghi.
    if (!book) return null;
    if (seal && seal.kind !== "hen-gio" && book.mode !== "chia-se") return null;
    // Hai o cua luot nam san tren dong nhap. Doc TRUOC khi xoa nhap o cuoi giao dich, va khoa anh bia ngay day: no co
    // the da bi doi chu hay da thuoc cuon khac tu luc chon toi luc dang.
    const [nhap] = await tx
      .select({ cover: drafts.cover, coverMediaId: drafts.coverMediaId, youtubeId: drafts.youtubeId, dropTrack: drafts.dropTrack })
      .from(drafts)
      .where(eq(drafts.bookId, book.id));
    const oBia = nhap !== undefined && nhap.cover !== null ? { cover: nhap.cover, coverMediaId: nhap.coverMediaId } : null;
    if (oBia !== null && oBia.coverMediaId !== null && !(await lockCover(tx, ownerId, book.id, oBia.coverMediaId))) return "invalid-cover";
    const bound = (await Promise.all(kept.map((sheet) => bindMedia(tx, ownerId, book.id, sheet)))).filter((doc) => doc !== null);
    if (bound.length !== kept.length) return null;
    const [{ last }] = await tx.select({ last: max(pages.position) }).from(pages).where(eq(pages.bookId, book.id));
    const first = (last ?? 0) + 1;
    const [round] = await tx.insert(rounds).values({ bookId: book.id, publishedAt: now }).returning({ id: rounds.id });
    const su = { actorId: ownerId, bookId: book.id, roundId: round.id, mode: book.mode, at: now };
    await tx.insert(pages).values(bound.map((content, i) => ({ bookId: book.id, roundId: round.id, position: first + i, content, publishedAt: now })));
    // Thu tu khoa giu nguyen luat thuong truc: dong books da khoa o dau giao dich, roi toi anh bia (lockCover), roi moi
    // toi rounds va hai dong thoi gian. Khong bao gio khoa rounds truoc books.
    // Anh bia da thuoc cuon tu luc chon (setDraftTrim gan ngay), nen o day khong con gi de gan nua.
    if (oBia !== null) await tx.insert(bookCovers).values({ bookId: book.id, roundId: round.id, ...oBia });
    // Nhap co ma video la them o nhac; dropTrack la them o GO NHAC, tuc mot o that mang null. Khong co ca hai thi luot
    // nay khong dung toi nhac va cuon giu nguyen ban dang phat.
    if (nhap !== undefined && (nhap.youtubeId !== null || nhap.dropTrack)) {
      await tx.insert(bookTracks).values({ bookId: book.id, roundId: round.id, youtubeId: nhap.youtubeId });
    }
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
