import { sql } from "drizzle-orm";
import { media, mediaObjects } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { mediaStoreKey } from "@/lib/media/key";
import { MEDIA_TOTAL_MAX_BYTES } from "@/lib/media/kinds";
import { findOwnBook } from "@/server/library/books";
import { recordUpload, type UploadRecord } from "./access";
import type { MediaStore } from "./store";

/** Ket qua mot lan luu: ghi xong, cuon khong phai cua nguoi tai len, hoac kho da gan day. */
export type SaveResult = "saved" | "not-found" | "full";

/**
 * Luu mot tep da qua parseUploadForm. bookId khac null phai la cuon cua chinh ownerId; khong thi khong ghi gi va tra
 * "not-found". Tong so byte dang co trong bang media cong tep moi khong duoc vuot MEDIA_TOTAL_MAX_BYTES; vuot thi tra
 * "full" va khong cham vao kho, de web la noi tu choi chu khong phai nha cung cap. Thu tu: so cai media_objects, put vao
 * kho, roi dong media (recordUpload kiem lai cuon). Hong o buoc nao thi key da nam trong so cai, nen sweepMedia van tim
 * ra object de xoa: kho khong bao gio giu mot object khong ai biet.
 */
export async function saveUpload(db: AnyDb, store: MediaStore, record: UploadRecord, body: Uint8Array<ArrayBuffer>): Promise<SaveResult> {
  if (record.bookId !== null && !(await findOwnBook(db, record.ownerId, record.bookId))) return "not-found";
  const [tong] = await db.select({ bytes: sql<string>`coalesce(sum(${media.bytes}), 0)` }).from(media);
  if (Number(tong.bytes) + record.bytes > MEDIA_TOTAL_MAX_BYTES) return "full";
  const key = mediaStoreKey(record.bookId, record.id, record.mime);
  await db.insert(mediaObjects).values({ storeKey: key });
  await store.put(key, body, record.mime);
  return (await recordUpload(db, record)) ? "saved" : "not-found";
}
