import { and, eq, sql } from "drizzle-orm";
import { books, pages } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { DocJson } from "@/lib/doc/types";
import { mediaIdsOf } from "@/lib/media/node";
import { isUuid } from "@/lib/uuid";
import { bindMedia } from "@/server/media/access";
import { sealAt, sealsOfBook } from "@/server/seal/seals";
import { findOwnBook } from "./books";

/**
 * Mot to nhu man sua can. To niem phong chi co vi tri: noi dung cua no khong bao gio duoc doc ra, ke ca voi chu sach.
 * version la moc phien ban (lan sua gan nhat, hay luc dang) dang ISO, man sua gui lai nguyen van khi luu.
 */
export type PageForEdit =
  | { kind: "sealed"; position: number }
  | { kind: "ok"; position: number; content: DocJson; version: string; bookTitle: string; publishedAt: Date; editedAt: Date | null };

export type EditResult = "saved" | "unchanged" | "not-found" | "sealed" | "stale" | "invalid-media";

function isPosition(position: number): boolean {
  return Number.isInteger(position) && position >= 1;
}

/**
 * Co to o vi tri position trong cuon cua chinh ownerId khong. Chi doc vi tri, khong doc noi dung, nen dung duoc cho
 * ca to niem phong. Dung lam cong truoc khung giu cho cua man sua: sai thi 404 ngay, dung ma tran nhu readPageForEdit.
 */
export async function ownPageExists(db: AnyDb, ownerId: string, bookId: string, position: number): Promise<boolean> {
  if (!isUuid(bookId) || !isPosition(position)) return false;
  const rows = await db
    .select({ position: pages.position })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId), eq(pages.position, position)));
  return rows.length > 0;
}

/**
 * Doc mot to de chu sach sua. null khi bookId, vi tri sai dang, sach khong phai cua ownerId hay khong co to o vi tri
 * do: noi goi tra 404 nhu moi cho khac, khong lo su ton tai. Niem phong duoc xet truoc va cau doc noi dung chi chay
 * khi to khong niem phong, nen to hen gio chua toi gio khong bao gio lot noi dung ra, du chi vao bo nho may chu.
 */
export async function readPageForEdit(db: AnyDb, ownerId: string, bookId: string, position: number): Promise<PageForEdit | null> {
  if (!isUuid(bookId) || !isPosition(position)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return null;
    const at = and(eq(pages.bookId, book.id), eq(pages.position, position));
    const [sealRows, found] = await Promise.all([
      sealsOfBook(tx, book.id),
      tx.select({ position: pages.position }).from(pages).where(at),
    ]);
    if (found.length === 0) return null;
    if (sealAt(sealRows, position)) return { kind: "sealed", position };
    const [row] = await tx.select({ content: pages.content, publishedAt: pages.publishedAt, editedAt: pages.editedAt }).from(pages).where(at);
    if (!row) return null;
    return {
      kind: "ok", position, content: row.content, version: (row.editedAt ?? row.publishedAt).toISOString(),
      bookTitle: book.title, publishedAt: row.publishedAt, editedAt: row.editedAt,
    };
  });
}

/**
 * Chu sach sua noi dung mot to da dang, tai cho: vi tri, moc dang, niem phong, moc doc, nhap va Hoat dong khong doi,
 * khong ghi su kien nao. Moi thu trong mot giao dich:
 * - khoa dong sach (FOR UPDATE) de lan sua xep hang voi publishDraft va voi lan sua khac cua cung cuon;
 * - to niem phong khong sua duoc o moi trang thai. Niem phong chi sinh cung mot lan dang, cho vi tri moi, nen sau
 *   khi khoa dong sach khong the co niem phong moi phu len to nay;
 * - khoa lac quan: base phai trung moc phien ban (edited_at, hay published_at khi chua sua). So o muc mili giay vi
 *   Date chi giu toi do, con timestamptz giu micro giay;
 * - media qua bindMedia voi keep la id dang co tren chinh to;
 * - so noi dung bang phep bang cua jsonb (khong giu thu tu khoa), nen gui lai y nguyen la "unchanged", edited_at giu.
 * edited_at tinh ngay trong cau UPDATE: now (mac dinh gio cua database, test truyen moc co dinh) nhung khong som hon
 * published_at, va sau moc phien ban cu it nhat 1 ms. Nho vay CHECK pages_edited_at khong bao gio vo vi dong ho may
 * ung dung lech voi database (published_at cua dong cu lay tu now() cua database), va moc phien ban luon tang sau moi
 * lan luu, ke ca khi hai lan cung bi day len published_at: tab giu moc cu van nhan "stale", khong ghi de im lang.
 */
export async function editPage(
  db: AnyDb, ownerId: string, bookId: string, position: number, content: DocJson, base: Date, now?: Date,
): Promise<EditResult> {
  if (!isUuid(bookId) || !isPosition(position)) return "not-found";
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)))
      .for("update");
    // Drizzle COMMIT khi ham tra ve binh thuong. Nam duong tra ve duoi day deu nam TRUOC lenh ghi duy nhat
    // (tx.update o cuoi) va moi thu truoc chung chi la lenh doc. Khong them lenh ghi nao vao khoang nay.
    if (!book) return "not-found";
    const at = and(eq(pages.bookId, book.id), eq(pages.position, position));
    const [row] = await tx
      .select({
        content: pages.content,
        stale: sql<boolean>`date_trunc('milliseconds', coalesce(${pages.editedAt}, ${pages.publishedAt})) <> ${base.toISOString()}::timestamptz`,
      })
      .from(pages)
      .where(at)
      .for("update");
    if (!row) return "not-found";
    if (sealAt(await sealsOfBook(tx, book.id), position)) return "sealed";
    if (row.stale) return "stale";
    const bound = await bindMedia(tx, ownerId, book.id, content, { keep: new Set(mediaIdsOf(row.content)) });
    if (!bound) return "invalid-media";
    const changed = await tx
      .update(pages)
      .set({
        content: bound,
        editedAt: sql`greatest(${now ? sql`${now.toISOString()}::timestamptz` : sql`now()`}, ${pages.publishedAt}, coalesce(${pages.editedAt}, ${pages.publishedAt}) + interval '1 millisecond')`,
      })
      .where(and(at, sql`${pages.content} is distinct from ${JSON.stringify(bound)}::jsonb`))
      .returning({ position: pages.position });
    return changed.length > 0 ? "saved" : "unchanged";
  });
}
