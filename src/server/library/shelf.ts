import { and, count, eq, inArray, lte, max, notExists, or, sql } from "drizzle-orm";
import { accounts, books, pages, readMarks, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { BookMode, CoverKey } from "@/lib/book";
import { docExcerpt, NOT_BLANK_PATTERN } from "@/lib/doc/text";
import { dayKey } from "@/lib/when";
import { groupBy, isLockedFor, lockedForSql, sealsOfBooks } from "@/server/seal/seals";

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
  /**
   * To ke sach mo man doc: to co chu duoc chon cho hom nay (xem pickedSheets), khong co thi to doc duoc dau tien co chu;
   * cuon khong co to doc duoc nao co chu thi la to doc duoc dau tien, va moi to deu khoa thi la to cuoi. 0 khi chua co to.
   */
  excerptPosition: number;
  /** Khong co to doc duoc nao co chu va to cuoi dang nam trong niem phong con khoa voi nguoi xem: excerpt chi la dong he lo. */
  excerptLocked: boolean;
  lastPublishedAt: Date | null;
  /**
   * Chu cua to excerptPosition khi to do co chu; khi excerptLocked thi chi la dong he lo (hoac null), khong bao gio la chu
   * that; khong co to doc duoc nao co chu thi null (nhan media khong phai doan van).
   */
  excerpt: string | null;
  createdAt: Date;
};

/** To co it nhat mot nut chu chua ky tu khong phai khoang trang (cung tap khoang trang voi docExcerpt). */
const HAS_TEXT = sql`exists (select 1 from jsonb_path_query(${pages.content}, '$.** ? (@.type == "text").text') as chu(v) where (chu.v #>> '{}') ~ ${NOT_BLANK_PATTERN})`;

/**
 * Niem phong phu to dang xet (pages) va con khoa voi nguoi xem; dung trong truy van co join books. Niem phong cua mot
 * to dung la niem phong cua luot chua to, nen so luot la du, khong can khoang to.
 */
function lockedSealOf(tx: AnyDb, viewerId: string, now: Date) {
  return tx
    .select({ id: seals.id })
    .from(seals)
    .where(and(eq(seals.roundId, pages.roundId), lockedForSql(sql`${books.ownerId} = ${viewerId}`, now)));
}

/**
 * To cua doan trich hom nay, moi cuon mot dong. Ung vien la cac to co chu, khong nam trong niem phong con khoa voi nguoi
 * xem, va voi cuon cua nguoi kia thi nguoi xem da doc toi (position <= dau doc, khong co dau doc la 0): ke sach khong lo
 * to chua doc, va bam khung khong day dau doc vuot cac to chua doc (markRead chi tang). To duoc chon la ung vien thu k
 * theo vi tri, k = md5("cuon:nguoi xem:ngay Viet Nam") lay 32 bit dau, du theo so ung vien. Chay tron trong SQL, khong
 * tai moi to ve may chu ung dung. Cung ngay thi cung to, sang ngay thi doi; moi nguoi xem mot chuoi rieng. Cuon khong
 * co ung vien nao thi khong co dong (xem firstReadableSheets).
 */
function pickedSheets(tx: AnyDb, ids: string[], viewerId: string, now: Date) {
  const candidates = tx
    .select({
      bookId: pages.bookId,
      position: pages.position,
      content: pages.content,
      k: sql<number>`row_number() over (partition by ${pages.bookId} order by ${pages.position}) - 1`.as("k"),
      n: sql<number>`count(*) over (partition by ${pages.bookId})`.as("n"),
    })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .leftJoin(readMarks, and(eq(readMarks.bookId, pages.bookId), eq(readMarks.accountId, viewerId)))
    .where(and(
      inArray(pages.bookId, ids),
      HAS_TEXT,
      notExists(lockedSealOf(tx, viewerId, now)),
      or(eq(books.ownerId, viewerId), lte(pages.position, sql`coalesce(${readMarks.position}, 0)`)),
    ))
    .as("ung_vien");
  const seed = sql`${candidates.bookId}::text || ':' || ${viewerId}::text || ':' || ${dayKey(now)}::text`;
  return tx
    .select({ bookId: candidates.bookId, position: candidates.position, content: candidates.content })
    .from(candidates)
    .where(sql`${candidates.k} = mod(('x' || substr(md5(${seed}), 1, 8))::bit(32)::bigint, ${candidates.n})`);
}

/**
 * To doc duoc dau tien cua moi cuon (vi tri nho nhat khong nam trong niem phong con khoa voi nguoi xem): du phong khi
 * pickedSheets khong co ung vien. Moi to deu khoa thi khong co dong.
 * - Cuon cua chinh nguoi xem: khong bi dau doc gioi han, uu tien to co chu roi moi toi vi tri (nhu truoc).
 * - Cuon cua nguoi kia: KHONG BAO GIO duoc chon mot to o xa hon dau doc + 1 chi vi to do co chu. Trong cac to doc duoc
 *   MA NGUOI XEM CHUA DOC (vi tri > dau doc), lay to nho nhat - ke ca khi to do khong co chu; khong duoc bo qua no de
 *   tim to co chu o xa hon, vi Reader bao moi to da hien qua onReach va markRead chi tang (greatest), nen mo tai to xa
 *   hon se am tham danh dau to chua doc (thuong la to chi co anh) la da doc. Chi khi khong con to doc duoc nao chua doc
 *   (vd phan con lai da bi niem phong) moi lui ve to doc duoc nho nhat trong cac to DA doc (cung theo vi tri nho nhat,
 *   khong phan biet co chu). listShelf chi dung noi dung to nay lam doan trich khi hasText dung; to khong chu thi
 *   khong co doan trich (giu nguyen luat dong he lo niem phong khi ap dung).
 */
function firstReadableSheets(tx: AnyDb, ids: string[], viewerId: string, now: Date) {
  return tx
    .selectDistinctOn([pages.bookId], {
      bookId: pages.bookId, position: pages.position, content: pages.content, hasText: sql<boolean>`${HAS_TEXT}`,
    })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .leftJoin(readMarks, and(eq(readMarks.bookId, pages.bookId), eq(readMarks.accountId, viewerId)))
    .where(and(inArray(pages.bookId, ids), notExists(lockedSealOf(tx, viewerId, now))))
    .orderBy(
      pages.bookId,
      sql`case
        when ${books.ownerId} = ${viewerId} then (case when not ${HAS_TEXT} then 1 else 0 end)
        else (case when ${pages.position} <= coalesce(${readMarks.position}, 0) then 1 else 0 end)
      end`,
      pages.position,
    );
}

/**
 * Ke sach cua viewer: moi cuon cua minh (ca rieng tu) va cac cuon chia se cua nguoi kia.
 * Cuon rieng tu cua nguoi kia khong bao gio xuat hien, ke ca ten.
 * Sap theo to dang gan nhat, cuon chua co to nao xep sau theo ngay tao.
 * Moi cau lenh doc chung mot anh chup: to duoc chon, to cuoi, doan trich va niem phong phu chung luon den tu cung mot
 * trang thai, nen mot publishDraft hay mot lan mo khoa commit giua chung khong the dua chu that cua to khoa vao doan trich.
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
    const [stats, marks, ranges, picked, firsts] = await Promise.all([
      tx
        .select({ bookId: pages.bookId, n: count(), last: max(pages.position), at: max(pages.publishedAt) })
        .from(pages)
        .where(inArray(pages.bookId, ids))
        .groupBy(pages.bookId),
      tx
        .select({ bookId: readMarks.bookId, position: readMarks.position })
        .from(readMarks)
        .where(and(eq(readMarks.accountId, viewerId), inArray(readMarks.bookId, ids))),
      sealsOfBooks(tx, ids),
      pickedSheets(tx, ids, viewerId, now),
      firstReadableSheets(tx, ids, viewerId, now),
    ]);

    const statOf = new Map(stats.map((s) => [s.bookId, s]));
    const markOf = new Map(marks.map((m) => [m.bookId, m.position]));
    const rangesOf = groupBy(ranges, (r) => r.bookId);
    const pickedOf = new Map(picked.map((p) => [p.bookId, p]));
    const firstOf = new Map(firsts.map((p) => [p.bookId, p]));

    return visible
      .map((b): ShelfBook => {
        const s = statOf.get(b.id);
        const last = s?.last ?? 0;
        const mine = b.ownerId === viewerId;
        const locked = (rangesOf.get(b.id) ?? []).filter((r) => isLockedFor(r, mine, now));
        // To chon hom nay; khong co thi to doc duoc dau tien co chu. Khong to doc duoc nao co chu thi giu cach cu: dong
        // he lo cua niem phong phu to cuoi neu con khoa, khong thi khong co doan trich; man doc van mo o to doc duoc dau
        // tien (moi to deu khoa thi to cuoi) de bam khung khong day dau doc vuot to chua doc.
        const first = firstOf.get(b.id);
        const sheet = pickedOf.get(b.id) ?? (first?.hasText ? first : undefined);
        const lastSeal = sheet ? undefined : locked.find((r) => r.firstPosition <= last && last <= r.lastPosition);
        return {
          id: b.id, title: b.title, mode: b.mode, cover: b.cover, coverMediaId: b.coverMediaId, mine, ownerNickname: b.ownerNickname,
          pageCount: s?.n ?? 0,
          // Vi tri to lien nhau tu 1 (publishDraft noi tiep), nen so to moi = to cuoi - moc da doc.
          // To niem phong van tinh la to moi: markRead khong cho moc vuot qua to dang khoa.
          newCount: mine ? 0 : Math.max(0, last - (markOf.get(b.id) ?? 0)),
          lockedCount: locked.reduce((n, r) => n + r.lastPosition - r.firstPosition + 1, 0),
          excerptPosition: sheet?.position ?? first?.position ?? last,
          excerptLocked: lastSeal !== undefined,
          lastPublishedAt: s?.at ?? null,
          excerpt: sheet ? docExcerpt(sheet.content) : lastSeal?.teaser || null,
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
