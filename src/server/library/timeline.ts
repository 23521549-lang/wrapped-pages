import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { bookCovers, books, bookTracks, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { CoverKey } from "@/lib/book";
import { khoangLuot } from "./rounds";

/** Bia hien hanh cua mot cuon, dung ten truong ma giao dien van dung. */
export type CoverNow = { cover: CoverKey; coverMediaId: string | null };
export type NewestCover = CoverNow & { bookId: string };

/** Mot o tren dong thoi gian bia. roundId null la o mo dau, khi do ordinal, first va last deu null. */
export type CoverEntry = {
  id: string;
  roundId: string | null;
  ordinal: number | null;
  first: number | null;
  last: number | null;
  at: Date;
  cover: CoverKey;
  coverMediaId: string | null;
};

/** Mot o tren dong thoi gian nhac. youtubeId null la o GO NHAC: tu luot nay cuon khong con nhac nen. */
export type TrackEntry = Omit<CoverEntry, "cover" | "coverMediaId"> & { youtubeId: string | null };

/**
 * Cac luot cua mot cuon kem so thu tu va khoang to. Dung lam ve trai cua dong thoi gian, nen mot truy van la du:
 * khong phai doc bang rounds mot lan nua o noi goi.
 */
function luotCuaCuon(db: AnyDb, bookId: string) {
  const khoang = khoangLuot(bookId);
  return db
    .select({
      id: rounds.id,
      publishedAt: rounds.publishedAt,
      first: khoang.first,
      last: khoang.last,
      ordinal: sql<number>`row_number() over (order by ${khoang.first})`.mapWith(Number).as("thu_tu"),
    })
    .from(rounds)
    .innerJoin(khoang, eq(khoang.roundId, rounds.id))
    .where(eq(rounds.bookId, bookId))
    .as("luot");
}

/**
 * Bia moi nhat cua tung cuon, mot dong moi cuon. Khoa sap xep la VI TRI TO DAU cua luot (o mo dau la 0), dung mot khoa
 * voi coversOfBook: hai ham lay hai khoa khac nhau thi ke sach va trang dong thoi gian co the xep khac nhau. Cuon khong
 * co o bia nao thi khong co dong; noi goi coi cuon do nhu khong ton tai (bat bien cua book_covers).
 * Nhieu cuon mot luot nen khoangLuot() goi khong tham so: do la mot phep gom nhom tren CA bang pages, khong co chi muc
 * nao lo phan do - chap nhan duoc vi web chi co hai nguoi, nhung dung tuong la no re nhu mot phep tra chi muc.
 */
export async function newestCovers(db: AnyDb, bookIds: readonly string[]): Promise<NewestCover[]> {
  if (bookIds.length === 0) return [];
  const khoang = khoangLuot();
  return db
    .selectDistinctOn([bookCovers.bookId], {
      bookId: bookCovers.bookId, cover: bookCovers.cover, coverMediaId: bookCovers.coverMediaId,
    })
    .from(bookCovers)
    .leftJoin(khoang, eq(khoang.roundId, bookCovers.roundId))
    .where(inArray(bookCovers.bookId, [...bookIds]))
    .orderBy(bookCovers.bookId, desc(sql`coalesce(${khoang.first}, 0)`));
}

/** Bia moi nhat cua mot cuon; null khi cuon chua co o bia nao. */
export async function newestCover(db: AnyDb, bookId: string): Promise<CoverNow | null> {
  const [row] = await newestCovers(db, [bookId]);
  return row === undefined ? null : { cover: row.cover, coverMediaId: row.coverMediaId };
}

/**
 * Ma video cua nhac nen hien hanh; null khi cuon khong co o nhac nao HOAC khi o moi nhat la o go nhac. Man doc phat ma
 * nay chu khong phai nhac cua luot dang mo: khung nhac la cua ca cuon, doi giua chung se nap lai trinh phat.
 */
export async function newestTrack(db: AnyDb, bookId: string): Promise<string | null> {
  const khoang = khoangLuot(bookId);
  const [row] = await db
    .select({ youtubeId: bookTracks.youtubeId })
    .from(bookTracks)
    .leftJoin(khoang, eq(khoang.roundId, bookTracks.roundId))
    .where(eq(bookTracks.bookId, bookId))
    .orderBy(desc(sql`coalesce(${khoang.first}, 0)`))
    .limit(1);
  return row?.youtubeId ?? null;
}

/** Ca dong thoi gian bia cua mot cuon theo thu tu: o mo dau truoc, roi cac o theo vi tri to dau cua luot. */
export async function coversOfBook(db: AnyDb, bookId: string): Promise<CoverEntry[]> {
  const luot = luotCuaCuon(db, bookId);
  return db
    .select({
      id: bookCovers.id,
      roundId: bookCovers.roundId,
      ordinal: luot.ordinal,
      first: luot.first,
      last: luot.last,
      at: sql<Date>`coalesce(${luot.publishedAt}, ${books.createdAt})`.mapWith(books.createdAt),
      cover: bookCovers.cover,
      coverMediaId: bookCovers.coverMediaId,
    })
    .from(bookCovers)
    .innerJoin(books, eq(books.id, bookCovers.bookId))
    .leftJoin(luot, eq(luot.id, bookCovers.roundId))
    .where(eq(bookCovers.bookId, bookId))
    .orderBy(asc(sql`coalesce(${luot.first}, 0)`));
}

/** Ca dong thoi gian nhac cua mot cuon, cung thu tu voi coversOfBook. Giu ca o go nhac. */
export async function tracksOfBook(db: AnyDb, bookId: string): Promise<TrackEntry[]> {
  const luot = luotCuaCuon(db, bookId);
  return db
    .select({
      id: bookTracks.id,
      roundId: bookTracks.roundId,
      ordinal: luot.ordinal,
      first: luot.first,
      last: luot.last,
      at: sql<Date>`coalesce(${luot.publishedAt}, ${books.createdAt})`.mapWith(books.createdAt),
      youtubeId: bookTracks.youtubeId,
    })
    .from(bookTracks)
    .innerJoin(books, eq(books.id, bookTracks.bookId))
    .leftJoin(luot, eq(luot.id, bookTracks.roundId))
    .where(eq(bookTracks.bookId, bookId))
    .orderBy(asc(sql`coalesce(${luot.first}, 0)`));
}
