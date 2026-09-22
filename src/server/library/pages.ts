import { and, asc, eq, max, sql } from "drizzle-orm";
import { books, pages, readMarks } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { DocJson } from "@/lib/doc/types";
import type { ReaderReply } from "@/lib/round-reply";
import type { ReaderRound, ReaderSeal, ReaderSheet } from "@/lib/seal/types";
import { isUuid } from "@/lib/uuid";
import { closedToPartner, isLockedFor, readerSeals, sealsOfBook } from "@/server/seal/seals";
import { findReadableBook, readableBy, type Book } from "./books";
import { repliesOfBook } from "./round-replies";
import { roundsOfBook } from "./rounds";

export type ReaderView = {
  book: Book; mine: boolean; sheets: ReaderSheet[]; seals: ReaderSeal[]; rounds: ReaderRound[]; replies: ReaderReply[]; mark: number;
};

/** Tai lieu dung thay cho to khoa: chi dong he lo, hoac mot doan trong. Khong bao gio chua noi dung that. */
function teaserDoc(teaser: string | null): DocJson {
  return {
    type: "doc",
    content: [teaser ? { type: "paragraph", content: [{ type: "text", text: teaser }] } : { type: "paragraph" }],
  };
}

/**
 * Moi to cua mot cuon theo thu tu, neu viewer duoc doc cuon do, kem cac luot dang. mark la moc da doc cua viewer (0 neu
 * chua doc). To nam trong niem phong con khoa voi viewer duoc thay content bang teaserDoc: noi dung that duoc doc len
 * may chu nhung khong bao gio duoc dat vao doi tuong tra ve. Moi cau lenh doc chung mot anh chup, nen mot publishDraft
 * hay editRound commit giua chung khong the de lo to vua dang ma thieu niem phong cua no.
 * replies: loi hoi dap cua cac luot, chi voi sach dang chia se (sach rieng tu khong co khung hoi dap, nen khong doc bang
 * round_replies).
 */
export async function readBook(db: AnyDb, viewerId: string, bookId: string, now: Date = new Date()): Promise<ReaderView | null> {
  return readSnapshot(db, async (tx) => {
    const book = await findReadableBook(tx, viewerId, bookId);
    if (!book) return null;
    const mine = book.ownerId === viewerId;
    const [rows, marks, sealRows, luot, replies] = await Promise.all([
      tx
        .select({ position: pages.position, content: pages.content, publishedAt: pages.publishedAt, roundId: pages.roundId })
        .from(pages)
        .where(eq(pages.bookId, book.id))
        .orderBy(asc(pages.position)),
      tx
        .select({ position: readMarks.position })
        .from(readMarks)
        .where(and(eq(readMarks.accountId, viewerId), eq(readMarks.bookId, book.id))),
      sealsOfBook(tx, book.id),
      roundsOfBook(tx, book.id),
      book.mode === "chia-se" ? repliesOfBook(tx, book.id) : Promise.resolve<ReaderReply[]>([]),
    ]);
    const seals = await readerSeals(tx, sealRows, viewerId, mine, now);
    const lockedIds = new Set(seals.filter((s) => s.locked).map((s) => s.id));
    const niemCua = new Map(sealRows.map((s) => [s.roundId, s]));
    const suaLuc = new Map(luot.map((r) => [r.id, r.editedAt]));
    const sheets = rows.map((r): ReaderSheet => {
      const s = niemCua.get(r.roundId);
      if (!s || !lockedIds.has(s.id)) {
        return {
          position: r.position, publishedAt: r.publishedAt, content: r.content, locked: false, sealId: s?.id ?? null, teaser: null,
          roundId: r.roundId, editedAt: suaLuc.get(r.roundId) ?? null,
        };
      }
      const teaser = r.position === s.firstPosition ? s.teaser || null : null;
      // Luot con khoa voi nguoi xem khong lo moc sua: niem phong con dong thi luot chua sua duoc, nhung giu lop chan
      // nay de mot thay doi luat ve sau khong vo tinh ro sieu du lieu cua to dang khoa.
      return {
        position: r.position, publishedAt: r.publishedAt, content: teaserDoc(teaser), locked: true, sealId: s.id, teaser,
        roundId: r.roundId, editedAt: null,
      };
    });
    const rounds = luot.map((r): ReaderRound => ({
      id: r.id, ordinal: r.ordinal, first: r.first, last: r.last, sealed: closedToPartner(niemCua.get(r.id), now),
    }));
    return { book, mine, sheets, seals, rounds, replies, mark: marks[0]?.position ?? 0 };
  });
}

/**
 * Day moc da doc cua viewer len toi position, khong bao gio lui va khong vuot to cuoi.
 * Moc cung khong vuot qua to dang khoa dau tien, de to khoa van la trang moi cho toi khi mo va doc that.
 * Chu sach khong co moc; cuon khong duoc doc hoac chua co to nao thi bo qua.
 * Tinh tran va ghi trong cung mot giao dich, khoa dong sach FOR SHARE: publishDraft va editRound (FOR UPDATE) khong the
 * chen giua. editRound doi vi tri to va dat lai moc doc, nen tran tinh tren mot anh chup cu roi ghi sau co the vuot to
 * cuoi hay vuot qua to dang khoa sau khi to bi doi.
 */
export async function markRead(
  db: AnyDb, viewerId: string, bookId: string, position: number, now: Date = new Date(),
): Promise<void> {
  if (!Number.isInteger(position) || position < 1 || !isUuid(bookId)) return;
  await db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id, ownerId: books.ownerId })
      .from(books)
      .where(and(eq(books.id, bookId), readableBy(viewerId)))
      .for("share");
    if (!book || book.ownerId === viewerId) return;
    const [[{ last }], sealRows] = await Promise.all([
      tx.select({ last: max(pages.position) }).from(pages).where(eq(pages.bookId, book.id)),
      sealsOfBook(tx, book.id),
    ]);
    if (last === null) return;
    const firstLocked = sealRows
      .filter((s) => isLockedFor(s, false, now))
      .reduce((min, s) => Math.min(min, s.firstPosition), Number.POSITIVE_INFINITY);
    const cap = Math.min(last, firstLocked - 1);
    if (cap < 1) return;
    await tx
      .insert(readMarks)
      .values({ accountId: viewerId, bookId: book.id, position: Math.min(position, cap) })
      .onConflictDoUpdate({
        target: [readMarks.accountId, readMarks.bookId],
        set: { position: sql`greatest(${readMarks.position}, excluded.position)` },
      });
  });
}
