import { and, eq, gte, isNotNull, lt, or, sql } from "drizzle-orm";
import { activity, books, bookTracks, rounds } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { roundsOfBook } from "@/server/library/rounds";
import type { BookMode } from "@/lib/book";
import { docChiTietNhac } from "@/lib/feed/detail";
import { boTrung } from "@/lib/so-nhac";
import { khoangThang, thangCua, thangKhoa, type Thang } from "@/lib/tam-trang/lich";

/*
 * So nhac thang (dot nam 5b, spec B1, B2). "Bai dat trong thang" cua mot nguoi: moi bai ho dat cho sach cua minh trong
 * thang do theo gio Viet Nam, tu ba nguon: o mo dau (luc tao sach, books.created_at), o cua mot luot (rounds.published_at)
 * va bai doi sau o Sua sach (dong doi-nhac co sau.youtubeId, theo activity.at). O go nhac khong tinh; cung mot bai chi
 * mot lan, giu lan dau. Nguoi xem thay sach cua minh (ke ca rieng tu) va sach chia se cua nguoi kia, dung luat ke sach.
 */

/** Mot bai trong so, nhu danh sach phat hien. ordinal null la o mo dau (luc tao sach). */
export type BaiSo = { youtubeId: string; at: Date; bookId: string; bookTitle: string; ordinal: number | null; rieng: boolean };

type Tho = { youtubeId: string; at: Date; ownerId: string; bookId: string; title: string; mode: BookMode; roundId: string | null };

/** Moi bai nguoi xem thay duoc dat trong [from, to); from null la tu dau. Doc trong anh chup cua noi goi. */
async function baiTrong(tx: AnyDb, viewerId: string, from: Date | null, to: Date): Promise<Tho[]> {
  const thay = or(eq(books.ownerId, viewerId), eq(books.mode, "chia-se"));
  const lucO = sql`coalesce(${rounds.publishedAt}, ${books.createdAt})`;
  const [oNhac, doiNhac] = await Promise.all([
    tx
      .select({
        youtubeId: bookTracks.youtubeId, publishedAt: rounds.publishedAt, createdAt: books.createdAt, ownerId: books.ownerId,
        bookId: books.id, title: books.title, mode: books.mode, roundId: bookTracks.roundId,
      })
      .from(bookTracks)
      .innerJoin(books, eq(books.id, bookTracks.bookId))
      .leftJoin(rounds, eq(rounds.id, bookTracks.roundId))
      .where(and(thay, isNotNull(bookTracks.youtubeId), from === null ? undefined : gte(lucO, from), lt(lucO, to))),
    tx
      .select({
        detail: activity.detail, at: activity.at, ownerId: books.ownerId, bookId: books.id, title: books.title,
        mode: books.mode, roundId: activity.roundId,
      })
      .from(activity)
      .innerJoin(books, eq(books.id, activity.bookId))
      .where(and(eq(activity.kind, "doi-nhac"), thay, from === null ? undefined : gte(activity.at, from), lt(activity.at, to))),
  ]);
  return [
    ...oNhac.flatMap((r): Tho[] => (r.youtubeId === null ? [] : [{
      youtubeId: r.youtubeId, at: r.publishedAt ?? r.createdAt, ownerId: r.ownerId, bookId: r.bookId, title: r.title,
      mode: r.mode, roundId: r.roundId,
    }])),
    ...doiNhac.flatMap((r): Tho[] => {
      const id = docChiTietNhac(r.detail)?.sau?.youtubeId;
      return id ? [{ youtubeId: id, at: r.at, ownerId: r.ownerId, bookId: r.bookId, title: r.title, mode: r.mode, roundId: r.roundId }] : [];
    }),
  ];
}

/**
 * Bai dat trong thang t cua nguoi xem (minh) va cua nguoi kia (kia), moi danh sach theo luc dat, da bo trung. So thu tu
 * luot lay tu roundsOfBook (noi duy nhat tinh thu tu luot), tren cung anh chup.
 */
export async function baiCuaThang(db: AnyDb, viewerId: string, t: Thang): Promise<{ minh: BaiSo[]; kia: BaiSo[] }> {
  const { from, to } = khoangThang(t);
  return readSnapshot(db, async (tx) => {
    const tho = await baiTrong(tx, viewerId, from, to);
    const thuTu = new Map<string, number>();
    for (const bookId of new Set(tho.map((b) => b.bookId))) {
      for (const r of await roundsOfBook(tx, bookId)) thuTu.set(r.id, r.ordinal);
    }
    const ra = (ds: Tho[]) => boTrung(ds).map((b): BaiSo => ({
      youtubeId: b.youtubeId, at: b.at, bookId: b.bookId, bookTitle: b.title,
      ordinal: b.roundId === null ? null : (thuTu.get(b.roundId) ?? null), rieng: b.mode === "rieng-tu",
    }));
    return { minh: ra(tho.filter((b) => b.ownerId === viewerId)), kia: ra(tho.filter((b) => b.ownerId !== viewerId)) };
  });
}

/** Mot cuon so tren dai "Sổ nhạc theo tháng": thang, so bai (sau bo trung, moi nguoi rieng), so danh sach co bai. */
export type SoThang = { thang: string; soBai: number; soDanhSach: number };

/** Cac thang da khep (truoc thang cua now) co it nhat mot bai nguoi xem thay duoc, moi nhat truoc. */
export async function thangCoNhac(db: AnyDb, viewerId: string, now: Date): Promise<SoThang[]> {
  const tho = await readSnapshot(db, (tx) => baiTrong(tx, viewerId, null, khoangThang(thangCua(now)).from));
  const nhom = new Map<string, Map<string, Tho[]>>();
  for (const b of tho) {
    const k = thangKhoa(thangCua(b.at));
    const theoNguoi = nhom.get(k) ?? new Map<string, Tho[]>();
    nhom.set(k, theoNguoi);
    const ds = theoNguoi.get(b.ownerId);
    if (ds) ds.push(b);
    else theoNguoi.set(b.ownerId, [b]);
  }
  return [...nhom.entries()]
    .map(([thang, theoNguoi]) => {
      const ds = [...theoNguoi.values()].map((x) => boTrung(x).length);
      return { thang, soBai: ds.reduce((a, n) => a + n, 0), soDanhSach: ds.length };
    })
    // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
    .sort((x, y) => (x.thang < y.thang ? 1 : -1));
}
