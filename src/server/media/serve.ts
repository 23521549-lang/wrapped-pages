import { parseRange } from "@/lib/media/range";
import type { AnyDb } from "@/server/db/types";
import { canViewMedia } from "./access";
import type { MediaStore } from "./store";

/** Header cua moi phan hoi khong co than tep: khong cache, khong doan kieu. */
const NO_FILE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;

/**
 * Cache rieng tu theo phien: chi trinh duyet duoc giu ban sao, va moi lan dung lai deu phai hoi lai may chu, vi quyen xem
 * doi theo che do sach va niem phong. Vary: Cookie de mot ho so trinh duyet dung chung cho hai cho ngoi khong dung
 * lai ban da luu cua phien truoc. Khong co max-age duong: thu hoi quyen phai co hieu luc ngay o lan ve sau.
 */
const CACHE = { "Cache-Control": "private, no-cache", Vary: "Cookie" } as const;

function noFile(status: 404 | 503): Response {
  return new Response(null, { status, headers: NO_FILE });
}

/**
 * Phan hoi cua route /m/[id]. Ham theo tham so, khong doc cookie hay bien moi truong: route
 * truyen nguoi dang nhap, kho tep va header Range.
 * - Chua dang nhap, khong co quyen (canViewMedia) hay khong ton tai: cung mot 404 rong, khong lo su ton tai.
 * - Co quyen ma kho tat: 503. Dong con ma object mat trong kho: 404.
 * - Range qua parseRange: 200 ca tep, 206 mot khoang kem Content-Range, 416 khi khoang nam ngoai tep.
 * - If-None-Match khop ETag: 304 rong, nhung chi sau khi canViewMedia van cho phep, nen mat quyen la 404 chu khong bao
 *   gio la 304.
 * Content-Type lay tu bang media (mime da sniff luc tai len), kem nosniff, inline, cache rieng tu theo phien (CACHE) va
 * khong gui Referer. Than tep di thang tu kho, khong doc het vao bo nho.
 */
export async function serveMedia(
  db: AnyDb, store: MediaStore | null, viewerId: string | null, mediaId: string, range: string | null,
  ifNoneMatch: string | null, now: Date,
): Promise<Response> {
  if (viewerId === null) return noFile(404);
  const file = await canViewMedia(db, viewerId, mediaId, now);
  if (!file) return noFile(404);
  // Key object chua uuid nen mot id luon tro toi dung mot day byte: ETag la id la du, khong phai bam noi dung.
  const etag = `"${file.id}"`;
  if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: { ...CACHE, ETag: etag } });
  if (!store) return noFile(503);
  const parsed = parseRange(range, file.bytes);
  if (parsed.status === 416) {
    return new Response(null, { status: 416, headers: { ...NO_FILE, "Accept-Ranges": "bytes", "Content-Range": `bytes */${file.bytes}` } });
  }
  const byteRange = parsed.status === 206 ? { start: parsed.start, end: parsed.end } : null;
  const body = await store.get(file.storeKey, byteRange);
  if (!body) return noFile(404);
  const headers = new Headers({
    "Content-Type": file.mime,
    // media.bytes la so byte ghi luc tai len, KHONG phai kich thuoc object doc lai tu kho: so cai media_objects ghi truoc
    // put va dong media chi duoc ghi sau khi put xong, nen hai so luon khop. parseRange cung phai quyet truoc khi cham kho.
    "Content-Length": String(byteRange ? byteRange.end - byteRange.start + 1 : file.bytes),
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    ETag: etag,
    ...CACHE,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (byteRange) headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${file.bytes}`);
  return new Response(body, { status: byteRange ? 206 : 200, headers });
}
