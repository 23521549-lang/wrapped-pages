import { and, count, countDistinct, desc, eq, inArray, max, notExists, or, sql, type SQL } from "drizzle-orm";
import { accounts, books, deNghi, pages, readSheets, rounds, seals } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import type { BookMode, CoverKey } from "@/lib/book";
import { docExcerpt, markedExcerpt, NOT_BLANK_PATTERN } from "@/lib/doc/text";
import { SHELF_MARK } from "@/lib/doc/types";
import { dayKey } from "@/lib/when";
import { groupBy, isLockedFor, lockedForSql, sealsOfBooks } from "@/server/seal/seals";
import { newestCovers } from "./timeline";

export type ShelfBook = {
  id: string;
  title: string;
  mode: BookMode;
  cover: CoverKey;
  /** Bia tu tai len, null la tranh ve cover. Chi co tren cuon nguoi xem doc duoc, nen /m cho ho tai bia do. */
  coverMediaId: string | null;
  /** Nguoi xem la chu cuon (nguoi tao). Sach viet cung dung o ke rieng, xem vietCung. */
  mine: boolean;
  ownerNickname: string;
  pageCount: number;
  /** So to CUA NGUOI KIA nguoi xem chua thay (sach viet cung: to trong luot nguoi kia viet; to cua minh khong bao gio moi). */
  newCount: number;
  /**
   * Da la sach viet cung: ca hai VIET DUOC. Chi co co nay moi noi len quyen; ke Hai Ngòi Bút con nhan ca cuon dang cho
   * nhan loi (moiCho), ma o do nguoi duoc moi chua viet duoc gi.
   */
  vietCung: boolean;
  /** So luot da dang (the sach viet cung ghi "N lượt"). */
  roundCount: number;
  /**
   * Loi MOI viet cung dang cho tra loi tren cuon nay, nhin tu nguoi xem: ho moi ("toi-moi") hay ho duoc moi ("moi-toi");
   * null la khong co. Cuon co loi moi dung o ke Hai Ngòi Bút cua CA HAI ngay tu luc gui (chu du an 02/10). Loi XIN khong
   * tinh o day: cuon van dung o ke chu cuon toi khi duoc dong y.
   */
  moiCho: "toi-moi" | "moi-toi" | null;
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
export const HAS_TEXT = sql`exists (select 1 from jsonb_path_query(${pages.content}, '$.** ? (@.type == "text").text') as chu(v) where (chu.v #>> '{}') ~ ${NOT_BLANK_PATTERN})`;

/**
 * To dang xet (pages) thuoc luot do chinh nguoi xem viet (rounds.tac_gia_id, 5c): voi sach mot nguoi viet la moi to cua
 * cuon minh, voi sach viet cung chi cac luot cua minh. To cua minh khong bao gio la "trang moi" va khong co dong da xem.
 */
function cuaMinhSql(viewerId: string): SQL {
  return sql`exists (select 1 from ${rounds} where ${rounds.id} = ${pages.roundId} and ${rounds.tacGiaId} = ${viewerId})`;
}

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
 * MOI to mang dau doan tren ke trong cac luot dang xet, sap theo (cuon, vi tri). Dau co the nam tren nhieu to lien nhau
 * (bo xep trang cat ngang doan da chon) va to dau co the chi om duoc khoang trang - keo chon theo tu trong trinh duyet
 * thuong om ca dau cach dau doan - nen khong loc san mot to moi cuon o day: noi goi duyet theo thu tu va lay to dau
 * tien co chu mang dau khong rong. Phep do rong de nguyen o markedExcerpt, nguon that duy nhat, de SQL va JS khong the
 * lech nhau; mot luot chi co vai to mang dau nen tai ve het van re. Chi duoc goi voi cac luot DA MO voi nguoi xem.
 */
export function markedSheets(tx: AnyDb, roundIds: string[]) {
  return tx
    .select({ bookId: pages.bookId, roundId: pages.roundId, position: pages.position, content: pages.content })
    .from(pages)
    .where(and(inArray(pages.roundId, roundIds), CO_DAU_KE))
    .orderBy(pages.bookId, pages.position);
}

/**
 * Bat tham tat dinh cua ngay hom nay trong mot tap ung vien, moi cuon mot dong. To duoc chon la ung vien thu k theo vi
 * tri, k = md5("cuon:nguoi xem:ngay Viet Nam") lay 32 bit dau, du theo so ung vien cua chinh cuon do. Chay tron trong
 * SQL, khong tai moi to ve may chu ung dung. Cung ngay thi cung to, sang ngay thi doi; moi nguoi xem mot chuoi rieng.
 * Cuon khong co ung vien nao thi khong co dong. `loc` la dieu kien chon ung vien, chay tren pages da noi books, va bat
 * buoc phai co: thieu no thi truy van khong con menh de where nao, tuc lay moi to cua moi cuon khong loc niem phong.
 * Vi the kieu la SQL chu khong phai SQL | undefined; and(...) cua drizzle luon mang them | undefined nen noi goi phai
 * khang dinh bang dau ! - moi dieu kien truyen vao deu la SQL that.
 * theoLuot: moi LUOT mot dong thay vi moi cuon (khung sach lon luan phien): chia nhom va hat giong theo ma luot.
 */
export function drawOfDay(tx: AnyDb, loc: SQL, viewerId: string, now: Date, theoLuot = false) {
  const nhom = theoLuot ? pages.roundId : pages.bookId;
  const candidates = tx
    .select({
      bookId: pages.bookId,
      roundId: pages.roundId,
      position: pages.position,
      content: pages.content,
      k: sql<number>`row_number() over (partition by ${nhom} order by ${pages.position}) - 1`.as("k"),
      n: sql<number>`count(*) over (partition by ${nhom})`.as("n"),
    })
    .from(pages)
    .innerJoin(books, eq(books.id, pages.bookId))
    .where(loc)
    .as("ung_vien");
  const seed = sql`${theoLuot ? candidates.roundId : candidates.bookId}::text || ':' || ${viewerId}::text || ':' || ${dayKey(now)}::text`;
  return tx
    .select({ bookId: candidates.bookId, roundId: candidates.roundId, position: candidates.position, content: candidates.content })
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
 * khong nam trong niem phong con khoa voi nguoi xem, va voi to cua nguoi kia (luot nguoi kia viet) thi nguoi xem da tung
 * thay (co dong trong read_sheets): ke sach khong lo to chua doc cua cac luot cu, va bam vao khung khong bien cac to bi
 * nhay coc thanh da doc. Cuon khong co ung vien nao thi khong co dong (xem firstReadableSheets).
 */
function pickedSheets(tx: AnyDb, ids: string[], viewerId: string, now: Date) {
  return drawOfDay(tx, and(
    inArray(pages.bookId, ids),
    HAS_TEXT,
    notExists(lockedSealOf(tx, viewerId, now)),
    or(cuaMinhSql(viewerId), daXemSql(viewerId)),
  )!, viewerId, now);
}

/**
 * To bat tham cua ngay hom nay trong cac luot dang xet: ung vien la cac to CO CHU cua chinh luot do, khong bi moc doc
 * gioi han (luot moi nhat luon duoc phep hien). Chi duoc goi voi cac luot DA MO voi nguoi xem, nen khong can loc niem
 * phong lan nua. Dung chung phep bat tham voi pickedSheets qua drawOfDay, chi khac bo loc ung vien.
 */
function pickedInRounds(tx: AnyDb, roundIds: string[], viewerId: string, now: Date) {
  return drawOfDay(tx, and(inArray(pages.roundId, roundIds), HAS_TEXT)!, viewerId, now);
}

/**
 * To doc duoc dau tien cua moi cuon (vi tri nho nhat khong nam trong niem phong con khoa voi nguoi xem): nhanh cuoi
 * cung cua doanCua, dung khi luot moi nhat khong cho doan nao va ca hai phep bat tham deu khong co ung vien; cung la
 * vi tri mo man doc khi khung khong co doan trich. Moi to deu khoa thi khong co dong.
 * Xet theo TUNG TO (nguoi viet luot chua to, 5c), nen sach viet cung tron hai luat:
 * - To cua chinh nguoi xem: khong bi gioi han gi, uu tien to co chu roi moi toi vi tri (nhu truoc).
 * - To cua nguoi kia: uu tien cac to doc duoc MA NGUOI XEM CHUA TUNG THAY, lay to nho nhat trong so do - ke ca khi to
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
        when ${cuaMinhSql(viewerId)} then (case when not ${HAS_TEXT} then 1 else 0 end)
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
        id: books.id, title: books.title, mode: books.mode,
        ownerId: books.ownerId, createdAt: books.createdAt, ownerNickname: accounts.nickname,
        vietCung: sql<boolean>`${books.vietCungTu} is not null`.mapWith(Boolean),
        // Loi MOI dang cho tren cuon, nhin tu nguoi xem. de_nghi lay book_id lam khoa chinh nen nhieu nhat mot dong,
        // cau con tra ve dung mot gia tri hay khong gi (null). Loai 'xin-viet' va 'xoa-sach' khong tinh.
        moiCho: sql<"toi-moi" | "moi-toi" | null>`(select case when ${deNghi.tuId} = ${viewerId} then 'toi-moi' else 'moi-toi' end
          from ${deNghi} where ${deNghi.bookId} = ${books.id} and ${deNghi.loai} = 'moi-viet')`,
      })
      .from(books)
      .innerJoin(accounts, eq(accounts.id, books.ownerId))
      .where(or(eq(books.ownerId, viewerId), eq(books.mode, "chia-se")));
    if (visible.length === 0) return [];

    const ids = visible.map((b) => b.id);
    const [stats, ranges, picked, firsts, newest, covers] = await Promise.all([
      tx
        .select({
          bookId: pages.bookId, n: count(), last: max(pages.position), at: max(pages.publishedAt), luot: countDistinct(pages.roundId),
          // Dem to CUA NGUOI KIA chua co dong da xem cua nguoi nay (to cua minh khong bao gio moi, 5c). To niem phong cung
          // tinh la trang moi: markRead khong ghi chung.
          chuaXem: sql<number>`count(*) filter (where ${readSheets.position} is null and ${rounds.tacGiaId} <> ${viewerId})`.mapWith(Number),
        })
        .from(pages)
        .innerJoin(rounds, eq(rounds.id, pages.roundId))
        .leftJoin(readSheets, and(
          eq(readSheets.bookId, pages.bookId), eq(readSheets.position, pages.position), eq(readSheets.accountId, viewerId),
        ))
        .where(inArray(pages.bookId, ids))
        .groupBy(pages.bookId),
      sealsOfBooks(tx, ids),
      pickedSheets(tx, ids, viewerId, now),
      firstReadableSheets(tx, ids, viewerId, now),
      newestRounds(tx, ids),
      newestCovers(tx, ids),
    ]);

    const statOf = new Map(stats.map((s) => [s.bookId, s]));
    const rangesOf = groupBy(ranges, (r) => r.bookId);
    const pickedOf = new Map(picked.map((p) => [p.bookId, p]));
    const firstOf = new Map(firsts.map((p) => [p.bookId, p]));
    const roundOf = new Map(newest.map((r) => [r.bookId, r.roundId]));
    // Bia cua tung cuon: dung MOT cau lenh cho ca ke, chay chung anh chup voi cac cau tren; khong mot vong lap nao
    // theo tung cuon (ngan sach cua spec).
    const coverOf = new Map(covers.map((c) => [c.bookId, c]));

    // Cuon co luot moi nhat con niem phong voi nguoi xem. Tinh DUNG MOT LAN roi dung cho ca hai noi can no (chon luot
    // duoc phep doc noi dung o duoi, va chon doan cua tung khung): hai noi tu tinh lay theo hai duong thi chi can lech
    // nhau mot ly la khung lang le rot xuong duong lui.
    const khoaMoi = new Set(
      visible
        .filter((b) => {
          const rid = roundOf.get(b.id);
          return rid !== undefined
            && (rangesOf.get(b.id) ?? []).some((r) => r.roundId === rid && isLockedFor(r, b.ownerId === viewerId, now));
        })
        .map((b) => b.id),
    );
    // Chi doc noi dung cua luot moi nhat khi luot do da mo voi nguoi xem: luot con niem phong khong duoc lo mot chu nao,
    // ke ca vao bo nho may chu. Cung mot anh chup voi cac cau tren (readSnapshot), nen khong co khe nao de mot lan mo
    // khoa chen vao giua.
    const luotMo = visible.flatMap((b) => {
      const rid = roundOf.get(b.id);
      return rid === undefined || khoaMoi.has(b.id) ? [] : [rid];
    });
    const [marked, pickedNew] = await Promise.all([
      luotMo.length > 0 ? markedSheets(tx, luotMo) : [],
      luotMo.length > 0 ? pickedInRounds(tx, luotMo, viewerId, now) : [],
    ]);
    // Doan nguoi viet chon cua moi cuon: to mang dau co vi tri NHO NHAT ma chu mang dau khong rong. To chi om duoc
    // khoang trang khong duoc lam mat doan da chon nam o to sau no. marked da sap theo vi tri nen to dau tien duoc ghi
    // vao map chinh la to can lay.
    const markedOf = new Map<string, { position: number; excerpt: string }>();
    for (const p of marked) {
      const chu = markedExcerpt(p.content);
      if (chu !== null && !markedOf.has(p.bookId)) markedOf.set(p.bookId, { position: p.position, excerpt: chu });
    }
    const pickedNewOf = new Map(pickedNew.map((p) => [p.bookId, p]));

    /**
     * Doan cua khung sach theo dung thu tu cua spec: luot moi nhat con khoa thi khong co doan (noi goi dung dong he lo);
     * co to mang dau chon voi chu khong rong thi lay to do (markedOf); khong thi lay to bat tham cua ngay trong chinh
     * luot moi nhat; luot moi nhat khong co to nao co chu thi lui ve duong cu (bat tham trong cac to doc duoc va da xem,
     * roi to doc duoc dau tien co chu).
     */
    const doanCua = (bookId: string, khoa: boolean): { position: number; excerpt: string } | undefined => {
      if (khoa) return undefined;
      const dau = markedOf.get(bookId);
      if (dau !== undefined) return dau;
      const tham = pickedNewOf.get(bookId) ?? pickedOf.get(bookId);
      if (tham !== undefined) return { position: tham.position, excerpt: docExcerpt(tham.content) };
      const dauTien = firstOf.get(bookId);
      return dauTien?.hasText ? { position: dauTien.position, excerpt: docExcerpt(dauTien.content) } : undefined;
    };

    return visible
      .flatMap((b): ShelfBook[] => {
        const bia = coverOf.get(b.id);
        // Cuon khong con o bia nao thi khong ve duoc the: bat bien cua book_covers cam trang thai nay, nen day chi la
        // lop chan. Mot nhanh bia mac dinh se la nguon su that thu hai.
        if (bia === undefined) return [];
        const s = statOf.get(b.id);
        const last = s?.last ?? 0;
        const mine = b.ownerId === viewerId;
        const locked = (rangesOf.get(b.id) ?? []).filter((r) => isLockedFor(r, mine, now));
        const first = firstOf.get(b.id);
        const doan = doanCua(b.id, khoaMoi.has(b.id));
        // Khong co doan: giu cach cu - dong he lo cua niem phong phu to cuoi neu con khoa, khong thi khong co doan van;
        // man doc van mo o to doc duoc dau tien (moi to deu khoa thi to cuoi).
        const lastSeal = doan ? undefined : locked.find((r) => r.firstPosition <= last && last <= r.lastPosition);
        return [{
          id: b.id, title: b.title, mode: b.mode, cover: bia.cover, coverMediaId: bia.coverMediaId, mine, ownerNickname: b.ownerNickname,
          pageCount: s?.n ?? 0,
          // So to moi = so to cua nguoi kia nguoi xem chua thay bao gio; to niem phong cung tinh vi markRead khong ghi
          // chung. Sach mot nguoi viet cua chinh minh vi the luon 0.
          newCount: s?.chuaXem ?? 0,
          vietCung: b.vietCung, roundCount: s?.luot ?? 0, moiCho: b.moiCho,
          lockedCount: locked.reduce((n, r) => n + r.lastPosition - r.firstPosition + 1, 0),
          excerptPosition: doan?.position ?? first?.position ?? last,
          excerptLocked: lastSeal !== undefined,
          lastPublishedAt: s?.at ?? null,
          excerpt: doan?.excerpt ?? (lastSeal?.teaser || null),
          createdAt: b.createdAt,
        }];
      })
      // oxlint-disable-next-line unicorn/no-array-sort -- mang vua duoc .map() tao moi, khong ai khac giu tham chieu nen sap xep tai cho la an toan; doi sang toSorted() can nang tsconfig lib len ES2023, ngoai pham vi task nay.
      .sort(
        (x, y) =>
          (y.lastPublishedAt?.getTime() ?? 0) - (x.lastPublishedAt?.getTime() ?? 0) ||
          y.createdAt.getTime() - x.createdAt.getTime(),
      );
  });
}
