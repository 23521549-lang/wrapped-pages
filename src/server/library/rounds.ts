import { asc, eq, min, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { pages, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/**
 * Khoang to (to dau, to cuoi) cua moi luot, tinh tu pages. Vi tri to chi song o pages.position, nen niem phong, dong
 * Hoat dong va man sua deu join subquery nay thay vi luu vi tri rieng. Luot luon co it nhat mot to (khong co duong xoa
 * to hay luot) va cac to cua luot lien nhau (publishDraft va editRound deu chen lien mot khoi, migration 0009 kiem).
 * Biet truoc cuon thi truyen bookId: gom nhom chi tren cac to cua cuon do thay vi ca bang pages. Noi goi lay nhieu cuon
 * mot luc (ke sach, dong Hoat dong) goi khong tham so.
 */
export function khoangLuot(bookId?: string) {
  return new QueryBuilder()
    .select({
      roundId: pages.roundId,
      first: sql<number>`min(${pages.position})`.as("dau"),
      last: sql<number>`max(${pages.position})`.as("cuoi"),
    })
    .from(pages)
    .where(bookId === undefined ? undefined : eq(pages.bookId, bookId))
    .groupBy(pages.roundId)
    .as("khoang_luot");
}

/** Mot luot dang cua cuon: so thu tu tu 1 theo vi tri to, khoang to, moc dang va lan sua gan nhat. */
export type RoundSpan = { id: string; ordinal: number; first: number; last: number; publishedAt: Date; editedAt: Date | null };

/** Moi luot cua mot cuon, theo vi tri to. */
export async function roundsOfBook(db: AnyDb, bookId: string): Promise<RoundSpan[]> {
  const khoang = khoangLuot(bookId);
  const rows = await db
    .select({ id: rounds.id, publishedAt: rounds.publishedAt, editedAt: rounds.editedAt, first: khoang.first, last: khoang.last })
    .from(rounds)
    .innerJoin(khoang, eq(khoang.roundId, rounds.id))
    .where(eq(rounds.bookId, bookId))
    .orderBy(asc(khoang.first));
  // Moi dong la vat the moi cua rieng truy van nay, khong ai khac giu tham chieu, nen gan thang so thu tu vao do.
  return rows.map((r, i) => Object.assign(r, { ordinal: i + 1 }));
}

/** Luot chua to position, neu co. */
export function roundAt<T extends { first: number; last: number }>(list: readonly T[], position: number): T | undefined {
  return list.find((r) => r.first <= position && position <= r.last);
}

/** To dau cua mot luot, doc bang db hay giao dich dang chay. */
export async function roundFirst(db: AnyDb, roundId: string): Promise<number> {
  const [row] = await db.select({ first: min(pages.position) }).from(pages).where(eq(pages.roundId, roundId));
  if (row === undefined || row.first === null) throw new Error("luot khong co to nao");
  return row.first;
}
