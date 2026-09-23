import { and, count, desc, eq, inArray, max, notExists, or, sql, type SQL } from "drizzle-orm";
import { accounts, books, pages, readSheets, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { BookMode, CoverKey } from "@/lib/book";
import { docExcerpt, markedExcerpt, NOT_BLANK_PATTERN } from "@/lib/doc/text";
import { SHELF_MARK } from "@/lib/doc/types";
import { dayKey } from "@/lib/when";
import { groupBy, isLockedFor, lockedForSql, sealsOfBooks } from "@/server/seal/seals";

export type ShelfBook = {
  id: string;
  title: string;
  mode: BookMode;
  cover: CoverKey;
  /** Bia tu tai len, null la tranh ve cover. Chi co tren cuon nguoi xem doc duoc, nen /m cho ho tai bia do. */
  coverMediaId: string | null;
  mine: boolean;
  ownerNickname: string;
  pageCount: number;
  newCount: number;
  /** So to nam trong niem phong con khoa voi nguoi xem. */
  lockedCount: number;
  /**
   * To ke sach mo man doc: to mang doan trich cua hom nay (xem doanCua trong listShelf, doan luon den tu luot moi nhat);
   * khong co doan trich thi la to doc duoc dau tien, va moi to deu khoa thi la to cuoi. 0 khi chua co to.
   */
  excerptPosition: number;
  /** Khong co doan trich nao va to cuoi dang nam trong niem phong con khoa voi nguoi xem: excerpt chi la dong he lo. */
  excerptLocked: boolean;
  lastPublishedAt: Date | null;
  /**
   * Chu cua to excerptPosition khi to do co doan trich (doan nguoi viet chon, khong thi chu ca to); khi excerptLocked
   * thi chi la dong he lo (hoac null), khong bao gio la chu that; khong co doan trich thi null.
   */
  excerpt: string | null;
  createdAt: Date;
};

/** To co it nhat mot nut chu chua ky tu khong phai khoang trang (cung tap khoang trang voi docExcerpt). */
const HAS_TEXT = sql`exists (select 1 from jsonb_path_query(${pages.content}, '$.** ? (@.type == "text").text') as chu(v) where (chu.v #>> '{}') ~ ${NOT_BLANK_PATTERN})`;

/** Nguoi xem da tung thay to dang xet (pages) chua. Dung trong truy van co bang pages. */
function daXemSql(viewerId: string): SQL {
  return sql`exists (select 1 from ${readSheets} where ${readSheets.accountId} = ${viewerId}
    and ${readSheets.bookId} = ${pages.bookId} and ${readSheets.position} = ${pages.position})`;
}

/**
 * To mang dau doan tren ke. Duong dan jsonpath la mot hang van; ten dau di vao qua BIEN jsonpath $ten chu khong noi vao
 * chuoi duong dan, nen khong gia tri nao co the doi duoc hinh cua duong dan. Ten lay thang tu SHELF_MARK, nen so do
 * trinh soan thao va cau nay khong the lech ten nhau.
 */
const CO_DAU_KE = sql`jsonb_path_exists(${pages.content}, '$.**.marks[*].type ? (@ == $ten)', jsonb_build_object('ten', ${SHELF_MARK}::text))`;

/** Luot moi nhat cua moi cuon: luot chua to co vi tri lon nhat (cac luot noi tiep nhau nen do cung la luot dang sau cung). */
function newestRounds(tx: AnyDb, ids: string[]) {
  return tx
    .selectDistinctOn([pages.bookId], { bookId: pages.bookId, roundId: pages.roundId })
    .from(pages)
    .where(inArray(pages.bookId, ids))
    .orderBy(pages.bookId, desc(pages.position));
}

/**
 * To mang dau doan tren ke trong cac luot dang xet, moi cuon mot dong. Dau co the nam tren hai to lien nhau (bo xep
 * trang cat ngang doan da chon), khi do lay to co vi tri nho nhat. Chi duoc goi voi cac luot DA MO voi nguoi xem.
 */
function markedSheets(tx: AnyDb, roundIds: string[]) {
  return tx
    .selectDistinctOn([pages.bookId], { bookId: pages.bookId, position: pages.position, content: pages.content })
    .from(pages)
    .where(and(inArray(pages.roundId, roundIds), CO_DAU_KE))
    .orderBy(pages.bookId, pages.position);
}

/**
 * Bat tham tat dinh cua ngay hom nay trong mot tap ung vien, moi cuon mot dong. To duoc chon la ung vien thu k theo vi
 * tri, k = md5("cuon:nguoi xem:ngay Viet Nam") lay 32 bit dau, du theo so ung vien cua chinh cuon do. Chay tron trong
 * SQL, khong tai moi to ve may chu ung dung. Cung ngay thi cung to, sang ngay thi doi; moi nguoi xem mot chuoi rieng.
 * Cuon khong co ung vien nao thi khong co dong. `loc` la dieu kien chon ung vien, chay tren pages da noi books.
 */
function drawOfDay(tx: AnyDb, loc: SQL | undefined, viewerId: string, now: Date) {
  const candidates = tx
    .select({
      bookId: pages.bookId,
      position: pages.position,
      content: pages.content,
      k: sql<number>`row_number() over (partition by ${pages.bookId} order by ${pages.position}) - 1`.as("k"),
      n: sql<number>`count(*) over (partition by ${pages.bookId})`.as("n"),
    })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .where(loc)
    .as("ung_vien");
  const seed = sql`${candidates.bookId}::text || ':' || ${viewerId}::text || ':' || ${dayKey(now)}::text`;
  return tx
    .select({ bookId: candidates.bookId, position: candidates.position, content: candidates.content })
    .from(candidates)
    .where(sql`${candidates.k} = mod(('x' || substr(md5(${seed}), 1, 8))::bit(32)::bigint, ${candidates.n})`);
}

/**
 * Niem phong phu to dang xet (pages) va con khoa voi nguoi xem; dung trong truy van co join books. Niem phong cua mot
 * to dung la niem phong cua luot chua to, nen so luot la du, khong can khoang to.
 */
function lockedSealOf(tx: AnyDb, viewerId: string, now: Date) {
  return tx
    .select({ id: seals.id })
    .from(seals)
    .where(and(eq(seals.roundId, pages.roundId), lockedForSql(sql`${books.ownerId} = ${viewerId}`, now)));
}

/**
 * Duong lui cua spec muc 7, chi dung khi luot moi nhat khong co to nao co chu. Ung vien la cac to co chu cua ca cuon,
 * khong nam trong niem phong con khoa voi nguoi xem, va voi cuon cua nguoi kia thi nguoi xem da tung thay (co dong
 * trong read_sheets): ke sach khong lo to chua doc cua cac luot cu, va bam vao khung khong bien cac to bi nhay coc
 * thanh da doc. Cuon khong co ung vien nao thi khong co dong (xem firstReadableSheets).
 */
function pickedSheets(tx: AnyDb, ids: string[], viewerId: string, now: Date) {
  return drawOfDay(tx, and(
    inArray(pages.bookId, ids),
    HAS_TEXT,
    notExists(lockedSealOf(tx, viewerId, now)),
    or(eq(books.ownerId, viewerId), daXemSql(viewerId)),
  ), viewerId, now);
}

/**
 * To bat tham cua ngay hom nay trong cac luot dang xet: ung vien la cac to CO CHU cua chinh luot do, khong bi moc doc
 * gioi han (luot moi nhat luon duoc phep hien). Chi duoc goi voi cac luot DA MO voi nguoi xem, nen khong can loc niem
 * phong lan nua. Dung chung phep bat tham voi pickedSheets qua drawOfDay, chi khac bo loc ung vien.
 */
function pickedInRounds(tx: AnyDb, roundIds: string[], viewerId: string, now: Date) {
  return drawOfDay(tx, and(inArray(pages.roundId, roundIds), HAS_TEXT), viewerId, now);
}

/**
 * To doc duoc dau tien cua moi cuon (vi tri nho nhat khong nam trong niem phong con khoa voi nguoi xem): du phong khi
 * pickedSheets khong co ung vien. Moi to deu khoa thi khong co dong.
 * - Cuon cua chinh nguoi xem: khong bi gioi han gi, uu tien to co chu roi moi toi vi tri (nhu truoc).
 * - Cuon cua nguoi kia: uu tien cac to doc duoc MA NGUOI XEM CHUA TUNG THAY, lay to nho nhat trong so do - ke ca khi to
 *   do khong co chu; khong duoc bo qua no de tim to co chu o xa hon, vi bam vao khung phai mo dung cho nguoi doc dang
 *   dung lai, khong nhay coc. Chi khi moi to doc duoc deu da thay moi lui ve to doc duoc nho nhat (cung theo vi tri nho
 *   nhat, khong phan biet co chu). listShelf chi dung noi dung to nay lam doan trich khi hasText dung; to khong chu thi
 *   khong co doan trich (giu nguyen luat dong he lo niem phong khi ap dung).
 */
function firstReadableSheets(tx: AnyDb, ids: string[], viewerId: string, now: Date) {
  return tx
    .selectDistinctOn([pages.bookId], {
      bookId: pages.bookId, position: pages.position, content: pages.content, hasText: sql<boolean>`${HAS_TEXT}`,
    })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .where(and(inArray(pages.bookId, ids), notExists(lockedSealOf(tx, viewerId, now))))
    .orderBy(
      pages.bookId,
      sql`case
        when ${books.ownerId} = ${viewerId} then (case when not ${HAS_TEXT} then 1 else 0 end)
        else (case when ${daXemSql(viewerId)} then 1 else 0 end)
      end`,
      pages.position,
    );
}

/**
 * Ke sach cua viewer: moi cuon cua minh (ca rieng tu) va cac cuon chia se cua nguoi kia.
 * Cuon rieng tu cua nguoi kia khong bao gio xuat hien, ke ca ten.
 * Sap theo to dang gan nhat, cuon chua co to nao xep sau theo ngay tao.
 * Doan trich luon den tu LUOT DANG MOI NHAT cua cuon, uu tien doan nguoi viet da chon (xem doanCua ben duoi).
 * Moi cau lenh doc chung mot anh chup: to duoc chon, to cuoi, doan trich va niem phong phu chung luon den tu cung mot
 * trang thai, nen mot publishDraft hay mot lan mo khoa commit giua chung khong the dua chu that cua to khoa vao doan trich.
 */
export async function listShelf(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<ShelfBook[]> {
  return readSnapshot(db, async (tx) => {
    const visible = await tx
      .select({
        id: books.id, title: books.title, mode: books.mode, cover: books.cover, coverMediaId: books.coverMediaId,
        ownerId: books.ownerId, createdAt: books.createdAt, ownerNickname: accounts.nickname,
      })
      .from(books)
      .innerJoin(accounts, eq(accounts.id, books.ownerId))
      .where(or(eq(books.ownerId, viewerId), eq(books.mode, "chia-se")));
    if (visible.length === 0) return [];

    const ids = visible.map((b) => b.id);
    const [stats, ranges, picked, firsts, newest] = await Promise.all([
      tx
        .select({
          bookId: pages.bookId, n: count(), last: max(pages.position), at: max(pages.publishedAt),
          // Dem to chua co dong da xem cua nguoi nay. To niem phong cung tinh la trang moi: markRead khong ghi chung.
          chuaXem: sql<number>`count(*) filter (where ${readSheets.position} is null)`.mapWith(Number),
        })
        .from(pages)
        .leftJoin(readSheets, and(
          eq(readSheets.bookId, pages.bookId), eq(readSheets.position, pages.position), eq(readSheets.accountId, viewerId),
        ))
        .where(inArray(pages.bookId, ids))
        .groupBy(pages.bookId),
      sealsOfBooks(tx, ids),
      pickedSheets(tx, ids, viewerId, now),
      firstReadableSheets(tx, ids, viewerId, now),
      newestRounds(tx, ids),
    ]);

    const statOf = new Map(stats.map((s) => [s.bookId, s]));
    const rangesOf = groupBy(ranges, (r) => r.bookId);
    const pickedOf = new Map(picked.map((p) => [p.bookId, p]));
    const firstOf = new Map(firsts.map((p) => [p.bookId, p]));
    const roundOf = new Map(newest.map((r) => [r.bookId, r.roundId]));

    // Chi doc noi dung cua luot moi nhat khi luot do da mo voi nguoi xem: luot con niem phong khong duoc lo mot chu nao,
    // ke ca vao bo nho may chu. Cung mot anh chup voi cac cau tren (readSnapshot), nen khong co khe nao de mot lan mo
    // khoa chen vao giua.
    const luotMo = visible.flatMap((b) => {
      const rid = roundOf.get(b.id);
      if (rid === undefined) return [];
      const khoa = (rangesOf.get(b.id) ?? []).some((r) => r.roundId === rid && isLockedFor(r, b.ownerId === viewerId, now));
      return khoa ? [] : [rid];
    });
    const [marked, pickedNew] = await Promise.all([
      luotMo.length > 0 ? markedSheets(tx, luotMo) : [],
      luotMo.length > 0 ? pickedInRounds(tx, luotMo, viewerId, now) : [],
    ]);
    const markedOf = new Map(marked.map((p) => [p.bookId, p]));
    const pickedNewOf = new Map(pickedNew.map((p) => [p.bookId, p]));

    /**
     * Doan cua khung sach theo dung thu tu cua spec: luot moi nhat con khoa thi khong co doan (noi goi dung dong he lo);
     * co to mang dau chon va chu duoc danh dau khong rong thi lay to do; khong thi lay to bat tham cua ngay trong chinh
     * luot moi nhat; luot moi nhat khong co to nao co chu thi lui ve duong cu (bat tham trong cac to doc duoc va da xem,
     * roi to doc duoc dau tien co chu).
     */
    const doanCua = (bookId: string, khoaMoi: boolean): { position: number; excerpt: string } | undefined => {
      if (khoaMoi) return undefined;
      const dau = markedOf.get(bookId);
      const chuDau = dau === undefined ? null : markedExcerpt(dau.content);
      if (dau !== undefined && chuDau !== null) return { position: dau.position, excerpt: chuDau };
      const tham = pickedNewOf.get(bookId) ?? pickedOf.get(bookId);
      if (tham !== undefined) return { position: tham.position, excerpt: docExcerpt(tham.content) };
      const dauTien = firstOf.get(bookId);
      return dauTien?.hasText ? { position: dauTien.position, excerpt: docExcerpt(dauTien.content) } : undefined;
    };

    return visible
      .map((b): ShelfBook => {
        const s = statOf.get(b.id);
        const last = s?.last ?? 0;
        const mine = b.ownerId === viewerId;
        const locked = (rangesOf.get(b.id) ?? []).filter((r) => isLockedFor(r, mine, now));
        const first = firstOf.get(b.id);
        const luotMoi = roundOf.get(b.id);
        const doan = doanCua(b.id, luotMoi !== undefined && locked.some((r) => r.roundId === luotMoi));
        // Khong co doan: giu cach cu - dong he lo cua niem phong phu to cuoi neu con khoa, khong thi khong co doan van;
        // man doc van mo o to doc duoc dau tien (moi to deu khoa thi to cuoi).
        const lastSeal = doan ? undefined : locked.find((r) => r.firstPosition <= last && last <= r.lastPosition);
        return {
          id: b.id, title: b.title, mode: b.mode, cover: b.cover, coverMediaId: b.coverMediaId, mine, ownerNickname: b.ownerNickname,
          pageCount: s?.n ?? 0,
          // So to moi = so to nguoi xem chua thay bao gio; to niem phong cung tinh vi markRead khong ghi chung.
          newCount: mine ? 0 : (s?.chuaXem ?? 0),
          lockedCount: locked.reduce((n, r) => n + r.lastPosition - r.firstPosition + 1, 0),
          excerptPosition: doan?.position ?? first?.position ?? last,
          excerptLocked: lastSeal !== undefined,
          lastPublishedAt: s?.at ?? null,
          excerpt: doan?.excerpt ?? (lastSeal?.teaser || null),
          createdAt: b.createdAt,
        };
      })
      // oxlint-disable-next-line unicorn/no-array-sort -- mang vua duoc .map() tao moi, khong ai khac giu tham chieu nen sap xep tai cho la an toan; doi sang toSorted() can nang tsconfig lib len ES2023, ngoai pham vi task nay.
      .sort(
        (x, y) =>
          (y.lastPublishedAt?.getTime() ?? 0) - (x.lastPublishedAt?.getTime() ?? 0) ||
          y.createdAt.getTime() - x.createdAt.getTime(),
      );
  });
}
