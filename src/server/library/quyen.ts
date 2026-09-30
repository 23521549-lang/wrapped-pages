import { eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { books } from "@/server/db/schema";

/**
 * Luat "viewer duoc doc cuon nay" viet bang SQL tren bang books: cua chinh minh, hoac cuon o che do chia se (web chi
 * co hai nguoi, nen cuon chia se khong phai cua minh thi la cua nguoi kia). Moi truy van can luat nay dung chung ham
 * nay de luat chi nam mot cho.
 */
export function readableBy(viewerId: string): SQL {
  return sql`(${eq(books.ownerId, viewerId)} or ${eq(books.mode, "chia-se")})`;
}

/**
 * Luat "viewer la NGUOI VIET cua cuon nay" viet bang SQL tren bang books (dot nam 5c): cuon cua chinh minh, hoac sach
 * viet cung (viet_cung_tu khac null; web chi co hai nguoi nen sach viet cung thi ca hai deu la nguoi viet). Moi duong ghi
 * cap cuon (nhap, dang luot, o bia, o nhac, doi chu de, tai media, kho anh bia) dung luat nay; nhung duong chi chu cuon
 * moi lam duoc (doi che do, moi viet cung, xoa sach chua viet) van loc theo owner_id.
 * Hai luat tach rieng khoi books.ts de media/cover.ts va viet-cung/de-nghi.ts dung duoc ma khong tao vong nhap voi
 * books.ts (books.ts nhap ca hai mo-dun do).
 */
export function writableBy(viewerId: string): SQL {
  return sql`(${eq(books.ownerId, viewerId)} or ${isNotNull(books.vietCungTu)})`;
}
