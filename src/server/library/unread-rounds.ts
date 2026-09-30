import { and, count, desc, eq, inArray, min, ne, notExists, sql } from "drizzle-orm";
import { accounts, books, pages, readSheets, rounds } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { docExcerpt, markedExcerpt } from "@/lib/doc/text";
import { isLockedFor, sealsOfBooks } from "@/server/seal/seals";
import { drawOfDay, HAS_TEXT, markedSheets } from "./shelf";

/** So luot toi da khung sach lon luan phien. */
export const LUOT_TOI_DA = 6;

/** Mot luot chua doc cua khung sach lon (spec 5a muc E1). Khong mang id tai khoan nao. */
export type LuotChuaDoc = {
  roundId: string;
  bookId: string;
  title: string;
  /**
   * Luot do chinh nguoi xem viet (nguoi kia chua doc het); sai la luot cua nguoi kia ma nguoi xem chua doc het. Theo
   * nguoi viet luot (5c): sach viet cung co luot cua ca hai.
   */
  mine: boolean;
  /** So trang cua ca cuon, nhu dong "N trang" cua khung sach lon. */
  pageCount: number;
  publishedAt: Date;
  /** To dau cua luot. */
  first: number;
  /** To cua doan dang hien (bam khung thi mo toi day); khong co doan hay luot con khoa thi la to dau cua luot. */
  position: number;
  /** Doan da chon, doan ngau nhien trong ngay, hay (khi locked) dong he lo; null khi luot khong co chu. */
  excerpt: string | null;
  /** Luot con niem phong voi nguoi xem: excerpt chi la dong he lo, khong bao gio la chu that. */
  locked: boolean;
};

/**
 * Cac luot chua doc cho khung sach lon luan phien, moi nhat truoc, toi da LUOT_TOI_DA, theo NGUOI VIET LUOT (5c: sach viet
 * cung co luot cua ca hai):
 * - luot nguoi kia viet (cuon chia se) co it nhat mot to nguoi xem chua thay;
 * - luot nguoi xem viet trong cuon CHIA SE co it nhat mot to nguoi kia chua thay (cuon rieng tu nguoi kia khong doc duoc).
 * Doan cua moi luot theo thu tu cua khung sach lon: luot con khoa voi nguoi xem thi chi dong he lo; co doan da chon thi
 * lay doan do; khong thi bat tham co dinh trong ngay trong cac to co chu cua luot (drawOfDay theo luot). Noi dung cua
 * luot con khoa khong duoc doc ra khoi database: chi cac luot da mo moi di vao hai truy van lay chu. Moi cau lenh doc
 * chung mot anh chup.
 */
export async function unreadRounds(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<LuotChuaDoc[]> {
  return readSnapshot(db, async (tx) => {
    const [kia] = await tx.select({ id: accounts.id }).from(accounts).where(ne(accounts.id, viewerId)).limit(1);
    // Nguoi can doc to dang xet: nguoi xem voi luot nguoi kia viet, nguoi kia voi luot nguoi xem viet.
    const nguoiDoc = kia === undefined
      ? sql`${viewerId}::uuid`
      : sql`case when ${rounds.tacGiaId} = ${viewerId} then ${kia.id}::uuid else ${viewerId}::uuid end`;
    const chuaDoc = notExists(
      tx
        .select({ x: sql`1` })
        .from(readSheets)
        .where(and(
          sql`${readSheets.accountId} = ${nguoiDoc}`,
          eq(readSheets.bookId, pages.bookId),
          eq(readSheets.position, pages.position),
        )),
    );
    const luot = await tx
      .select({
        roundId: pages.roundId, bookId: pages.bookId, title: books.title, ownerId: books.ownerId, tacGiaId: rounds.tacGiaId,
        publishedAt: rounds.publishedAt, first: min(pages.position),
      })
      .from(pages)
      .innerJoin(books, eq(books.id, pages.bookId))
      .innerJoin(rounds, eq(rounds.id, pages.roundId))
      .where(and(
        eq(books.mode, "chia-se"),
        // Chua co nguoi kia thi khong ai doc luot cua nguoi xem: chi con luot cua nguoi kia (khong co).
        kia === undefined ? ne(rounds.tacGiaId, viewerId) : undefined,
        chuaDoc,
      ))
      .groupBy(pages.roundId, pages.bookId, books.title, books.ownerId, rounds.tacGiaId, rounds.publishedAt)
      .orderBy(desc(rounds.publishedAt), desc(pages.roundId))
      .limit(LUOT_TOI_DA);
    if (luot.length === 0) return [];

    const sachIds = [...new Set(luot.map((l) => l.bookId))];
    const [soTrang, niem] = await Promise.all([
      tx.select({ bookId: pages.bookId, n: count() }).from(pages).where(inArray(pages.bookId, sachIds)).groupBy(pages.bookId),
      sealsOfBooks(tx, sachIds),
    ]);
    const soTrangCua = new Map(soTrang.map((r) => [r.bookId, r.n]));
    const niemCua = new Map(niem.map((r) => [r.roundId, r]));
    // Niem phong theo chu cuon: moi luot niem phong do chu cuon viet (sach viet cung khong co niem phong moi).
    const khoa = (l: (typeof luot)[number]) => {
      const n = niemCua.get(l.roundId);
      return n !== undefined && isLockedFor(n, l.ownerId === viewerId, now);
    };
    // Chi luot da mo voi nguoi xem moi duoc doc chu.
    const mo = luot.filter((l) => !khoa(l)).map((l) => l.roundId);
    const [danhDau, thamTrongNgay] = await Promise.all([
      mo.length > 0 ? markedSheets(tx, mo) : [],
      mo.length > 0 ? drawOfDay(tx, and(inArray(pages.roundId, mo), HAS_TEXT)!, viewerId, now, true) : [],
    ]);
    // To mang dau dau tien co chu khong rong cua moi luot (markedSheets da sap theo cuon roi vi tri).
    const doanChon = new Map<string, { position: number; excerpt: string }>();
    for (const p of danhDau) {
      const chu = markedExcerpt(p.content);
      if (chu !== null && !doanChon.has(p.roundId)) doanChon.set(p.roundId, { position: p.position, excerpt: chu });
    }
    const tham = new Map(thamTrongNgay.map((p) => [p.roundId, { position: p.position, excerpt: docExcerpt(p.content) }]));

    return luot.map((l): LuotChuaDoc => {
      const dau = l.first ?? 1;
      const locked = khoa(l);
      const doan = locked ? undefined : doanChon.get(l.roundId) ?? tham.get(l.roundId);
      return {
        roundId: l.roundId, bookId: l.bookId, title: l.title, mine: l.tacGiaId === viewerId,
        pageCount: soTrangCua.get(l.bookId) ?? 0, publishedAt: l.publishedAt, first: dau,
        position: doan?.position ?? dau,
        excerpt: locked ? niemCua.get(l.roundId)?.teaser || null : doan?.excerpt ?? null,
        locked,
      };
    });
  });
}
