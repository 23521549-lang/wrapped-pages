import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { drafts, media, pages } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { mediaStoreKey } from "@/lib/media/key";
import type { AudioMime, ImageMime, MediaKind, MediaMime } from "@/lib/media/kinds";
import { isMediaNodeType, mediaNodeId, type MediaNode, type MediaNodeType } from "@/lib/media/node";
import { isUuid } from "@/lib/uuid";
import { findOwnBook, findReadableBook } from "@/server/library/books";
import { isLockedFor, sealAt, sealsOfBook } from "@/server/seal/seals";

type ImageUpload = { kind: "anh"; bookId: string; mime: ImageMime; width: number; height: number };
/** Bia co the chua co sach: tai len luc tao sach, gan trong giao dich createBook. */
type CoverUpload = { kind: "bia"; bookId: string | null; mime: ImageMime; width: number; height: number };
type AudioUpload = { kind: "ghi-am"; bookId: string; mime: AudioMime; durationMs: number; peaks: number[] };

/** Mot tep vua put thanh cong vao kho, voi mime va kich thuoc da qua sniffMedia. */
export type UploadRecord = { id: string; ownerId: string; bytes: number } & (ImageUpload | CoverUpload | AudioUpload);

/**
 * Dong media ma route doc can: loai, mime va so byte tu bang, key object. Kieu chi dung trong may chu: storeKey
 * khong bao gio duoc dat vao du lieu gui xuong trinh duyet.
 */
export type MediaFile = { id: string; kind: MediaKind; mime: MediaMime; bytes: number; storeKey: string };

/**
 * Ghi dong media sau khi put object thanh cong. Key tinh lai bang mediaStoreKey, cung ham noi tai len da dung de
 * put. bookId khac null phai la sach cua chinh ownerId; khong thi khong ghi va tra false. Chay bang db hoac giao
 * dich cua noi goi, khong goi readSnapshot.
 */
export async function recordUpload(tx: AnyDb, record: UploadRecord): Promise<boolean> {
  if (record.bookId !== null && !(await findOwnBook(tx, record.ownerId, record.bookId))) return false;
  await tx.insert(media).values({ ...record, storeKey: mediaStoreKey(record.bookId, record.id, record.mime) });
  return true;
}

/**
 * Dieu kien SQL: tai lieu trong cot (pages.content hay drafts.content) co mot khoi cap cao nhat mang attrs.id la
 * mot trong ids. Tim bang jsonpath: media chi nam o cap cao nhat nen duong dan nong, va chu trong trang trung id
 * khong khop.
 */
function referencesAny(column: AnyPgColumn, ids: readonly string[]) {
  return sql`jsonb_path_exists(${column}, '$.content[*] ? (@.attrs.id == $ids[*])', ${JSON.stringify({ ids })}::jsonb)`;
}

type BindRow = Pick<typeof media.$inferSelect, "id" | "kind" | "width" | "height" | "durationMs" | "peaks">;

/** Khoi media dung thuoc tinh lay tu dong media; null khi loai dong khong khop loai khoi. */
function boundNode(type: MediaNodeType, row: BindRow): MediaNode | null {
  if (type === "anh" && row.kind === "anh" && row.width !== null && row.height !== null) {
    return { type, attrs: { id: row.id, w: row.width, h: row.height } };
  }
  if (type === "ghi-am" && row.kind === "ghi-am" && row.durationMs !== null && row.peaks !== null) {
    return { type, attrs: { id: row.id, ms: row.durationMs, peaks: row.peaks } };
  }
  return null;
}

/**
 * Doi chieu moi khoi media cap cao nhat cua mot tai lieu voi bang media, chong muon id: id phai co dong media
 * cua chinh ownerId, thuoc dung cuon bookId, dung loai khoi (bia khong bao gio nam trong trang), va chua nam trong
 * to da dang nao cua cuon. Luat cuoi chong lach hen gio: chep id cua mot to con khoa vao nhap moi roi dang
 * se lo media truoc gio mo, ke ca voi chu sach. Moi media vi vay nam tren nhieu nhat mot lan dang; id trong nhap hien
 * tai van gan lai duoc o moi lan tu luu. Thuoc tinh trinh duyet gui len bi bo, thay bang kich thuoc, thoi luong va
 * song am tu bang. Sai mot id thi tra null cho ca tai lieu. Moi khoi khac giu nguyen, dung thu tu. Goi bang db hoac
 * giao dich cua noi luu nhap, dang trang, truoc khi chen to cua lan dang do.
 *
 * Khi sua mot to da dang (editPage), opts.keep la tap id dang nam tren chinh to do. Id trong keep khong xet luat
 * "da nam tren to da dang": chung da nam tren to, giu lai khong lo gi moi, ke ca khi mot lan dang dan cung media
 * len hai to lien nhau. Luat chu, cuon, loai van ap cho moi id. Id moi (ngoai keep) phai khong nam tren to da dang
 * nao cua cuon va khong nam trong nhap hien tai cua cuon: neu cho qua, lan dang nhap sau se bi tu choi vi media do
 * vua o nhap vua o to da dang. Khong truyen opts thi hanh vi y nhu tren (luu nhap, dang trang).
 */
export async function bindMedia<B extends { type: string }>(
  db: AnyDb, ownerId: string, bookId: string, doc: { type: "doc"; content: readonly B[] },
  opts?: { keep: ReadonlySet<string> },
): Promise<{ type: "doc"; content: (B | MediaNode)[] } | null> {
  const refs = doc.content.filter((block) => isMediaNodeType(block.type)).map(mediaNodeId);
  if (refs.length === 0) return { type: "doc", content: [...doc.content] };
  const ids = refs.filter((id): id is string => id !== null);
  if (ids.length !== refs.length || !isUuid(bookId)) return null;
  const fresh = opts ? ids.filter((id) => !opts.keep.has(id)) : ids;
  const [rows, published, drafted] = await Promise.all([
    db
      .select({ id: media.id, kind: media.kind, width: media.width, height: media.height, durationMs: media.durationMs, peaks: media.peaks })
      .from(media)
      .where(and(inArray(media.id, ids), eq(media.ownerId, ownerId), eq(media.bookId, bookId))),
    fresh.length === 0
      ? []
      : db.select({ position: pages.position }).from(pages).where(and(eq(pages.bookId, bookId), referencesAny(pages.content, fresh))).limit(1),
    !opts || fresh.length === 0
      ? []
      : db.select({ bookId: drafts.bookId }).from(drafts).where(and(eq(drafts.bookId, bookId), referencesAny(drafts.content, fresh))).limit(1),
  ]);
  if (published.length > 0 || drafted.length > 0) return null;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const content: (B | MediaNode)[] = [];
  for (const block of doc.content) {
    if (isMediaNodeType(block.type)) {
      const row = byId.get(mediaNodeId(block) ?? "");
      const node = row ? boundNode(block.type, row) : null;
      if (!node) return null;
      content.push(node);
    } else {
      content.push(block);
    }
  }
  return { type: "doc", content };
}

/**
 * Media cua mot cuon co hien voi nguoi xem theo cac to da dang chua no khong. Chua to nao chua no (chi nam trong
 * nhap, hay vua tai len chua luu): chi chu sach. Co to chua no: can it nhat mot to khong khoa voi chinh nguoi xem
 * (isLockedFor voi isOwner), nen hen gio chua toi gio khoa ca chu sach, con cau do va trao doi chi khoa
 * nguoi kia.
 */
async function visibleOnPages(tx: AnyDb, bookId: string, mediaId: string, isOwner: boolean, now: Date): Promise<boolean> {
  const [rows, sealRows] = await Promise.all([
    tx.select({ position: pages.position }).from(pages).where(and(eq(pages.bookId, bookId), referencesAny(pages.content, [mediaId]))),
    sealsOfBook(tx, bookId),
  ]);
  if (rows.length === 0) return isOwner;
  return rows.some(({ position }) => {
    const seal = sealAt(sealRows, position);
    return !seal || !isLockedFor(seal, isOwner, now);
  });
}

/**
 * Viewer co duoc tai media nay khong. Moi lan doc deu goi lai, chay tren mot anh chup:
 * - id khong phai uuid hoac khong co dong: null;
 * - bia cho gan (chua co sach): chi nguoi tai len;
 * - sach khong doc duoc voi viewer (rieng tu cua nguoi kia): null, giong het khong ton tai;
 * - media la bia hien tai cua sach (books.cover_media_id) VA thuc su la dong kind = 'bia': duoc (chu sach, va
 *   nguoi kia khi sach chia se). Cot cover_media_id khong co CHECK rang buoc kind, chi co khoa ngoai toi media.id;
 *   vi vay cong tac nay tu kiem lai kind thay vi tin cover_media_id, de mot anh dang
 *   nam trong to hen gio con khoa khong the duoc lo som chi bang cach bi gan lam bia. Mot dong khong phai 'bia'
 *   duoc cover_media_id tro toi roi qua nhanh nay ma xet tiep bang luat to/niem phong ben duoi, khong bi tu choi
 *   ngay: mot anh da dang binh thuong van phai hien nhu moi anh khac.
 * - chua to da dang nao chua media: chi chu sach (nhap hien tai, tai len chua luu);
 * - co to da dang chua media: can it nhat mot to trong do khong khoa voi chinh viewer. To hen gio chua toi gio thi
 *   ca chu sach cung null, nhu readBook che to do voi ca hai.
 * Sach chuyen sang rieng tu hay to con khoa thi lan doc sau bi tu choi ngay.
 * visibleOnPages chi tim trong cac to cua media.book_id, nen bia gan voi mot sach phai la dong media co book_id
 * dung sach do: bia thuoc sach A ma bi gan lam cover_media_id cua sach B se van bi tu choi voi nguoi doc sach B,
 * vi book o day luon la sach cua chinh dong media (tim qua bookId cua row), khong phai sach goi ham.
 */
export async function canViewMedia(db: AnyDb, viewerId: string, mediaId: string, now: Date): Promise<MediaFile | null> {
  if (!isUuid(mediaId)) return null;
  return readSnapshot(db, async (tx) => {
    const [row] = await tx
      .select({ id: media.id, kind: media.kind, mime: media.mime, bytes: media.bytes, storeKey: media.storeKey, ownerId: media.ownerId, bookId: media.bookId })
      .from(media)
      .where(eq(media.id, mediaId));
    if (!row) return null;
    const { ownerId, bookId, ...file } = row;
    if (bookId === null) return ownerId === viewerId ? file : null;
    const book = await findReadableBook(tx, viewerId, bookId);
    if (!book) return null;
    if (book.coverMediaId === file.id && file.kind === "bia") return file;
    return (await visibleOnPages(tx, book.id, file.id, book.ownerId === viewerId, now)) ? file : null;
  });
}
