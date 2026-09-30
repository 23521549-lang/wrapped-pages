import { eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { books } from "@/server/db/schema";

/**
 * Luat "viewer la NGUOI VIET cua cuon nay" viet bang SQL tren bang books (dot nam 5c): cuon cua chinh minh, hoac sach
 * viet cung (viet_cung_tu khac null; web chi co hai nguoi nen sach viet cung thi ca hai deu la nguoi viet). Moi duong ghi
 * cap cuon (nhap, dang luot, o bia, o nhac, doi chu de, tai media, kho anh bia) dung luat nay; nhung duong chi chu cuon
 * moi lam duoc (doi che do, moi viet cung, xoa sach chua viet) van loc theo owner_id.
 * Tach rieng khoi books.ts de media/cover.ts dung duoc ma khong tao vong nhap voi books.ts.
 */
export function writableBy(viewerId: string): SQL {
  return sql`(${eq(books.ownerId, viewerId)} or ${isNotNull(books.vietCungTu)})`;
}
