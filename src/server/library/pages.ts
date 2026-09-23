import { and, asc, eq, max } from "drizzle-orm";
import { books, pages, readSheets } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { DocJson } from "@/lib/doc/types";
import { MAX_SHOWN_SHEETS } from "@/lib/flip";
import type { ReaderReply } from "@/lib/round-reply";
import type { ReaderRound, ReaderSeal, ReaderSheet } from "@/lib/seal/types";
import { isUuid } from "@/lib/uuid";
import { closedToPartner, isLockedFor, readerSeals, sealAt, sealsOfBook } from "@/server/seal/seals";
import { findReadableBook, readableBy, type Book } from "./books";
import { repliesOfBook } from "./round-replies";
import { roundsOfBook } from "./rounds";

export type ReaderView = {
  book: Book; mine: boolean; sheets: ReaderSheet[]; seals: ReaderSeal[]; rounds: ReaderRound[]; replies: ReaderReply[];
  /** Vi tri cac to nguoi xem da tung thay, tang dan. Chu sach khong co dong nao. */
  seen: number[];
  /**
   * To nho nhat nguoi xem chua thay, tinh tu 1; 0 khi da thay het hoac cuon chua co to nao. Chu sach khong co dong da
   * xem nao nen voi ho luon la to 1: man doc cua chinh minh khong dung so nay (startSheet chi doc no khi mine sai).
   */
  firstUnread: number;
};

/** Tai lieu dung thay cho to khoa: chi dong he lo, hoac mot doan trong. Khong bao gio chua noi dung that. */
function teaserDoc(teaser: string | null): DocJson {
  return {
    type: "doc",
    content: [teaser ? { type: "paragraph", content: [{ type: "text", text: teaser }] } : { type: "paragraph" }],
  };
}

/**
 * Moi to cua mot cuon theo thu tu, neu viewer duoc doc cuon do, kem cac luot dang. seen la cac to viewer da tung thay
 * va firstUnread la to nho nhat chua thay. To nam trong niem phong con khoa voi viewer duoc thay content bang teaserDoc:
 * noi dung that duoc doc len may chu nhung khong bao gio duoc dat vao doi tuong tra ve. Moi cau lenh doc chung mot anh
 * chup, nen mot publishDraft hay editRound commit giua chung khong the de lo to vua dang ma thieu niem phong cua no.
 * replies: loi hoi dap cua cac luot, chi voi sach dang chia se (sach rieng tu khong co khung hoi dap, nen khong doc bang
 * round_replies).
 */
export async function readBook(db: AnyDb, viewerId: string, bookId: string, now: Date = new Date()): Promise<ReaderView | null> {
  return readSnapshot(db, async (tx) => {
    const book = await findReadableBook(tx, viewerId, bookId);
    if (!book) return null;
    const mine = book.ownerId === viewerId;
    const [rows, daXem, sealRows, luot, replies] = await Promise.all([
      tx
        .select({ position: pages.position, content: pages.content, publishedAt: pages.publishedAt, roundId: pages.roundId })
        .from(pages)
        .where(eq(pages.bookId, book.id))
        .orderBy(asc(pages.position)),
      tx
        .select({ position: readSheets.position })
        .from(readSheets)
        .where(and(eq(readSheets.accountId, viewerId), eq(readSheets.bookId, book.id)))
        .orderBy(asc(readSheets.position)),
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
    const seen = daXem.map((r) => r.position);
    const coRoi = new Set(seen);
    // To nho nhat chua thay: man doc mo o day khi duong dan khong kem ?trang (src/lib/reading.ts). Chu sach khong co
    // dong da xem nao nen ra to 1, va startSheet bo qua so nay voi cuon cua chinh minh.
    const firstUnread = rows.find((r) => !coRoi.has(r.position))?.position ?? 0;
    return { book, mine, sheets, seals, rounds, replies, seen, firstUnread };
  });
}

/**
 * Ghi lai cac to nguoi xem VUA THAY: khoang [from, to] cua khung sach dang dung yen. Chi to that su hien moi duoc ghi,
 * nen mo man doc thang toi mot to xa khong bien cac to bi nhay coc thanh da doc.
 * Khoang rong hon MAX_SHOWN_SHEETS bi tu choi: day la diem cuoi cong khai, khong duoc dung de danh dau ca cuon la da
 * doc. To vuot to cuoi bi bo; to nam trong luot con niem phong voi nguoi xem khong bao gio duoc ghi, nen no van la
 * trang moi cho toi khi mo ra va lat that.
 * Chu sach khong co dong nao; cuon khong duoc doc hoac chua co to nao thi bo qua.
 * Doc va ghi trong cung mot giao dich, khoa dong sach FOR SHARE: publishDraft va editRound (FOR UPDATE) khong the chen
 * giua, nen khong ghi duoc mot vi tri vua bi doi cho hay vua bi khoa.
 */
export async function markRead(
  db: AnyDb, viewerId: string, bookId: string, from: number, to: number, now: Date = new Date(),
): Promise<void> {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return;
  if (to - from + 1 > MAX_SHOWN_SHEETS || !isUuid(bookId)) return;
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
    const khoa = sealRows.filter((s) => isLockedFor(s, false, now));
    const rows = [];
    for (let p = from; p <= Math.min(to, last); p++) {
      if (sealAt(khoa, p) === undefined) rows.push({ accountId: viewerId, bookId: book.id, position: p });
    }
    // Moi duong tra ve deu nam truoc lenh ghi duy nhat o duoi, va truoc do chi co lenh doc.
    if (rows.length === 0) return;
    await tx.insert(readSheets).values(rows).onConflictDoNothing();
  });
}
