import { and, count, desc, eq, inArray, isNotNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { activity, activitySeen, bookCovers, books, bookTracks, moods, pages, rounds, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { FeedActor, FeedItem } from "@/lib/feed/types";
import { khoangLuot } from "@/server/library/rounds";

/** So dong hien thi toi da cua khung Hoat dong, dem sau khi da gom cac lan thu sai. */
export const FEED_LIMIT = 50;

/**
 * Ngay lich Viet Nam cua activity.at, tinh trong SQL. Viet Nam dung UTC+7 co dinh, khong doi gio theo mua, nen
 * cong 7 gio vao gio UTC cho dung ngay nhu dayKey cua src/lib/when.ts (co test o ca hai phia nua dem) ma khong
 * can bang mui gio cua database.
 */
const NGAY_VIET_NAM = sql`((${activity.at} at time zone 'UTC') + interval '7 hours')::date`;

/**
 * Luat xem cua mot dong Hoat dong voi viewerId (dung chung cho listActivity, markSeen va phienBanKe; can join books
 * theo activity.book_id va moods theo activity.mood_id):
 * - su kien gan sach: chu sach luon thay (tru dong da-doc cua chinh ho, chi co o sach viet cung); nguoi kia chi thay khi
 *   cuon chia se ngay luc ghi va bay gio van chia se, tru thu-sai va da-doc chi chu sach thay;
 * - da-doc o sach viet cung (5c): nguoi viet kia thay dong doc cua nguoi nay (chia se luc ghi), khong ai thay dong doc
 *   cua chinh minh;
 * - doi-mat-khau: nguoi doi va nguoi bi doi deu thay;
 * - tha-tam-trang: ca hai deu thay, tru tam trang da thu lai;
 * - gui-thu: ca hai deu thay (dong chi mang thang, noi dung thu khong bao gio nam o day);
 * - tha-cam-xuc (5d): ca hai deu thay;
 * - at lon hon now thi chua hien: mo-hen-gio duoc ghi san voi at = opensAt.
 */
export function thayDuoc(viewerId: string, now: Date) {
  return and(
    lte(activity.at, now),
    or(
      and(eq(books.ownerId, viewerId), or(ne(activity.kind, "da-doc"), ne(activity.actorId, viewerId))),
      and(notInArray(activity.kind, ["thu-sai", "da-doc"]), eq(activity.shared, true), eq(books.mode, "chia-se")),
      and(eq(activity.kind, "da-doc"), eq(activity.shared, true), isNotNull(books.vietCungTu), ne(activity.actorId, viewerId)),
      and(eq(activity.kind, "doi-mat-khau"), or(eq(activity.actorId, viewerId), eq(activity.subjectId, viewerId))),
      and(eq(activity.kind, "tha-tam-trang"), eq(moods.withdrawn, false)),
      eq(activity.kind, "gui-thu"),
      eq(activity.kind, "tha-cam-xuc"),
    ),
  );
}

/**
 * Dong Hoat dong cua viewer, moi nhat truoc, doc tren mot anh chup, theo luat thayDuoc.
 * Cac lan thu sai cung nguoi, cung niem phong, cung luot, cung ngay gio Viet Nam gom thanh mot dong ngay trong
 * SQL, roi moi tron voi cac loai khac va cat FEED_LIMIT dong: mot buoi doan sai khong day mat dong nao khac. Dong gom
 * mang gio cua lan moi nhat va id cua lan dau tien, nen id khong doi khi co them lan thu. Ten sach, kieu niem phong,
 * loi nhan va tam trang join luc doc. isNew: viec cua nguoi kia ma nguoi xem chua xem, hay dong da doi (at lon hon
 * luc xem). Ket qua khong mang id tai khoan nao.
 */
export async function listActivity(db: AnyDb, viewerId: string, now: Date): Promise<FeedItem[]> {
  return readSnapshot(db, async (tx) => {
    const thay = thayDuoc(viewerId, now);
    const by = (actorId: string): FeedActor => (actorId === viewerId ? "me" : "partner");

    // Dong Hoat dong tron nhieu cuon trong mot lan doc, nen khoang to gom nhom tren ca bang pages (khong theo cuon).
    const khoang = khoangLuot();
    const lanDau = sql<string>`(array_agg(${activity.id} order by ${activity.at}, ${activity.id}))[1]`;
    const lanCuoi = sql<Date>`max(${activity.at})`.mapWith(activity.at);
    // Lan dang mang o bia, o nhac rieng cua luot do (dong "Bìa mới", "Nhạc mới").
    const coBia = sql<boolean>`${activity.kind} = 'dang-trang' and exists (select 1 from ${bookCovers} where ${bookCovers.roundId} = ${activity.roundId})`;
    const coNhac = sql<boolean>`${activity.kind} = 'dang-trang' and exists (select 1 from ${bookTracks} where ${bookTracks.roundId} = ${activity.roundId})`;
    // So thu tu luot cua o bia, o nhac va luot vua doi ten: dem so luot co to dung truoc hay tai to dau cua luot (dung
    // cach roundsOfBook danh so theo vi tri to). O mo dau (khong luot) la null.
    const thuTu = sql<number | null>`case when ${activity.kind} in ('doi-bia', 'doi-nhac', 'doi-ten-luot') and ${activity.roundId} is not null then (select count(distinct p.round_id)::int from ${pages} p where p.book_id = ${activity.bookId} and p.position <= ${khoang.first}) end`;
    // Ten luot vua dang (sach viet cung, 5c): chi dong dang-trang can; luot khong ten thi null va cau giu nhu cu.
    const tenLuot = sql<string | null>`case when ${activity.kind} = 'dang-trang' then ${rounds.ten} end`;
    // Hai cau doc doc lap tren cung anh chup: chay song song trong giao dich, khong doi du lieu doc ra.
    const [khac, sai] = await Promise.all([
      tx
        .select({
          id: activity.id, kind: activity.kind, actorId: activity.actorId, at: activity.at,
          bookId: activity.bookId, bookTitle: books.title,
          firstPosition: khoang.first, lastPosition: khoang.last,
          sealKind: seals.kind, giftNote: seals.giftNote,
          detail: activity.detail, weather: moods.weather, moodNote: moods.note,
          biaMoi: coBia, nhacMoi: coNhac, ordinal: thuTu, tenLuot,
        })
        .from(activity)
        .leftJoin(books, eq(books.id, activity.bookId))
        .leftJoin(moods, eq(moods.id, activity.moodId))
        .leftJoin(rounds, eq(rounds.id, activity.roundId))
        .leftJoin(khoang, eq(khoang.roundId, activity.roundId))
        .leftJoin(seals, and(eq(seals.id, activity.sealId), eq(seals.bookId, activity.bookId)))
        .where(and(thay, notInArray(activity.kind, ["thu-sai"])))
        .orderBy(desc(activity.at), desc(activity.id))
        .limit(FEED_LIMIT),
      tx
        .select({
          id: lanDau, actorId: activity.actorId, at: lanCuoi, count: count(),
          bookId: activity.bookId, bookTitle: books.title,
          firstPosition: khoang.first, lastPosition: khoang.last, sealKind: seals.kind,
        })
        .from(activity)
        .leftJoin(books, eq(books.id, activity.bookId))
        .leftJoin(moods, eq(moods.id, activity.moodId))
        .leftJoin(khoang, eq(khoang.roundId, activity.roundId))
        .leftJoin(seals, and(eq(seals.id, activity.sealId), eq(seals.bookId, activity.bookId)))
        .where(and(thay, eq(activity.kind, "thu-sai")))
        .groupBy(
          activity.actorId, activity.sealId, activity.bookId, activity.roundId, khoang.first, khoang.last, NGAY_VIET_NAM,
          books.title, seals.kind,
        )
        .orderBy(desc(lanCuoi), desc(lanDau))
        .limit(FEED_LIMIT),
    ]);

    // isNew dien sau, khi da biet nhung dong nao se hien.
    const items: FeedItem[] = [
      ...khac.map((r): FeedItem => ({
        id: r.id, kind: r.kind, by: by(r.actorId), at: r.at,
        bookId: r.bookId, bookTitle: r.bookTitle, firstPosition: r.firstPosition, lastPosition: r.lastPosition,
        sealKind: r.sealKind, count: 1,
        note: r.kind === "tang-khoa" ? r.giftNote : r.kind === "tha-tam-trang" ? r.moodNote : null,
        isNew: false, detail: r.detail, weather: r.weather, biaMoi: r.biaMoi, nhacMoi: r.nhacMoi, ordinal: r.ordinal,
        tenLuot: r.tenLuot,
      })),
      ...sai.map((r): FeedItem => ({
        id: r.id, kind: "thu-sai", by: by(r.actorId), at: r.at,
        bookId: r.bookId, bookTitle: r.bookTitle, firstPosition: r.firstPosition, lastPosition: r.lastPosition,
        sealKind: r.sealKind, note: null, count: r.count,
        isNew: false, detail: null, weather: null, biaMoi: false, nhacMoi: false, ordinal: null, tenLuot: null,
      })),
    ];
    // Sap xep on dinh: cung gio thi dong khac thu-sai dung truoc, dung thu tu cua tung truy van.
    // oxlint-disable-next-line unicorn/no-array-sort -- items vua tao o tren, khong ai khac giu tham chieu; toSorted() can nang tsconfig lib len ES2023 (nhu shelf.ts).
    const hien = items.sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, FEED_LIMIT);

    // Dau Moi: chi viec cua nguoi kia; mot cau doc cac lan xem cua nguoi xem cho dung nhung dong se hien.
    const cuaNguoiKia = hien.filter((i) => i.by === "partner").map((i) => i.id);
    if (cuaNguoiKia.length === 0) return hien;
    const daXem = new Map(
      (await tx
        .select({ id: activitySeen.activityId, luc: activitySeen.seenAt })
        .from(activitySeen)
        .where(and(eq(activitySeen.accountId, viewerId), inArray(activitySeen.activityId, cuaNguoiKia))))
        .map((r) => [r.id, r.luc.getTime()]),
    );
    for (const i of hien) {
      if (i.by !== "partner") continue;
      const luc = daXem.get(i.id);
      i.isNew = luc === undefined || i.at.getTime() > luc;
    }
    return hien;
  });
}
