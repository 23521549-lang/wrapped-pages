import { and, asc, eq, gt, gte, lte, or, sql } from "drizzle-orm";
import { pages, readingPositions, readSheets, rounds } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { hopLeChiThem } from "@/lib/doc/chi-them";
import { normalizeSheets } from "@/lib/doc/continuation";
import { joinSheets } from "@/lib/doc/join";
import { trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";
import { mediaIdsOf } from "@/lib/media/node";
import { roundAt } from "@/lib/round";
import { isUuid } from "@/lib/uuid";
import { parseTenLuot } from "@/lib/viet-cung";
import { bindMedia } from "@/server/media/access";
import { closedToPartner, sealsOfBook } from "@/server/seal/seals";
import { findWritableBook } from "./books";
import { lockWritableBook } from "./remove";
import { GOP_DOI_MS, ghiHayGop } from "@/server/feed/record";
import { roundsOfBook } from "./rounds";

/**
 * Mot luot nhu man sua can. Nguoi viet LUOT (rounds.tac_gia_id, 5c) sua duoc luot cua minh, ke ca luot niem phong con
 * dong voi nguoi kia (chu du an 28/09; luot niem phong luon cua chu cuon), nen noi dung luon duoc doc ra cho nguoi viet
 * luot; niemPhong de man sua bao mot dong. Luot cua nguoi kia khong bao gio toi day. version la moc phien ban (lan sua gan
 * nhat, hay luc dang) dang ISO, man sua gui lai nguyen van khi luu. ten va vietCung cho o "Tên lượt" cua sach viet cung.
 */
export type RoundForEdit = {
  id: string; ordinal: number; first: number; sheets: DocJson[]; version: string; bookTitle: string;
  publishedAt: Date; editedAt: Date | null; niemPhong: boolean; ten: string | null; vietCung: boolean;
};

/**
 * Ket qua luu mot luot. Thanh cong kem to dau cua luot, de action chuyen ve dung cho tren man doc. "deleted": ban sua
 * xoa chu, anh hay ghi am cu (luat chi-them, src/lib/doc/chi-them.ts).
 */
export type RoundEditResult =
  | { status: "saved" | "unchanged"; first: number }
  | "not-found" | "deleted" | "stale" | "invalid-media" | "invalid";

/** Khoang dem khi doi vi tri to: lon hon moi vi tri co that, de chi muc duy nhat (book_id, position) khong vuong giua chung. */
const DEM = 1_000_000;

function laSoThuTu(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}

/**
 * Luot thu ordinal cua cuon, de nguoi viet luot do sua. null khi bookId, ordinal sai dang, writerId khong phai nguoi viet
 * cua cuon, khong co luot do hay luot do cua nguoi kia (sach viet cung): noi goi tra 404 nhu moi cho khac, khong lo su ton
 * tai. Luot niem phong con dong van tra noi dung (chi nguoi viet luot toi duoc day), kem niemPhong.
 */
export async function readRoundForEdit(
  db: AnyDb, writerId: string, bookId: string, ordinal: number, now: Date = new Date(),
): Promise<RoundForEdit | null> {
  if (!isUuid(bookId) || !laSoThuTu(ordinal)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findWritableBook(tx, writerId, bookId);
    if (!book) return null;
    const [luot, sealRows] = await Promise.all([roundsOfBook(tx, book.id), sealsOfBook(tx, book.id)]);
    const r = luot[ordinal - 1];
    if (!r || r.authorId !== writerId) return null;
    const rows = await tx.select({ content: pages.content }).from(pages).where(eq(pages.roundId, r.id)).orderBy(asc(pages.position));
    return {
      id: r.id, ordinal, first: r.first, sheets: rows.map((x) => x.content),
      version: (r.editedAt ?? r.publishedAt).toISOString(), bookTitle: book.title, publishedAt: r.publishedAt, editedAt: r.editedAt,
      niemPhong: closedToPartner(sealRows.find((s) => s.roundId === r.id), now),
      ten: r.ten, vietCung: book.vietCungTu !== null,
    };
  });
}

/**
 * Luot chua to position cua mot cuon writerId la nguoi viet, khi luot do la cua chinh writerId: so thu tu va to thu may
 * cua luot. Cho duong dan cu mot to. To cua luot nguoi kia (sach viet cung) thi null.
 */
export async function roundOfPosition(
  db: AnyDb, writerId: string, bookId: string, position: number,
): Promise<{ ordinal: number; sheet: number } | null> {
  if (!isUuid(bookId) || !laSoThuTu(position)) return null;
  return readSnapshot(db, async (tx) => {
    const book = await findWritableBook(tx, writerId, bookId);
    if (!book) return null;
    const r = roundAt(await roundsOfBook(tx, book.id), position);
    return r && r.authorId === writerId ? { ordinal: r.ordinal, sheet: position - r.first + 1 } : null;
  });
}

/**
 * Luot thu ordinal cua cuon co that va la cua chinh writerId khong. Khong doc noi dung: cong truoc khung giu cho cua man
 * sua. Doc danh sach luot (roundsOfBook, noi duy nhat tinh so thu tu) vi sach viet cung phai biet nguoi viet cua dung
 * luot do chu khong chi dem.
 */
export async function ownRoundExists(db: AnyDb, writerId: string, bookId: string, ordinal: number): Promise<boolean> {
  if (!isUuid(bookId) || !laSoThuTu(ordinal)) return false;
  return readSnapshot(db, async (tx) => {
    const book = await findWritableBook(tx, writerId, bookId);
    if (!book) return false;
    return (await roundsOfBook(tx, book.id))[ordinal - 1]?.authorId === writerId;
  });
}

/**
 * Chu sach thay cac to cua mot luot da dang bang cac to vua cat lai o man sua luot. Moi thu trong mot giao dich:
 * - khoa dong sach (FOR UPDATE, lockOwnBook), xep hang voi publishDraft, saveDraft, markRead (FOR SHARE) va lan sua
 *   khac cua cung cuon;
 * - luot phai thuoc cuon cua ownerId; luot niem phong con dong van sua duoc (chu du an 28/09), niem phong va dong he lo
 *   cat luc dang giu nguyen;
 * - khoa lac quan: base phai trung moc phien ban (edited_at, hay published_at khi chua sua), so o muc mili giay vi Date
 *   chi giu toi do, con timestamptz giu micro giay;
 * - luat chi-them (hopLeChiThem tren hai tai lieu da noi): ban sua xoa chu, anh hay ghi am cu thi "deleted";
 * - media qua bindMedia voi keep la moi id dang co tren cac to cua luot;
 * - cac to moi y het cac to cu (so bang phep bang cua jsonb, khong giu thu tu khoa) thi "unchanged", khong ghi gi; chi
 *   hoi cau nay khi so to khong doi, vi doi so to thi khong the y het;
 * - xoa cac to cu, doi cac to sau luot di delta qua khoang dem, chen cac to moi lien nhau tu to dau cu, cung round_id va
 *   published_at cua luot; khi so to doi: cac to da xem sau luot doi theo delta, cac to da xem cua chinh luot chi mat
 *   khi to do khong con (so to khong doi thi phep doi nay la dong nhat nen khong chay);
 * - edited_at tinh ngay trong cau UPDATE: now (mac dinh gio database, test truyen moc co dinh) nhung khong som hon
 *   published_at, va sau moc phien ban cu it nhat 1 ms, nen CHECK rounds_edited_at khong vo va tab giu moc cu luon nhan
 *   "stale", khong ghi de im lang.
 * Niem phong va dong Hoat dong bam round_id nen khong phai doi gi. Luu thay doi thi ghi (hay gop) mot dong sua-trang.
 */
export async function editRound(
  db: AnyDb, writerId: string, bookId: string, roundId: string, sheets: readonly DocJson[], base: Date, now?: Date,
): Promise<RoundEditResult> {
  if (!isUuid(bookId) || !isUuid(roundId)) return "not-found";
  // Moc khong doc duoc khong the trung moc phien ban nao, va toISOString cua no nem loi: chan ngay o day.
  if (Number.isNaN(base.getTime())) return "stale";
  const kept = normalizeSheets(trimTrailingBlank(sheets));
  if (kept.length === 0 || kept.length > MAX_SHEETS_PER_PUBLISH) return "invalid";
  return db.transaction(async (tx): Promise<RoundEditResult> => {
    const sach = await lockWritableBook(tx, writerId, bookId);
    // Drizzle COMMIT khi ham tra ve binh thuong. Moi duong tra ve truoc "saved" deu nam TRUOC lenh ghi dau tien
    // (tx.delete(pages) o duoi) va moi thu truoc chung chi la lenh doc. Khong them lenh ghi nao vao khoang nay.
    if (!sach) return "not-found";
    const book = sach.id;
    const [round] = await tx
      .select({
        id: rounds.id,
        publishedAt: rounds.publishedAt,
        tacGiaId: rounds.tacGiaId,
        stale: sql<boolean>`date_trunc('milliseconds', coalesce(${rounds.editedAt}, ${rounds.publishedAt})) <> ${base.toISOString()}::timestamptz`
          .mapWith(Boolean),
      })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.bookId, book)));
    // Luot cua nguoi viet kia (sach viet cung) nhu luot khong ton tai: moi nguoi chi sua luot cua minh (5c muc B2).
    if (!round || round.tacGiaId !== writerId) return "not-found";
    if (round.stale) return "stale";
    const cu = await tx
      .select({ position: pages.position, content: pages.content })
      .from(pages)
      .where(eq(pages.roundId, round.id))
      .orderBy(asc(pages.position));
    if (cu.length === 0) return "not-found";
    if (!hopLeChiThem(joinSheets(cu.map((p) => p.content)), joinSheets(kept))) return "deleted";
    const keep = new Set(cu.flatMap((p) => mediaIdsOf(p.content)));
    const bound = (await Promise.all(kept.map((sheet) => bindMedia(tx, writerId, book, sheet, { keep })))).filter((d) => d !== null);
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
      // Luot ngan lai: cac to o cuoi luot khong con ton tai, nen dong "da xem" cua chung mat theo - de lai thi chung se
      // bam nham vao to cua luot sau khi cac to do lui ve.
      if (delta < 0) {
        await tx
          .delete(readSheets)
          .where(and(eq(readSheets.bookId, book), gte(readSheets.position, first + n), lte(readSheets.position, last)));
      }
      // Hai buoc qua vung dem y het cach doi cho cua pages o tren: khoa chinh (account_id, book_id, position) khong
      // vuong giua chung. Moc loc la last + DEM chu khong phai DEM, de khong dua vao gia thiet "khong cuon nao toi DEM to".
      await tx
        .update(readSheets)
        .set({ position: sql`${readSheets.position} + ${DEM}` })
        .where(and(eq(readSheets.bookId, book), gt(readSheets.position, last)));
      await tx
        .update(readSheets)
        .set({ position: sql`${readSheets.position} - ${DEM - delta}` })
        .where(and(eq(readSheets.bookId, book), gt(readSheets.position, last + DEM)));
      // Trang dang doc do (moi nguoi mot dong moi cuon, khong vuong khoa chinh): sau luot thi doi theo delta, nam o
      // phan luot bi cat thi kep ve to cuoi con lai cua luot. Khong cham updated_at: day la doi cho, khong phai lan doc.
      await tx
        .update(readingPositions)
        .set({ position: sql`case when ${readingPositions.position} > ${last} then ${readingPositions.position} + ${delta} else ${first + n - 1} end` })
        .where(and(
          eq(readingPositions.bookId, book),
          or(gt(readingPositions.position, last), gte(readingPositions.position, first + n)),
        ));
    }
    await tx
      .update(rounds)
      .set({
        editedAt: sql`greatest(${now ? sql`${now.toISOString()}::timestamptz` : sql`now()`}, ${rounds.publishedAt}, coalesce(${rounds.editedAt}, ${rounds.publishedAt}) + interval '1 millisecond')`,
      })
      .where(eq(rounds.id, round.id));
    await ghiHayGop(tx, {
      kind: "sua-trang", actorId: writerId, at: now ?? new Date(), bookId: book, roundId: round.id, mode: sach.mode,
    }, GOP_DOI_MS);
    return { status: "saved", first };
  });
}

/** Ket qua doi ten mot luot. */
export type RenameRoundResult = "saved" | "unchanged" | "not-found" | "invalid";

/**
 * Nguoi viet doi ten mot luot CUA CHINH MINH trong sach viet cung (5c muc H3). Ten qua parseTenLuot (gom khoang trang,
 * 1 toi 60 ky tu): khong dung duoc thi "invalid" truoc khi cham database. Trong mot giao dich: khoa dong sach (cung khoa
 * voi editRound, publishDraft), luot phai thuoc cuon va do writerId viet, cuon phai la sach viet cung (sach mot nguoi viet
 * khong co ten luot); trung ten dang co thi "unchanged", khong ghi gi; khong thi doi ten va ghi (hay gop) doi-ten-luot.
 * Khong cham noi dung, moc sua hay vi tri to cua luot.
 */
export async function renameRound(
  db: AnyDb, writerId: string, bookId: string, roundId: string, ten: unknown, now: Date = new Date(),
): Promise<RenameRoundResult> {
  const moi = parseTenLuot(ten);
  if (moi === null) return "invalid";
  if (!isUuid(bookId) || !isUuid(roundId)) return "not-found";
  return db.transaction(async (tx): Promise<RenameRoundResult> => {
    const sach = await lockWritableBook(tx, writerId, bookId);
    // Moi duong tra ve truoc lenh update deu chi moi doc.
    if (!sach || !sach.vietCung) return "not-found";
    const [luot] = await tx
      .select({ ten: rounds.ten, tacGiaId: rounds.tacGiaId })
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.bookId, sach.id)));
    if (!luot || luot.tacGiaId !== writerId) return "not-found";
    if (luot.ten === moi) return "unchanged";
    await tx.update(rounds).set({ ten: moi }).where(eq(rounds.id, roundId));
    await ghiHayGop(tx, {
      kind: "doi-ten-luot", actorId: writerId, at: now, bookId: sach.id, roundId, mode: sach.mode,
      detail: { truoc: luot.ten, sau: moi },
    }, GOP_DOI_MS);
    return "saved";
  });
}
