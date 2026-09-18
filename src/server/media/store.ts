import { STORE_KEY } from "@/lib/media/key";
import type { MediaMime } from "@/lib/media/kinds";

/** Khoang byte da qua parseRange: start va end tinh ca, nam trong tep. */
export type ByteRange = { start: number; end: number };

/**
 * Kho tep cua media. Ba ban cai: MemoryStore cho unit test, LocalDiskStore cho dev va e2e, S3Store cho
 * production. Moi ban cai nhan cau hinh qua tham so, khong import next hay server-only, va tu choi key sai dang
 * STORE_KEY truoc khi cham toi kho. Key moi media la duy nhat, nen put khong bao gio ghi de mot object dang dung.
 */
export interface MediaStore {
  put(key: string, bytes: Uint8Array<ArrayBuffer>, mime: MediaMime): Promise<void>;
  /** Ca object khi range null; null khi khong co object. */
  get(key: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array> | null>;
  /** Xoa cac object; key khong ton tai thi bo qua. */
  remove(keys: readonly string[]): Promise<void>;
}

/** Chan path traversal va key la: key chi gom tien to sach hoac cho, uuid va duoi (STORE_KEY). */
export function assertStoreKey(key: string): void {
  if (!STORE_KEY.test(key)) throw new Error("key object sai dang");
}
