import { and, asc, eq, inArray, lt, lte, notExists, sql, type SQLWrapper } from "drizzle-orm";
import { books, drafts, media, mediaObjects, mediaSweeps, pages } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { MediaStore } from "./store";

/** Media khong con tai lieu nao tham chieu duoc giu them chung nay: hoan tac trong man viet van con anh. */
export const MEDIA_ORPHAN_MS = 24 * 60 * 60_000;
/** Hai lan don rac cach nhau it nhat chung nay, chung cho moi tien trinh may chu. */
export const MEDIA_SWEEP_INTERVAL_MS = 60 * 60_000;
/** Moi lan don xoa toi da chung nay object; phan con lai de lan sau. */
export const MEDIA_SWEEP_BATCH = 100;

/** Dong duy nhat cua media_sweeps. */
const SWEEP_ROW = 1;

export type SweepResult = { media: number; objects: number };

/**
 * Giu moc don rac: ghi now vao dong duy nhat khi chua co, hoac khi lan truoc da qua MEDIA_SWEEP_INTERVAL_MS. Mot cau lenh
 * nguyen tu, nen hai tien trinh goi cung luc chi mot tien trinh duoc don.
 */
async function claimSweep(db: AnyDb, now: Date): Promise<boolean> {
  const rows = await db
    .insert(mediaSweeps)
    .values({ id: SWEEP_ROW, ranAt: now })
    .onConflictDoUpdate({
      target: mediaSweeps.id,
      set: { ranAt: now },
      setWhere: lte(mediaSweeps.ranAt, new Date(now.getTime() - MEDIA_SWEEP_INTERVAL_MS)),
    })
    .returning({ id: mediaSweeps.id });
  return rows.length === 1;
}

/** Noi dung tai lieu co mot khoi cap cao nhat mang id cua dong media dang xet (cung jsonpath voi bindMedia). */
function mentionsMedia(content: SQLWrapper) {
  return sql`jsonb_path_exists(${content}, '$.content[*] ? (@.attrs.id == $id)', jsonb_build_object('id', ${media.id}))`;
}

/**
 * Don rac media. Chan tan suat bang moc trong database: null khi lan don truoc chua qua MEDIA_SWEEP_INTERVAL_MS.
 * 1. Xoa dong media tao truoc now - MEDIA_ORPHAN_MS ma khong bia sach, nhap hay to da dang nao cua cuon tham chieu. Bia
 *    cho gan qua han (chua co sach) nam trong so nay.
 * 2. Xoa khoi kho toi da MEDIA_SWEEP_BATCH object ghi trong so cai media_objects qua han ma khong con dong media: object
 *    vua mat dong o buoc 1, object cua sach da xoa (dong media mat theo cascade), object put xong ma ghi dong hong. Xoa
 *    object truoc, xoa so cai sau, nen hong giua chung thi lan sau xoa lai (remove bo qua key khong con).
 * Chi dung db va store truyen vao; action goi qua after() nen khong keo dai phan hoi.
 */
export async function sweepMedia(db: AnyDb, store: MediaStore, now: Date): Promise<SweepResult | null> {
  if (!(await claimSweep(db, now))) return null;
  const cutoff = new Date(now.getTime() - MEDIA_ORPHAN_MS);
  const removed = await db
    .delete(media)
    .where(and(
      lt(media.createdAt, cutoff),
      notExists(db.select({ id: books.id }).from(books).where(eq(books.coverMediaId, media.id))),
      notExists(db.select({ bookId: drafts.bookId }).from(drafts).where(and(eq(drafts.bookId, media.bookId), mentionsMedia(drafts.content)))),
      notExists(db.select({ position: pages.position }).from(pages).where(and(eq(pages.bookId, media.bookId), mentionsMedia(pages.content)))),
    ))
    .returning({ id: media.id });
  const orphans = await db
    .select({ storeKey: mediaObjects.storeKey })
    .from(mediaObjects)
    .where(and(
      lt(mediaObjects.createdAt, cutoff),
      notExists(db.select({ id: media.id }).from(media).where(eq(media.storeKey, mediaObjects.storeKey))),
    ))
    .orderBy(asc(mediaObjects.createdAt))
    .limit(MEDIA_SWEEP_BATCH);
  const keys = orphans.map((row) => row.storeKey);
  if (keys.length > 0) {
    await store.remove(keys);
    await db.delete(mediaObjects).where(inArray(mediaObjects.storeKey, keys));
  }
  return { media: removed.length, objects: keys.length };
}
