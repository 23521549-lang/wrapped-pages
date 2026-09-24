import { and, asc, eq, exists, inArray, lt, lte, notExists, sql, type SQLWrapper } from "drizzle-orm";
import { bookCovers, drafts, media, mediaObjects, mediaSweeps, pages } from "@/server/db/schema";
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

/**
 * Bia da thuoc mot cuon la TAI SAN cua cuon do, khong bao gio bi don: kho anh bia cua mot cuon lon dan mai va phan lon
 * anh trong kho khong nam trong o nao cua dong thoi gian, nen "khong ai tham chieu" khong con nghia la rac. Luat doc
 * kind va book_id cua chinh dong media, KHONG hoi "co o nao dang chon anh nay khong": anh bi bo khoi moi o van phai o
 * lai kho de chon lai. Bia CHO GAN (book_id null, tai o trang Sach moi roi bo do) van bi don sau MEDIA_ORPHAN_MS nhu cu.
 */
const BIA_CUA_SACH = sql`${media.kind} = 'bia' and ${media.bookId} is not null`;

/**
 * Anh dang nam trong mot o cua dong thoi gian bia. Luat NAY la mot ve THEM vao BIA_CUA_SACH, khong phai thay the no:
 * bo ve kia di thi anh bi bo khoi moi o se bi don, trai voi phan quyet B7 (dot nay khong co duong xoa anh trong kho).
 * Can ve nay vi migration 0014 chep book_covers tu books va CO THE de lai o bia tro toi mot dong media con book_id null
 * (bia cho gan chua kip gan): dong do khong khop BIA_CUA_SACH, va khoa ngoai cover_media_id la set null, nen don rac se
 * lam o bia mat anh vinh vien ma khong bao gi.
 */
function trongOBia(db: AnyDb) {
  return exists(db.select({ id: bookCovers.id }).from(bookCovers).where(eq(bookCovers.coverMediaId, media.id)));
}

/** Noi dung tai lieu co mot khoi cap cao nhat mang id cua dong media dang xet (cung jsonpath voi bindMedia). */
function mentionsMedia(content: SQLWrapper) {
  return sql`jsonb_path_exists(${content}, '$.content[*] ? (@.attrs.id == $id)', jsonb_build_object('id', ${media.id}))`;
}

/**
 * Don rac media. Chan tan suat bang moc trong database: null khi lan don truoc chua qua MEDIA_SWEEP_INTERVAL_MS.
 * 1. Xoa dong media tao truoc now - MEDIA_ORPHAN_MS ma khong phai bia cua mot cuon, khong nam trong o bia nao cua dong
 *    thoi gian, va khong nhap hay to da dang nao cua cuon tham chieu. Bia cho gan qua han (chua co sach, chua o nao tro
 *    toi) nam trong so nay; bia da thuoc mot cuon hoac dang duoc mot o bia chon thi khong.
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
      sql`not (${BIA_CUA_SACH} or ${trongOBia(db)})`,
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
