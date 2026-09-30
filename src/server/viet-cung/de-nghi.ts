import { and, desc, eq, ne } from "drizzle-orm";
import { accounts, activity, books, deNghi } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { recordActivity } from "@/server/feed/record";
import { readableBy } from "@/server/library/quyen";
import type { BookMode } from "@/lib/book";
import type { FeedKind } from "@/lib/feed/types";
import { isUuid } from "@/lib/uuid";
import type { LoaiDeNghi } from "@/lib/viet-cung";

/*
 * De nghi cua sach viet cung "Hai Ngòi Bút" (dot nam 5c muc C, D). Moi cuon nhieu nhat mot de nghi dang cho (bang
 * de_nghi, khoa chinh book_id); nguoi nhan luon la tai khoan con lai. Moi thao tac ghi chay trong mot giao dich va khoa
 * dong books truoc (FOR UPDATE, cung thu tu khoa voi moi duong ghi cua cuon), roi moi doc va ghi de_nghi.
 * - moi-viet: chu cuon moi nguoi kia (o Sach moi, Sua sach); gui kem khi chu cuon chon "Viết cùng".
 * - xin-viet: nguoi kia xin viet vao cuon chia se cua chu (o man doc).
 * - xoa-sach: mot nguoi viet de nghi xoa sach viet cung; nguoi kia dong y thi cuon bi xoa han.
 * Hai nguoi cung muon mot dieu (moi khi dang co loi xin, xin khi dang duoc moi) thi la nhan loi luon.
 */

/** Mot de nghi gui TOI nguoi xem, cho dong o Ke sach. Khong mang id tai khoan. */
export type DeNghiCho = { bookId: string; title: string; loai: LoaiDeNghi; luc: Date };

/** De nghi dang cho cua mot cuon, nhin tu nguoi xem: loai va do chinh ho gui hay khong. null la khong co. */
export type TrangThaiDeNghi = { loai: LoaiDeNghi; cuaToi: boolean } | null;

/** Dong books da khoa FOR UPDATE, du cot cho moi luat cua de nghi. */
type SachKhoa = { id: string; ownerId: string; mode: BookMode; vietCungTu: Date | null };
type DongDeNghi = typeof deNghi.$inferSelect;

/** Loai dong Hoat dong da bao mot de nghi, de rut lai thi xoa dung dong do. */
const DONG_BAO: Record<LoaiDeNghi, FeedKind> = { "moi-viet": "moi-viet", "xin-viet": "xin-viet", "xoa-sach": "de-nghi-xoa" };

async function khoaSach(tx: AnyDb, bookId: string): Promise<SachKhoa | null> {
  const [row] = await tx
    .select({ id: books.id, ownerId: books.ownerId, mode: books.mode, vietCungTu: books.vietCungTu })
    .from(books)
    .where(eq(books.id, bookId))
    .for("update");
  return row ?? null;
}

/**
 * De nghi dang cho cua cuon, doc trong giao dich da khoa dong sach. updateBook dung de rut loi moi khi chu cuon bo chon
 * "Viết cùng", va rut loi xin khi chu cuon chuyen cuon sang rieng tu (5c muc C5, C6).
 */
export async function deNghiDangCho(tx: AnyDb, bookId: string): Promise<DongDeNghi | null> {
  const [row] = await tx.select().from(deNghi).where(eq(deNghi.bookId, bookId));
  return row ?? null;
}

/** Tai khoan con lai (web chi co hai), null khi chua ai tao cho ngoi thu hai. */
async function nguoiKiaCua(tx: AnyDb, accountId: string): Promise<string | null> {
  const [row] = await tx.select({ id: accounts.id }).from(accounts).where(ne(accounts.id, accountId)).limit(1);
  return row?.id ?? null;
}

/**
 * Nhan mot loi moi hay loi xin: cuon thanh sach viet cung tu now (luon chia se), de nghi bi xoa, ghi nhan-viet voi nguoi
 * nhan loi. Goi trong giao dich da khoa dong sach.
 */
async function nhanLoi(tx: AnyDb, sach: SachKhoa, cho: DongDeNghi, actorId: string, now: Date): Promise<void> {
  if (cho.loai === "xoa-sach") throw new Error("nhanLoi chi cho loi moi va loi xin");
  await tx.update(books).set({ vietCungTu: now, mode: "chia-se" }).where(eq(books.id, sach.id));
  await tx.delete(deNghi).where(eq(deNghi.bookId, sach.id));
  await recordActivity(tx, { kind: "nhan-viet", actorId, at: now, bookId: sach.id, mode: "chia-se", detail: { tu: cho.loai } });
}

/**
 * Rut mot de nghi dang cho: xoa de nghi va dong Hoat dong da bao no (cung nguoi gui, cung cuon, cung luc gui), nhu chua
 * tung gui. Goi trong giao dich da khoa dong sach.
 */
export async function rutDeNghi(tx: AnyDb, cho: DongDeNghi): Promise<void> {
  await tx.delete(deNghi).where(eq(deNghi.bookId, cho.bookId));
  await tx.delete(activity).where(and(
    eq(activity.kind, DONG_BAO[cho.loai]), eq(activity.actorId, cho.tuId), eq(activity.bookId, cho.bookId), eq(activity.at, cho.luc),
  ));
}

/**
 * Chu cuon moi nguoi kia viet cung (5c muc C1), trong giao dich cua createBook hay updateBook, SAU khi cuon da thanh chia
 * se. Chua co nguoi kia: "not-found", khong ghi gi. Nguoi kia dang xin: la dong y luon ("accepted"). Da co loi moi (hay de
 * nghi khac): "exists". Sach viet cung roi: "not-found".
 */
export async function ghiMoiViet(tx: AnyDb, sach: SachKhoa, now: Date): Promise<"sent" | "exists" | "accepted" | "not-found"> {
  if (sach.vietCungTu !== null || (await nguoiKiaCua(tx, sach.ownerId)) === null) return "not-found";
  const cho = await deNghiDangCho(tx, sach.id);
  if (cho?.loai === "xin-viet") {
    await nhanLoi(tx, sach, cho, sach.ownerId, now);
    return "accepted";
  }
  if (cho) return "exists";
  await tx.insert(deNghi).values({ bookId: sach.id, loai: "moi-viet", tuId: sach.ownerId, luc: now });
  await recordActivity(tx, { kind: "moi-viet", actorId: sach.ownerId, at: now, bookId: sach.id, mode: "chia-se" });
  return "sent";
}

export type KetQuaXin = "sent" | "exists" | "accepted" | "not-found";

/**
 * Nguoi kia xin viet cung mot cuon chia se, mot nguoi viet cua chu (5c muc C2). Cuon cua chinh minh, rieng tu, da la sach
 * viet cung hay khong ton tai: "not-found". Chu cuon dang moi minh: la nhan loi ("accepted"). Da co de nghi khac: "exists".
 */
export async function xinViet(db: AnyDb, viewerId: string, bookId: string, now: Date = new Date()): Promise<KetQuaXin> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<KetQuaXin> => {
    const sach = await khoaSach(tx, bookId);
    // Moi duong tra ve truoc lenh ghi dau tien chi moi doc.
    if (!sach || sach.ownerId === viewerId || sach.mode !== "chia-se" || sach.vietCungTu !== null) return "not-found";
    const cho = await deNghiDangCho(tx, sach.id);
    if (cho?.loai === "moi-viet") {
      await nhanLoi(tx, sach, cho, viewerId, now);
      return "accepted";
    }
    if (cho) return "exists";
    await tx.insert(deNghi).values({ bookId: sach.id, loai: "xin-viet", tuId: viewerId, luc: now });
    await recordActivity(tx, { kind: "xin-viet", actorId: viewerId, at: now, bookId: sach.id, mode: "chia-se" });
    return "sent";
  });
}

export type KetQuaTraLoi = "accepted" | "declined" | "deleted" | "not-found";

/**
 * Nguoi nhan tra loi de nghi dang cho cua mot cuon (5c muc C3, C4, D2). Nguoi gui khong tu tra loi duoc de nghi cua minh,
 * va nguoi xem phai doc duoc cuon; khong thi "not-found".
 * - loi moi, loi xin: dong y thi cuon thanh sach viet cung ("accepted"); khong thi xoa de nghi, ghi tu-choi ("declined").
 * - de nghi xoa: dong y thi xoa HAN cuon ("deleted"): khoa ngoai xoa theo moi trang, luot, nhap cua ca hai, media, niem
 *   phong, dau doc, de nghi va dong Hoat dong cua cuon; khong thi xoa de nghi, ghi tu-choi { viec: xoa-sach }.
 */
export async function traLoi(
  db: AnyDb, viewerId: string, bookId: string, dongY: boolean, now: Date = new Date(),
): Promise<KetQuaTraLoi> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<KetQuaTraLoi> => {
    const sach = await khoaSach(tx, bookId);
    if (!sach || (sach.ownerId !== viewerId && sach.mode !== "chia-se")) return "not-found";
    const cho = await deNghiDangCho(tx, sach.id);
    if (!cho || cho.tuId === viewerId) return "not-found";
    if (cho.loai === "xoa-sach" && sach.vietCungTu === null) return "not-found";
    if (dongY && cho.loai === "xoa-sach") {
      await tx.delete(books).where(eq(books.id, sach.id));
      return "deleted";
    }
    if (dongY) {
      await nhanLoi(tx, sach, cho, viewerId, now);
      return "accepted";
    }
    await tx.delete(deNghi).where(eq(deNghi.bookId, sach.id));
    await recordActivity(tx, { kind: "tu-choi", actorId: viewerId, at: now, bookId: sach.id, mode: sach.mode, detail: { viec: cho.loai } });
    return "declined";
  });
}

/** Nguoi gui rut de nghi cua chinh minh (5c muc C5, D1): xoa de nghi va dong da bao no. Khong co thi "not-found". */
export async function rutLai(db: AnyDb, viewerId: string, bookId: string): Promise<"withdrawn" | "not-found"> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<"withdrawn" | "not-found"> => {
    const sach = await khoaSach(tx, bookId);
    if (!sach) return "not-found";
    const cho = await deNghiDangCho(tx, sach.id);
    if (!cho || cho.tuId !== viewerId) return "not-found";
    await rutDeNghi(tx, cho);
    return "withdrawn";
  });
}

/**
 * Mot nguoi viet de nghi xoa sach viet cung (5c muc D1). Chi sach viet cung: sach mot nguoi viet va cuon khong ton tai la
 * "not-found". Da co de nghi (ke ca nguoi kia vua de nghi xoa: dong y thi bam "Đồng ý xóa", khong xoa lang le o day):
 * "exists".
 */
export async function deNghiXoa(
  db: AnyDb, viewerId: string, bookId: string, now: Date = new Date(),
): Promise<"sent" | "exists" | "not-found"> {
  if (!isUuid(bookId)) return "not-found";
  return db.transaction(async (tx): Promise<"sent" | "exists" | "not-found"> => {
    const sach = await khoaSach(tx, bookId);
    if (!sach || sach.vietCungTu === null) return "not-found";
    if (await deNghiDangCho(tx, sach.id)) return "exists";
    await tx.insert(deNghi).values({ bookId: sach.id, loai: "xoa-sach", tuId: viewerId, luc: now });
    await recordActivity(tx, { kind: "de-nghi-xoa", actorId: viewerId, at: now, bookId: sach.id, mode: sach.mode });
    return "sent";
  });
}

/** Moi de nghi GUI TOI nguoi xem (nguoi kia gui) tren cac cuon nguoi xem doc duoc, moi nhat truoc: cac dong o Ke sach. */
export async function deNghiToiToi(db: AnyDb, viewerId: string): Promise<DeNghiCho[]> {
  return db
    .select({ bookId: deNghi.bookId, title: books.title, loai: deNghi.loai, luc: deNghi.luc })
    .from(deNghi)
    .innerJoin(books, eq(books.id, deNghi.bookId))
    .where(and(ne(deNghi.tuId, viewerId), readableBy(viewerId)))
    .orderBy(desc(deNghi.luc), desc(deNghi.bookId));
}

/** De nghi dang cho cua mot cuon voi nguoi xem (man doc, Sua sach); cuon nguoi xem khong doc duoc thi null. */
export async function deNghiCuaSach(db: AnyDb, viewerId: string, bookId: string): Promise<TrangThaiDeNghi> {
  if (!isUuid(bookId)) return null;
  return readSnapshot(db, async (tx) => {
    const [row] = await tx
      .select({ loai: deNghi.loai, tuId: deNghi.tuId })
      .from(deNghi)
      .innerJoin(books, eq(books.id, deNghi.bookId))
      .where(and(eq(deNghi.bookId, bookId), readableBy(viewerId)));
    return row ? { loai: row.loai, cuaToi: row.tuId === viewerId } : null;
  });
}
