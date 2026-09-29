import { and, count, eq, gt, max } from "drizzle-orm";
import { activity, books, moods, readSheets } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { thayDuoc } from "./list";

/**
 * Phien ban cua trang Ke sach voi viewerId (spec 5a muc G1): mot chuoi re de TuCapNhat so voi phien ban luc trang ve.
 * Doi khi co gi nguoi xem thay duoc vua doi: so dong va gio moi nhat cua cac dong Hoat dong nguoi xem thay (theo dung
 * thayDuoc: dong moi, dong vua gop, dong ghi san vua toi gio, tam trang thu lai lam dong cua no an), so to nguoi xem da
 * doc (doc them o the khac thi so trang moi tren ke doi), va cac tam trang dang giu (tha, thu lai, het han). Khong doi
 * khi nguoi xem chi xem: activity_seen khong nam trong chuoi. Khong mang id tai khoan, khong mang noi dung nao.
 */
export async function phienBanKe(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<string> {
  return readSnapshot(db, async (tx) => {
    const [[hd], [doc], giu] = await Promise.all([
      tx
        .select({ n: count(), moi: max(activity.at) })
        .from(activity)
        .leftJoin(books, eq(books.id, activity.bookId))
        .leftJoin(moods, eq(moods.id, activity.moodId))
        .where(thayDuoc(viewerId, now)),
      tx.select({ n: count() }).from(readSheets).where(eq(readSheets.accountId, viewerId)),
      tx
        .select({ id: moods.id })
        .from(moods)
        .where(and(gt(moods.endsAt, now), eq(moods.withdrawn, false)))
        .orderBy(moods.id),
    ]);
    return [hd.n, hd.moi?.getTime() ?? 0, doc.n, giu.map((m) => m.id).join(",")].join("|");
  });
}
