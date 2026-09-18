import type { MediaMime } from "./kinds";

/** Tien to cua bia cho gan: tai len luc tao sach, chua co id sach. Chi mediaStoreKey ngay trong file nay dung. */
const PENDING_PREFIX = "cho";

const EXTENSIONS = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
} as const satisfies Record<MediaMime, string>;

/**
 * Dang key cua mot object: tien to sach (hoac cho), id media, duoi theo mime. Uuid chu thuong, dung nhu Postgres
 * va crypto.randomUUID tra ve. Khong co ky tu nao khac, nen key khong bao gio chua chu nguoi dung hay duong di
 * vuot thu muc. CHECK media_store_key dung dung mau nay (co test).
 */
export const STORE_KEY =
  /^(cho|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[/][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg|webm|m4a)$/;

/** Key object cua mot media. Nguon duy nhat: tai len va ghi dong media cung goi ham nay. */
export function mediaStoreKey(bookId: string | null, mediaId: string, mime: MediaMime): string {
  return `${bookId ?? PENDING_PREFIX}/${mediaId}.${EXTENSIONS[mime]}`;
}
