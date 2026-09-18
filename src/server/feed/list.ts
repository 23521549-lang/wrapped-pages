import { and, count, desc, eq, lte, ne, or, sql } from "drizzle-orm";
import { activity, books, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { FeedActor, FeedItem } from "@/lib/feed/types";

/** So dong hien thi toi da cua khung Hoat dong, dem sau khi da gom cac lan thu sai. */
export const FEED_LIMIT = 50;

/**
 * Ngay lich Viet Nam cua activity.at, tinh trong SQL. Viet Nam dung UTC+7 co dinh, khong doi gio theo mua, nen
 * cong 7 gio vao gio UTC cho dung ngay nhu dayKey cua src/lib/when.ts (co test o ca hai phia nua dem) ma khong
 * can bang mui gio cua database.
 */
const NGAY_VIET_NAM = sql`((${activity.at} at time zone 'UTC') + interval '7 hours')::date`;

/**
 * Dong Hoat dong cua viewer, moi nhat truoc, doc tren mot anh chup:
 * - su kien gan sach: chu sach luon thay; nguoi kia chi thay khi cuon chia se ngay luc ghi va bay gio van chia
 *   se, tru thu-sai chi chu sach thay;
 * - doi-mat-khau: nguoi doi va nguoi bi doi deu thay;
 * - at lon hon now thi chua hien: mo-hen-gio duoc ghi san voi at = opensAt.
 * Cac lan thu sai cung nguoi, cung niem phong, cung khoang to, cung ngay gio Viet Nam gom thanh mot dong ngay trong
 * SQL, roi moi tron voi cac loai khac va cat FEED_LIMIT dong: mot buoi doan sai khong day mat dong nao khac. Dong gom
 * mang gio cua lan moi nhat va id cua lan dau tien, nen id khong doi khi co them lan thu. Ten sach, kieu niem phong
 * va loi nhan join luc doc. Ket qua khong mang id tai khoan nao.
 */
export async function listActivity(db: AnyDb, viewerId: string, now: Date): Promise<FeedItem[]> {
  return readSnapshot(db, async (tx) => {
    const thay = and(
      lte(activity.at, now),
      or(
        eq(books.ownerId, viewerId),
        and(ne(activity.kind, "thu-sai"), eq(activity.shared, true), eq(books.mode, "chia-se")),
        and(eq(activity.kind, "doi-mat-khau"), or(eq(activity.actorId, viewerId), eq(activity.subjectId, viewerId))),
      ),
    );
    const by = (actorId: string): FeedActor => (actorId === viewerId ? "me" : "partner");

    const khac = await tx
      .select({
        id: activity.id, kind: activity.kind, actorId: activity.actorId, at: activity.at,
        bookId: activity.bookId, bookTitle: books.title,
        firstPosition: activity.firstPosition, lastPosition: activity.lastPosition,
        sealKind: seals.kind, giftNote: seals.giftNote,
      })
      .from(activity)
      .leftJoin(books, eq(books.id, activity.bookId))
      .leftJoin(seals, and(eq(seals.id, activity.sealId), eq(seals.bookId, activity.bookId)))
      .where(and(thay, ne(activity.kind, "thu-sai")))
      .orderBy(desc(activity.at), desc(activity.id))
      .limit(FEED_LIMIT);

    const lanDau = sql<string>`(array_agg(${activity.id} order by ${activity.at}, ${activity.id}))[1]`;
    const lanCuoi = sql<Date>`max(${activity.at})`.mapWith(activity.at);
    const sai = await tx
      .select({
        id: lanDau, actorId: activity.actorId, at: lanCuoi, count: count(),
        bookId: activity.bookId, bookTitle: books.title,
        firstPosition: activity.firstPosition, lastPosition: activity.lastPosition, sealKind: seals.kind,
      })
      .from(activity)
      .leftJoin(books, eq(books.id, activity.bookId))
      .leftJoin(seals, and(eq(seals.id, activity.sealId), eq(seals.bookId, activity.bookId)))
      .where(and(thay, eq(activity.kind, "thu-sai")))
      .groupBy(
        activity.actorId, activity.sealId, activity.bookId, activity.firstPosition, activity.lastPosition, NGAY_VIET_NAM,
        books.title, seals.kind,
      )
      .orderBy(desc(lanCuoi), desc(lanDau))
      .limit(FEED_LIMIT);

    const items: FeedItem[] = [
      ...khac.map((r): FeedItem => ({
        id: r.id, kind: r.kind, by: by(r.actorId), at: r.at,
        bookId: r.bookId, bookTitle: r.bookTitle, firstPosition: r.firstPosition, lastPosition: r.lastPosition,
        sealKind: r.sealKind, note: r.kind === "tang-khoa" ? r.giftNote : null, count: 1,
      })),
      ...sai.map((r): FeedItem => ({
        id: r.id, kind: "thu-sai", by: by(r.actorId), at: r.at,
        bookId: r.bookId, bookTitle: r.bookTitle, firstPosition: r.firstPosition, lastPosition: r.lastPosition,
        sealKind: r.sealKind, note: null, count: r.count,
      })),
    ];
    // Sap xep on dinh: cung gio thi dong khac thu-sai dung truoc, dung thu tu cua tung truy van.
    // oxlint-disable-next-line unicorn/no-array-sort -- items vua tao o tren, khong ai khac giu tham chieu; toSorted() can nang tsconfig lib len ES2023 (nhu shelf.ts).
    return items.sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, FEED_LIMIT);
  });
}
