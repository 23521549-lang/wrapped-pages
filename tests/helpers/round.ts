import { and, eq, sql } from "drizzle-orm";
import { pages, rounds } from "@/server/db/schema";
import type { TestDb } from "./db";
import { to } from "./library";

/** Moc dang mac dinh cua luot ghi thang trong test. */
export const MOC_LUOT = new Date("2026-09-01T00:00:00.000Z");

/** Ghi thang mot luot chua co to nao cua mot cuon, tra id. Chi de dung du lieu kiem rang buoc. */
export async function taoLuot(db: TestDb, bookId: string, publishedAt: Date = MOC_LUOT): Promise<string> {
  const [r] = await db.insert(rounds).values({ bookId, publishedAt }).returning({ id: rounds.id });
  return r.id;
}

/**
 * Ghi thang mot luot phu cac to first, first + 1, ... voi noi dung cho san (jsonb nguyen van, ke ca khoi media ma
 * DocJson chua ke), khong qua publishDraft. Tra id luot.
 */
export async function themLuot(
  db: TestDb, bookId: string, first: number, cacTo: readonly unknown[], publishedAt: Date = MOC_LUOT,
): Promise<string> {
  const roundId = await taoLuot(db, bookId, publishedAt);
  for (const [i, content] of cacTo.entries()) {
    await db.execute(sql`insert into pages (book_id, round_id, position, content, published_at)
      values (${bookId}, ${roundId}, ${first + i}, ${JSON.stringify(content)}::jsonb, ${publishedAt.toISOString()}::timestamptz)`);
  }
  return roundId;
}

/** Luot phu dung cac to first toi last, moi to mot doan chu "To N". */
export function luotChu(db: TestDb, bookId: string, first: number, last = first, publishedAt: Date = MOC_LUOT): Promise<string> {
  return themLuot(db, bookId, first, Array.from({ length: last - first + 1 }, (_, i) => to(`Tờ ${first + i}`)), publishedAt);
}

/** Id luot chua to position cua mot cuon. */
export async function luotCua(db: TestDb, bookId: string, position: number): Promise<string> {
  const [row] = await db.select({ id: pages.roundId }).from(pages).where(and(eq(pages.bookId, bookId), eq(pages.position, position)));
  if (!row) throw new Error(`khong co to ${position}`);
  return row.id;
}
