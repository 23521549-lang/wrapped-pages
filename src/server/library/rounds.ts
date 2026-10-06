import { asc, eq, inArray, min, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { pages, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/**
 * Khoang to (to dau, to cuoi) cua moi luot, tinh tu pages. Vi tri to chi song o pages.position, nen niem phong, dong
 * Hoat dong va man sua deu join subquery nay thay vi luu vi tri rieng. Luot luon co it nhat mot to (khong co duong xoa
 * to hay luot) va cac to cua luot lien nhau (publishDraft va editRound deu chen lien mot khoi, migration 0009 kiem).
 * Biet truoc cuon thi truyen bookId: gom nhom chi tren cac to cua cuon do thay vi ca bang pages. Biet truoc MOT NHOM
 * cuon (khung sach lon cua ke sach) thi truyen ca mang: van con chi muc theo book_id, khong phai gom nhom ca bang.
 * Noi goi lay moi cuon (dong Hoat dong) goi khong tham so.
 */
export function khoangLuot(bookId?: string | readonly string[]) {
  return new QueryBuilder()
    .select({
      roundId: pages.roundId,
      first: sql<number>`min(${pages.position})`.as("dau"),
      last: sql<number>`max(${pages.position})`.as("cuoi"),
    })
    .from(pages)
    .where(bookId === undefined ? undefined : Array.isArray(bookId) ? inArray(pages.bookId, bookId) : eq(pages.bookId, bookId as string))
    .groupBy(pages.roundId)
    .as("khoang_luot");
}

/**
 * Mot luot dang cua cuon: so thu tu tu 1 theo vi tri to, khoang to, moc dang, lan sua gan nhat, nguoi viet va ten luot
 * (5c: ten chi co o sach viet cung, null hien "Lượt N").
 */
export type RoundSpan = {
  id: string; ordinal: number; first: number; last: number; publishedAt: Date; editedAt: Date | null;
  authorId: string; ten: string | null;
};

/**
 * Moi luot cua NHIEU cuon trong dung MOT cau lenh, theo vi tri to, gom theo cuon. So thu tu dem rieng trong tung cuon.
 * Khung sach lon cua ke sach doc toi sau cuon mot luc, nen doc tung cuon mot la N+1 (xem tests/unit/ngan-sach-ke-sach.test.ts).
 */
export async function roundsOfBooks(db: AnyDb, bookIds: readonly string[]): Promise<Map<string, RoundSpan[]>> {
  const theo = new Map<string, RoundSpan[]>();
  if (bookIds.length === 0) return theo;
  const khoang = khoangLuot(bookIds);
  const rows = await db
    .select({
      bookId: rounds.bookId,
      id: rounds.id, publishedAt: rounds.publishedAt, editedAt: rounds.editedAt, first: khoang.first, last: khoang.last,
      authorId: rounds.tacGiaId, ten: rounds.ten,
    })
    .from(rounds)
    .innerJoin(khoang, eq(khoang.roundId, rounds.id))
    .where(inArray(rounds.bookId, bookIds))
    .orderBy(asc(khoang.first));
  // Moi dong la vat the moi cua rieng truy van nay, khong ai khac giu tham chieu, nen gan thang so thu tu vao do.
  for (const { bookId, ...r } of rows) {
    const cua = theo.get(bookId) ?? [];
    cua.push(Object.assign(r, { ordinal: cua.length + 1 }));
    theo.set(bookId, cua);
  }
  return theo;
}

/**
 * Moi luot cua mot cuon, theo vi tri to. Goi lai roundsOfBooks chu khong tu truy van: thu tu luot va cach danh so chi
 * duoc dinh nghia o MOT cho trong ca du an, nen hai duong doc khong the xep khac nhau.
 */
export async function roundsOfBook(db: AnyDb, bookId: string): Promise<RoundSpan[]> {
  return (await roundsOfBooks(db, [bookId])).get(bookId) ?? [];
}

/** To dau cua mot luot, doc bang db hay giao dich dang chay. */
export async function roundFirst(db: AnyDb, roundId: string): Promise<number> {
  const [row] = await db.select({ first: min(pages.position) }).from(pages).where(eq(pages.roundId, roundId));
  if (row === undefined || row.first === null) throw new Error("luot khong co to nao");
  return row.first;
}
