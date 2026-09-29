import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { activity, activitySeen, books, moods } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";
import { thayDuoc } from "./list";

/** So dong toi da moi lan bao da xem: khung Hoat dong hien toi da FEED_LIMIT (50) dong. */
export const SEEN_TOI_DA = 50;

/** Ngay lich Viet Nam cua mot cot thoi gian, cung cach NGAY_VIET_NAM cua list.ts (UTC+7 co dinh). */
const ngayVietNam = (cot: SQL) => sql`((${cot} at time zone 'UTC') + interval '7 hours')::date`;

/**
 * Ghi nhung dong Hoat dong viewerId vua xem (dau Moi tan). Chi nhan dong cua NGUOI KIA ma viewerId duoc thay theo dung
 * luat thayDuoc cua listActivity; id sai dang bi bo, lap chi tinh mot, toi da SEEN_TOI_DA id. seen_at la at cua dong,
 * rieng dong gom thu sai (id cua lan dau) la gio lan thu moi nhat cua nhom da hien, dung gio listActivity cho dong do.
 * Khong bao gio lui moc da xem: greatest(cu, moi), nen hai the gui lech thu tu van dung.
 */
export async function markSeen(db: AnyDb, viewerId: string, ids: readonly string[], now: Date = new Date()): Promise<void> {
  const can = [...new Set(ids.filter(isUuid))].slice(0, SEEN_TOI_DA);
  if (can.length === 0) return;
  // Nhom cua dong gom thu sai: cung nguoi, niem phong, luot, ngay Viet Nam (dung khoa gom cua listActivity).
  const nhomThuSai = sql`(
    select max(g.at) from ${activity} g
    where g.kind = 'thu-sai' and g.actor_id = ${activity.actorId} and g.seal_id = ${activity.sealId}
      and g.book_id = ${activity.bookId} and g.round_id = ${activity.roundId} and g.at <= ${now.toISOString()}::timestamptz
      and ${ngayVietNam(sql`g.at`)} = ${ngayVietNam(sql`${activity.at}`)}
  )`;
  await db
    .insert(activitySeen)
    .select(
      db
        .select({
          accountId: sql<string>`${viewerId}::uuid`.as("account_id"),
          activityId: activity.id,
          seenAt: sql<Date>`case when ${activity.kind} = 'thu-sai' then ${nhomThuSai} else ${activity.at} end`.as("seen_at"),
        })
        .from(activity)
        .leftJoin(books, eq(books.id, activity.bookId))
        .leftJoin(moods, eq(moods.id, activity.moodId))
        .where(and(inArray(activity.id, can), ne(activity.actorId, viewerId), thayDuoc(viewerId, now))),
    )
    .onConflictDoUpdate({
      target: [activitySeen.accountId, activitySeen.activityId],
      set: { seenAt: sql`greatest(${activitySeen.seenAt}, excluded.seen_at)` },
    });
}
