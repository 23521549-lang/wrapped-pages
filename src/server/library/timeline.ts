import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { bookCovers, books, bookTracks, rounds } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { COVERS, type CoverKey } from "@/lib/book";
import { isUuid } from "@/lib/uuid";
import { YOUTUBE_ID } from "@/lib/youtube";
import { attachCover, lockCover } from "@/server/media/cover";
import { khoangLuot } from "./rounds";
import { lockOwnBook } from "./remove";

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

/** Ket qua sua mot o. "last-cover" chi setCoverEntry moi tra: don o bia cuoi cung se pha bat bien cua book_covers. */
export type TimelineResult = "saved" | "not-found" | "invalid" | "invalid-cover" | "last-cover";

/**
 * Luot roundId co that trong cuon bookId khong. Chi mot cau SELECT thuong, KHONG khoa dong rounds: thu tu khoa thuong
 * truc cua du an la books (hoac accounts) truoc, rounds va moods sau, nen khoa rounds o day se bat cheo voi publishDraft.
 */
async function luotCuaSach(tx: AnyDb, bookId: string, roundId: string): Promise<boolean> {
  const [row] = await tx.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.id, roundId), eq(rounds.bookId, bookId)));
  return row !== undefined;
}

/**
 * Sua, dien hay don trong MOT o cua dong thoi gian bia. Chi chu sach; cuon cua nguoi khac tra "not-found" y nhu cuon
 * khong ton tai. roundId null la o mo dau. Ham nay KHONG tao duoc o ngoai cac luot da co va o mo dau, nen cau truc tu ep
 * luat "so o <= so luot + 1": moi luot la mot cho trong san, chu sach chi dien vao hoac don di.
 * Don o bia cuoi cung bi tu choi ("last-cover"): moi cuon luon phai con it nhat mot o bia, khong thi ke sach se can mot
 * nhanh "bia mac dinh", tuc la mot nguon su that thu hai.
 * Thu tu khoa: dong books (FOR UPDATE) truoc, roi anh bia (lockCover), roi moi ghi bang o. Dong sach da bi khoa nen
 * khong co nguoi ghi thu hai cho cung cuon; vi the "update truoc, khong trung dong nao thi insert" la du, va tranh phai
 * chi dung chi muc dich cho hai hinh dang khac nhau (unique round_id va chi muc rieng phan cua o mo dau).
 */
export async function setCoverEntry(
  db: AnyDb, ownerId: string, bookId: string, roundId: string | null,
  value: { cover: CoverKey; coverMediaId: string | null } | null,
): Promise<TimelineResult> {
  if (!isUuid(bookId)) return "not-found";
  if (roundId !== null && !isUuid(roundId)) return "not-found";
  if (value !== null && !(COVERS as readonly string[]).includes(value.cover)) return "invalid";
  if (value !== null && value.coverMediaId !== null && !isUuid(value.coverMediaId)) return "invalid";
  return db.transaction(async (tx): Promise<TimelineResult> => {
    // Moi duong tra ve som nam truoc lenh ghi dau tien; truoc chung chi co lenh doc va hai lenh khoa dong.
    const id = await lockOwnBook(tx, ownerId, bookId);
    if (!id) return "not-found";
    if (roundId !== null && !(await luotCuaSach(tx, id, roundId))) return "not-found";
    const cuaO = and(eq(bookCovers.bookId, id), roundId === null ? isNull(bookCovers.roundId) : eq(bookCovers.roundId, roundId));
    if (value === null) {
      const [o] = await tx.select({ id: bookCovers.id }).from(bookCovers).where(cuaO);
      // Cho nay von da trong thi khong co gi de don. Luat chi tu choi khi CHINH o dang bi don la o bia cuoi cung, nen
      // don mot cho trong tra "saved": bao "last-cover" o day la noi doi ve mot o khong he ton tai.
      if (o === undefined) return "saved";
      const [{ n }] = await tx.select({ n: count() }).from(bookCovers).where(eq(bookCovers.bookId, id));
      if (n <= 1) return "last-cover";
      await tx.delete(bookCovers).where(cuaO);
      return "saved";
    }
    if (value.coverMediaId !== null && !(await lockCover(tx, ownerId, id, value.coverMediaId))) return "invalid-cover";
    const da = await tx
      .update(bookCovers)
      .set({ cover: value.cover, coverMediaId: value.coverMediaId })
      .where(cuaO)
      .returning({ id: bookCovers.id });
    if (da.length === 0) {
      await tx.insert(bookCovers).values({ bookId: id, roundId, cover: value.cover, coverMediaId: value.coverMediaId });
    }
    if (value.coverMediaId !== null) await attachCover(tx, id, value.coverMediaId);
    return "saved";
  });
}

/**
 * Sua, dien hay don trong MOT o cua dong thoi gian nhac. Cung luat quyen va cung thu tu khoa voi setCoverEntry.
 * value null la bo han o; { youtubeId: null } la O GO NHAC, nghia la tu luot nay cuon khong con nhac nen. Nhac khong co
 * bat bien "luon con it nhat mot o": cuon khong o nhac nao la cuon khong co nhac nen, dung nhu hom nay.
 */
export async function setTrackEntry(
  db: AnyDb, ownerId: string, bookId: string, roundId: string | null,
  value: { youtubeId: string | null } | null,
): Promise<TimelineResult> {
  if (!isUuid(bookId)) return "not-found";
  if (roundId !== null && !isUuid(roundId)) return "not-found";
  if (value !== null && value.youtubeId !== null && !YOUTUBE_ID.test(value.youtubeId)) return "invalid";
  return db.transaction(async (tx): Promise<TimelineResult> => {
    // Nhu setCoverEntry: hai duong tra ve som deu nam truoc lenh ghi dau tien.
    const id = await lockOwnBook(tx, ownerId, bookId);
    if (!id) return "not-found";
    if (roundId !== null && !(await luotCuaSach(tx, id, roundId))) return "not-found";
    const cuaO = and(eq(bookTracks.bookId, id), roundId === null ? isNull(bookTracks.roundId) : eq(bookTracks.roundId, roundId));
    if (value === null) {
      await tx.delete(bookTracks).where(cuaO);
      return "saved";
    }
    const da = await tx.update(bookTracks).set({ youtubeId: value.youtubeId }).where(cuaO).returning({ id: bookTracks.id });
    if (da.length === 0) await tx.insert(bookTracks).values({ bookId: id, roundId, youtubeId: value.youtubeId });
    return "saved";
  });
}
