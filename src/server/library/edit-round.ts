import { and, asc, count, eq, gt, gte, sql } from "drizzle-orm";
import { books, pages, readMarks, rounds, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { normalizeSheets } from "@/lib/doc/continuation";
import { trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";
import { mediaIdsOf } from "@/lib/media/node";
import { roundAt } from "@/lib/round";
import { isUuid } from "@/lib/uuid";
import { bindMedia } from "@/server/media/access";
import { closedToPartner, sealsOfBook } from "@/server/seal/seals";
import { findOwnBook } from "./books";
import { lockOwnBook } from "./remove";
import { roundsOfBook, type RoundSpan } from "./rounds";

/** Mot dong cua muc Noi dung o man sua sach. sealed: niem phong cua luot con dong voi nguoi kia, chua sua duoc. */
export type RoundListItem = Pick<RoundSpan, "id" | "ordinal" | "first" | "last" | "publishedAt"> & { sealed: boolean };

/**
 * Mot luot nhu man sua can. Luot niem phong con dong chi co so thu tu va to dau: noi dung cua no khong bao gio duoc doc
 * ra, ke ca voi chu sach (hen gio chua toi gio khoa ca chu sach). version la moc phien ban (lan sua gan nhat, hay luc
 * dang) dang ISO, man sua gui lai nguyen van khi luu.
 */
export type RoundForEdit =
  | { kind: "sealed"; ordinal: number; first: number }
  | {
    kind: "ok"; id: string; ordinal: number; first: number; sheets: DocJson[]; version: string; bookTitle: string;
    publishedAt: Date; editedAt: Date | null;
  };

/** Ket qua luu mot luot. Thanh cong kem to dau cua luot, de action chuyen ve dung cho tren man doc. */
export type RoundEditResult =
  | { status: "saved" | "unchanged"; first: number }
  | "not-found" | "sealed" | "stale" | "invalid-media" | "invalid";

/** Khoang dem khi doi vi tri to: lon hon moi vi tri co that, de chi muc duy nhat (book_id, position) khong vuong giua chung. */
const DEM = 1_000_000;

function laSoThuTu(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}

/** Muc Noi dung cua man sua sach: moi luot cua cuon cua chinh ownerId, theo vi tri. null khi khong phai sach cua ownerId. */
export async function listRoundsForEdit(
  db: AnyDb, ownerId: string, bookId: string, now: Date = new Date(),
): Promise<RoundListItem[] | null> {
  if (!isUuid(bookId)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return null;
    const [luot, sealRows] = await Promise.all([roundsOfBook(tx, book.id), sealsOfBook(tx, book.id)]);
    const niemCua = new Map(sealRows.map((s) => [s.roundId, s]));
    return luot.map((r) => ({
      id: r.id, ordinal: r.ordinal, first: r.first, last: r.last, publishedAt: r.publishedAt, sealed: closedToPartner(niemCua.get(r.id), now),
    }));
  });
}

/**
 * Luot thu ordinal cua cuon, de chu sach sua. null khi bookId, ordinal sai dang, sach khong phai cua ownerId hay khong
 * co luot do: noi goi tra 404 nhu moi cho khac, khong lo su ton tai. Niem phong duoc xet truoc va cau doc noi dung chi
 * chay khi luot sua duoc, nen to hen gio chua toi gio khong bao gio lot noi dung ra, du chi vao bo nho may chu.
 */
export async function readRoundForEdit(
  db: AnyDb, ownerId: string, bookId: string, ordinal: number, now: Date = new Date(),
): Promise<RoundForEdit | null> {
  if (!isUuid(bookId) || !laSoThuTu(ordinal)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return null;
    const [luot, sealRows] = await Promise.all([roundsOfBook(tx, book.id), sealsOfBook(tx, book.id)]);
    const r = luot[ordinal - 1];
    if (!r) return null;
    if (closedToPartner(sealRows.find((s) => s.roundId === r.id), now)) return { kind: "sealed", ordinal, first: r.first };
    const rows = await tx.select({ content: pages.content }).from(pages).where(eq(pages.roundId, r.id)).orderBy(asc(pages.position));
    return {
      kind: "ok", id: r.id, ordinal, first: r.first, sheets: rows.map((x) => x.content),
      version: (r.editedAt ?? r.publishedAt).toISOString(), bookTitle: book.title, publishedAt: r.publishedAt, editedAt: r.editedAt,
    };
  });
}

/** Luot chua to position cua cuon cua chinh ownerId: so thu tu va to thu may cua luot. Cho duong dan cu mot to. */
export async function roundOfPosition(
  db: AnyDb, ownerId: string, bookId: string, position: number,
): Promise<{ ordinal: number; sheet: number } | null> {
  if (!isUuid(bookId) || !laSoThuTu(position)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findOwnBook(tx, ownerId, bookId);
    if (!book) return null;
    const r = roundAt(await roundsOfBook(tx, book.id), position);
    return r ? { ordinal: r.ordinal, sheet: position - r.first + 1 } : null;
  });
}

/** Cuon cua chinh ownerId co luot thu ordinal khong. Chi dem luot, khong doc noi dung: cong truoc khung giu cho cua man sua. */
export async function ownRoundExists(db: AnyDb, ownerId: string, bookId: string, ordinal: number): Promise<boolean> {
  if (!isUuid(bookId) || !laSoThuTu(ordinal)) return false;
  const [row] = await db
    .select({ n: count() })
    .from(rounds)
    .innerJoin(books, eq(books.id, rounds.bookId))
    .where(and(eq(books.id, bookId), eq(books.ownerId, ownerId)));
  return (row?.n ?? 0) >= ordinal;
}

/**
 * Chu sach thay cac to cua mot luot da dang bang cac to vua cat lai o man sua luot. Moi thu trong mot giao dich:
 * - khoa dong sach (FOR UPDATE, lockOwnBook), xep hang voi publishDraft, saveDraft, markRead (FOR SHARE) va lan sua
 *   khac cua cung cuon;
 * - luot phai thuoc cuon cua ownerId; niem phong cua luot con dong voi nguoi kia thi "sealed" (mo roi thi sua duoc; dong
 *   he lo cat luc dang giu nguyen vi no chi hien khi niem phong con dong);
 * - khoa lac quan: base phai trung moc phien ban (edited_at, hay published_at khi chua sua), so o muc mili giay vi Date
 *   chi giu toi do, con timestamptz giu micro giay;
 * - media qua bindMedia voi keep la moi id dang co tren cac to cua luot;
 * - cac to moi y het cac to cu (so bang phep bang cua jsonb, khong giu thu tu khoa) thi "unchanged", khong ghi gi; chi
 *   hoi cau nay khi so to khong doi, vi doi so to thi khong the y het;
 * - xoa cac to cu, doi cac to sau luot di delta qua khoang dem, chen cac to moi lien nhau tu to dau cu, cung round_id va
 *   published_at cua luot; khi so to doi: moc doc sau luot doi theo delta, moc doc trong luot kep ve to cuoi moi cua
 *   luot (so to khong doi thi phep doi nay la dong nhat nen khong chay);
 * - edited_at tinh ngay trong cau UPDATE: now (mac dinh gio database, test truyen moc co dinh) nhung khong som hon
 *   published_at, va sau moc phien ban cu it nhat 1 ms, nen CHECK rounds_edited_at khong vo va tab giu moc cu luon nhan
 *   "stale", khong ghi de im lang.
 * Niem phong va dong Hoat dong bam round_id nen khong phai doi gi. Khong ghi su kien Hoat dong nao.
 */
export async function editRound(
  db: AnyDb, ownerId: string, bookId: string, roundId: string, sheets: readonly DocJson[], base: Date, now?: Date,
): Promise<RoundEditResult> {
  if (!isUuid(bookId) || !isUuid(roundId)) return "not-found";
  // Moc khong doc duoc khong the trung moc phien ban nao, va toISOString cua no nem loi: chan ngay o day.
  if (Number.isNaN(base.getTime())) return "stale";
  const kept = normalizeSheets(trimTrailingBlank(sheets));
  if (kept.length === 0 || kept.length > MAX_SHEETS_PER_PUBLISH) return "invalid";
  return db.transaction(async (tx): Promise<RoundEditResult> => {
    const book = await lockOwnBook(tx, ownerId, bookId);
    // Drizzle COMMIT khi ham tra ve binh thuong. Moi duong tra ve truoc "saved" deu nam TRUOC lenh ghi dau tien
    // (tx.delete(pages) o duoi) va moi thu truoc chung chi la lenh doc. Khong them lenh ghi nao vao khoang nay.
    if (!book) return "not-found";
    const [round] = await tx
      .select({
        id: rounds.id,
        publishedAt: rounds.publishedAt,
        stale: sql<boolean>`date_trunc('milliseconds', coalesce(${rounds.editedAt}, ${rounds.publishedAt})) <> ${base.toISOString()}::timestamptz`
          .mapWith(Boolean),
      })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.bookId, book)));
    if (!round) return "not-found";
    const [seal] = await tx
      .select({ kind: seals.kind, opensAt: seals.opensAt, openedAt: seals.openedAt })
      .from(seals)
      .where(eq(seals.roundId, round.id));
    if (closedToPartner(seal, now ?? new Date())) return "sealed";
    if (round.stale) return "stale";
    const cu = await tx
      .select({ position: pages.position, content: pages.content })
      .from(pages)
      .where(eq(pages.roundId, round.id))
      .orderBy(asc(pages.position));
    if (cu.length === 0) return "not-found";
    const keep = new Set(cu.flatMap((p) => mediaIdsOf(p.content)));
    const bound = (await Promise.all(kept.map((sheet) => bindMedia(tx, ownerId, book, sheet, { keep })))).filter((d) => d !== null);
    if (bound.length !== kept.length) return "invalid-media";

    const first = cu[0].position;
    const last = cu.at(-1)?.position ?? first;
    const n = bound.length;
    const delta = n - cu.length;
    if (delta === 0) {
      // So bang phep bang cua jsonb: thu tu khoa trong tai lieu khong tinh la thay doi, nen mot lan mo ra dong lai khong
      // day moc phien ban len va khong lam tab kia thanh "stale". Chi hoi khi so to khong doi: hai mang khac do dai
      // khong the bang nhau, nen voi delta != 0 day la mot vong goi database chac chan vo nghia.
      const [{ giongHet }] = await tx
        .select({
          giongHet: sql<boolean>`jsonb_agg(${pages.content} order by ${pages.position}) = ${JSON.stringify(bound)}::jsonb`.mapWith(Boolean),
        })
        .from(pages)
        .where(eq(pages.roundId, round.id));
      if (giongHet) return { status: "unchanged", first };
    }

    await tx.delete(pages).where(eq(pages.roundId, round.id));
    if (delta !== 0) {
      // Buoc 1 day moi to sau luot len vung dem (> last + DEM); buoc 2 chi ha dung nhung to vua duoc day len, nen moc
      // loc la last + DEM chu khong phai DEM: khong dua vao gia thiet "khong cuon nao toi DEM to" o ngoai cau lenh.
      await tx.update(pages).set({ position: sql`${pages.position} + ${DEM}` }).where(and(eq(pages.bookId, book), gt(pages.position, last)));
      await tx.update(pages).set({ position: sql`${pages.position} - ${DEM - delta}` }).where(and(eq(pages.bookId, book), gt(pages.position, last + DEM)));
    }
    await tx.insert(pages).values(bound.map((content, i) => ({
      bookId: book, roundId: round.id, position: first + i, content, publishedAt: round.publishedAt,
    })));
    if (delta !== 0) {
      // delta = 0 thi phep bien doi nay la dong nhat (first + n - 1 = last): khong ghi vao bang cua nguoi kia cho vui.
      await tx
        .update(readMarks)
        .set({
          position: sql`case when ${readMarks.position} > ${last} then ${readMarks.position} + ${delta} else least(${readMarks.position}, ${first + n - 1}) end`,
        })
        .where(and(eq(readMarks.bookId, book), gte(readMarks.position, first)));
    }
    await tx
      .update(rounds)
      .set({
        editedAt: sql`greatest(${now ? sql`${now.toISOString()}::timestamptz` : sql`now()`}, ${rounds.publishedAt}, coalesce(${rounds.editedAt}, ${rounds.publishedAt}) + interval '1 millisecond')`,
      })
      .where(eq(rounds.id, round.id));
    return { status: "saved", first };
  });
}
