import { eq, gt, sql } from "drizzle-orm";
import { activity, books, deNghi, moods, readSheets } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { readableBy } from "@/server/library/quyen";
import { thayDuoc } from "./list";

/**
 * Phien ban cua trang Ke sach voi viewerId (spec 5a muc G1): mot chuoi re de TuCapNhat so voi phien ban luc trang ve.
 * Doi khi co gi nguoi xem thay duoc vua doi: so dong va gio moi nhat cua cac dong Hoat dong nguoi xem thay (theo dung
 * thayDuoc: dong moi, dong vua gop, dong ghi san vua toi gio, tam trang thu lai lam dong cua no an), so to nguoi xem da
 * doc (doc them o the khac thi so trang moi tren ke doi), cac tam trang dang giu (tha, thu lai, het han), va cac de nghi
 * viet cung dang cho tren cuon nguoi xem doc duoc (5c: moi, xin, de nghi xoa vua gui, vua rut hay vua duoc tra loi). Khong doi
 * khi nguoi xem chi xem: activity_seen khong nam trong chuoi. Khong mang id tai khoan, khong mang noi dung nao.
 */
/** Mot dong cua cau SELECT gop trong phienBanKe, dang tho cua driver. */
type HangPhienBan = {
  hdN: string | number;
  hdMoi: string | Date | null;
  docN: string | number;
  giu: string[] | null;
  cho: { bookId: string; loai: string; luc: string }[] | null;
};

export async function phienBanKe(db: AnyDb, viewerId: string, now: Date = new Date(), khoangLang = false): Promise<string> {
  return readSnapshot(db, async (tx) => {
    // Bon phan gop trong MOT cau SELECT: moi phan la mot truy van con vo huong, giu y join va dieu kien nhu bon
    // SELECT rieng truoc day, chi khong con la 4 lan goi. Thu tu trong array_agg / json_agg giu y nhu orderBy
    // cu (moods.id, deNghi.bookId), nen chuoi phien ban tra ra khong doi. Moi 15 giay tren moi tab dang xem chi
    // con 1 SELECT cong 3 cau mo/dong anh chup, thay vi 4 SELECT.
    // Dung tx.execute thay vi tx.select: select cua drizzle khong chay duoc neu khong co FROM, ma khong co bang
    // nao chac chan co dong de lam FROM gia. Gia tri tho cua driver (count la chuoi hay so, max la Date hay
    // chuoi) duoc doi ve dang cu ngay duoi day, co bai ngan-sach-phien-ban-ke khoa lai.
    const dieuKienHd = thayDuoc(viewerId, now, khoangLang) ?? sql`true`;
    // execute khong dan kieu dong ve duoc: ep ve HangPhienBan o cho doc, hinh dang that
    // duoc bai ngan-sach-phien-ban-ke khoa lai bang chuoi phien ban day du.
    // Hinh dang tra ve KHAC NHAU theo driver: postgres-js (production) tra mang dong
    // truc tiep, PGlite (test) tra doi tuong {rows}. Doc thang `.rows[0]` thi chay
    // tren test nhung chet tren Postgres that, nen chuan hoa ve mang truoc khi doc.
    const kq = await tx.execute(sql`
      select
        (select count(*) from ${activity} left join ${books} on ${eq(books.id, activity.bookId)} left join ${moods} on ${eq(moods.id, activity.moodId)} where ${dieuKienHd}) as "hdN",
        (select max(${activity.at}) from ${activity} left join ${books} on ${eq(books.id, activity.bookId)} left join ${moods} on ${eq(moods.id, activity.moodId)} where ${dieuKienHd}) as "hdMoi",
        (select count(*) from ${readSheets} where ${eq(readSheets.accountId, viewerId)}) as "docN",
        (select coalesce(array_agg(${moods.id} order by ${moods.id}), '{}') from ${moods} where ${gt(moods.endsAt, now)} and ${eq(moods.withdrawn, false)}) as "giu",
        (select coalesce(json_agg(json_build_object('bookId', ${deNghi.bookId}, 'loai', ${deNghi.loai}, 'luc', ${deNghi.luc}) order by ${deNghi.bookId}), '[]') from ${deNghi} inner join ${books} on ${eq(books.id, deNghi.bookId)} where ${readableBy(viewerId)}) as "cho"
    `);
    const hang: unknown[] = Array.isArray(kq) ? kq : ((kq as { rows?: unknown[] }).rows ?? []);
    const row = hang[0] as HangPhienBan | undefined;
    if (!row) throw new Error("phienBanKe khong doc duoc phien ban");
    const moi = row.hdMoi === null ? null : row.hdMoi instanceof Date ? row.hdMoi : new Date(row.hdMoi);
    const deNghiCho = (row.cho ?? []).map((d) => `${d.bookId}:${d.loai}:${new Date(d.luc).getTime()}`).join(",");
    return [Number(row.hdN), moi?.getTime() ?? 0, Number(row.docN), (row.giu ?? []).join(","), deNghiCho].join("|");
  });
}
