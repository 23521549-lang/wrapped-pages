import { and, count, desc, eq, inArray, max, or } from "drizzle-orm";
import { accounts, books, pages, readMarks } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { BookMode, CoverKey } from "@/lib/book";
import { docExcerpt } from "@/lib/doc/text";
import { groupBy, isLockedFor, sealsOfBooks } from "@/server/seal/seals";

export type ShelfBook = {
  id: string;
  title: string;
  mode: BookMode;
  cover: CoverKey;
  /** Bia tu tai len, null la tranh ve cover. Chi co tren cuon nguoi xem doc duoc, nen /m cho ho tai bia do. */
  coverMediaId: string | null;
  mine: boolean;
  ownerNickname: string;
  pageCount: number;
  newCount: number;
  /** So to nam trong niem phong con khoa voi nguoi xem. */
  lockedCount: number;
  lastPosition: number;
  lastPublishedAt: Date | null;
  excerpt: string | null;
  createdAt: Date;
};

/**
 * Ke sach cua viewer: moi cuon cua minh (ca rieng tu) va cac cuon chia se cua nguoi kia.
 * Cuon rieng tu cua nguoi kia khong bao gio xuat hien, ke ca ten.
 * Sap theo to dang gan nhat, cuon chua co to nao xep sau theo ngay tao.
 * Moi cau lenh doc chung mot anh chup: to cuoi, doan trich cua no va niem phong phu no luon den tu cung mot
 * trang thai, nen mot publishDraft commit giua chung khong the dua chu that cua to khoa vao doan trich.
 */
export async function listShelf(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<ShelfBook[]> {
  return readSnapshot(db, async (tx) => {
    const visible = await tx
      .select({
        id: books.id, title: books.title, mode: books.mode, cover: books.cover, coverMediaId: books.coverMediaId,
        ownerId: books.ownerId, createdAt: books.createdAt, ownerNickname: accounts.nickname,
      })
      .from(books)
      .innerJoin(accounts, eq(accounts.id, books.ownerId))
      .where(or(eq(books.ownerId, viewerId), eq(books.mode, "chia-se")));
    if (visible.length === 0) return [];

    const ids = visible.map((b) => b.id);
    const [stats, marks, latest, ranges] = await Promise.all([
      tx
        .select({ bookId: pages.bookId, n: count(), last: max(pages.position), at: max(pages.publishedAt) })
        .from(pages)
        .where(inArray(pages.bookId, ids))
        .groupBy(pages.bookId),
      tx
        .select({ bookId: readMarks.bookId, position: readMarks.position })
        .from(readMarks)
        .where(and(eq(readMarks.accountId, viewerId), inArray(readMarks.bookId, ids))),
      tx
        .selectDistinctOn([pages.bookId], { bookId: pages.bookId, content: pages.content })
        .from(pages)
        .where(inArray(pages.bookId, ids))
        .orderBy(pages.bookId, desc(pages.position)),
      sealsOfBooks(tx, ids),
    ]);

    const statOf = new Map(stats.map((s) => [s.bookId, s]));
    const markOf = new Map(marks.map((m) => [m.bookId, m.position]));
    const latestOf = new Map(latest.map((l) => [l.bookId, l.content]));
    const rangesOf = groupBy(ranges, (r) => r.bookId);

    return visible
      .map((b): ShelfBook => {
        const s = statOf.get(b.id);
        const last = s?.last ?? 0;
        const mine = b.ownerId === viewerId;
        const content = latestOf.get(b.id);
        const locked = (rangesOf.get(b.id) ?? []).filter((r) => isLockedFor(r, mine, now));
        const lastLocked = locked.find((r) => r.firstPosition <= last && last <= r.lastPosition);
        return {
          id: b.id, title: b.title, mode: b.mode, cover: b.cover, coverMediaId: b.coverMediaId, mine, ownerNickname: b.ownerNickname,
          pageCount: s?.n ?? 0,
          // Vi tri to lien nhau tu 1 (publishDraft noi tiep), nen so to moi = to cuoi - moc da doc.
          // To niem phong van tinh la to moi: markRead khong cho moc vuot qua to dang khoa.
          newCount: mine ? 0 : Math.max(0, last - (markOf.get(b.id) ?? 0)),
          lockedCount: locked.reduce((n, r) => n + r.lastPosition - r.firstPosition + 1, 0),
          lastPosition: last,
          lastPublishedAt: s?.at ?? null,
          excerpt: lastLocked ? lastLocked.teaser || null : content ? docExcerpt(content) : null,
          createdAt: b.createdAt,
        };
      })
      // oxlint-disable-next-line unicorn/no-array-sort -- mang vua duoc .map() tao moi, khong ai khac giu tham chieu nen sap xep tai cho la an toan; doi sang toSorted() can nang tsconfig lib len ES2023, ngoai pham vi task nay.
      .sort(
        (x, y) =>
          (y.lastPublishedAt?.getTime() ?? 0) - (x.lastPublishedAt?.getTime() ?? 0) ||
          y.createdAt.getTime() - x.createdAt.getTime(),
      );
  });
}
