import { and, asc, eq, max, sql } from "drizzle-orm";
import { pages, readMarks } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { DocJson } from "@/lib/doc/types";
import type { ReaderSeal, ReaderSheet } from "@/lib/seal/types";
import { isLockedFor, readerSeals, sealAt, sealsOfBook } from "@/server/seal/seals";
import { findReadableBook, type Book } from "./books";

export type ReaderView = { book: Book; mine: boolean; sheets: ReaderSheet[]; seals: ReaderSeal[]; mark: number };

/** Tai lieu dung thay cho to khoa: chi dong he lo, hoac mot doan trong. Khong bao gio chua noi dung that. */
function teaserDoc(teaser: string | null): DocJson {
  return {
    type: "doc",
    content: [teaser ? { type: "paragraph", content: [{ type: "text", text: teaser }] } : { type: "paragraph" }],
  };
}

/**
 * Moi to cua mot cuon theo thu tu, neu viewer duoc doc cuon do. mark la moc da doc cua viewer (0 neu chua doc).
 * To nam trong niem phong con khoa voi viewer duoc thay content bang teaserDoc: noi dung that duoc doc len
 * may chu nhung khong bao gio duoc dat vao doi tuong tra ve. Moi cau lenh doc chung mot anh chup,
 * nen mot publishDraft commit giua chung khong the de lo to vua dang ma thieu niem phong cua no.
 */
export async function readBook(db: AnyDb, viewerId: string, bookId: string, now: Date = new Date()): Promise<ReaderView | null> {
  return readSnapshot(db, async (tx) => {
    const book = await findReadableBook(tx, viewerId, bookId);
    if (!book) return null;
    const mine = book.ownerId === viewerId;
    const [rows, marks, sealRows] = await Promise.all([
      tx
        .select({ position: pages.position, content: pages.content, publishedAt: pages.publishedAt, editedAt: pages.editedAt })
        .from(pages)
        .where(eq(pages.bookId, book.id))
        .orderBy(asc(pages.position)),
      tx
        .select({ position: readMarks.position })
        .from(readMarks)
        .where(and(eq(readMarks.accountId, viewerId), eq(readMarks.bookId, book.id))),
      sealsOfBook(tx, book.id),
    ]);
    const seals = await readerSeals(tx, sealRows, viewerId, mine, now);
    const lockedIds = new Set(seals.filter((s) => s.locked).map((s) => s.id));
    const sheets = rows.map((r): ReaderSheet => {
      const s = sealAt(sealRows, r.position);
      if (!s || !lockedIds.has(s.id)) {
        return {
          position: r.position, publishedAt: r.publishedAt, content: r.content, locked: false, sealId: s?.id ?? null, teaser: null,
          editedAt: r.editedAt,
        };
      }
      const teaser = r.position === s.firstPosition ? s.teaser || null : null;
      // To niem phong khong bao gio sua duoc nen ve nguyen tac khong co edited_at; van tra null o day de mot thay doi
      // luat ve sau khong vo tinh ro sieu du lieu cua to dang khoa.
      return { position: r.position, publishedAt: r.publishedAt, content: teaserDoc(teaser), locked: true, sealId: s.id, teaser, editedAt: null };
    });
    return { book, mine, sheets, seals, mark: marks[0]?.position ?? 0 };
  });
}

/**
 * Day moc da doc cua viewer len toi position, khong bao gio lui va khong vuot to cuoi.
 * Moc cung khong vuot qua to dang khoa dau tien, de to khoa van la trang moi cho toi khi mo va doc that.
 * Chu sach khong co moc; cuon khong duoc doc hoac chua co to nao thi bo qua.
 */
export async function markRead(
  db: AnyDb, viewerId: string, bookId: string, position: number, now: Date = new Date(),
): Promise<void> {
  if (!Number.isInteger(position) || position < 1) return;
  const target = await readSnapshot(db, async (tx) => {
    const book = await findReadableBook(tx, viewerId, bookId);
    if (!book || book.ownerId === viewerId) return null;
    const [[{ last }], sealRows] = await Promise.all([
      tx.select({ last: max(pages.position) }).from(pages).where(eq(pages.bookId, book.id)),
      sealsOfBook(tx, book.id),
    ]);
    if (last === null) return null;
    const firstLocked = sealRows
      .filter((s) => isLockedFor(s, false, now))
      .reduce((min, s) => Math.min(min, s.firstPosition), Number.POSITIVE_INFINITY);
    const cap = Math.min(last, firstLocked - 1);
    return cap < 1 ? null : { bookId: book.id, cap };
  });
  if (!target) return;
  // Ghi ngoai anh chup van an toan: mot lan dang ve sau chi noi them vi tri lon hon to cuoi ma anh chup da thay,
  // va niem phong cua no chi phu cac vi tri do, nen tran tinh tu mot anh chup nhat quan khong the vuot mot to
  // khoa sinh ra sau. Mo niem phong chi bo bot khoa.
  await db
    .insert(readMarks)
    .values({ accountId: viewerId, bookId: target.bookId, position: Math.min(position, target.cap) })
    .onConflictDoUpdate({
      target: [readMarks.accountId, readMarks.bookId],
      set: { position: sql`greatest(${readMarks.position}, excluded.position)` },
    });
}
