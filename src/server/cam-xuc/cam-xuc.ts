import { and, desc, eq, gt, isNull, lte, ne, sql } from "drizzle-orm";
import { accounts, camXuc } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { recordActivity } from "@/server/feed/record";
import { CACH_THA_MS, laLoaiCamXuc, TOI_DA_HANG_CHO, type LoaiCamXuc } from "@/lib/cam-xuc";

/*
 * Kho cam xuc (dot nam 5d, spec B). Web chi co hai tai khoan, nen cam xuc "gui minh" la moi dong co tu_id khac nguoi
 * xem. Moi luat nam o day: tam loai, moc 10 giay giua hai lan tha, hang cho nhieu nhat ba cam xuc moi nhat, danh dau
 * da xem chi cho cam xuc nguoi kia gui minh.
 */

/** "sent": vua ghi cam xuc va dong Hoat dong. "invalid": loai khong thuoc tam loai. "som": nguoi nay vua tha chua du 10 giay. */
export type ThaKetQua = "sent" | "invalid" | "som";

/**
 * Tha mot cam xuc cho nguoi kia, trong mot giao dich: khoa dong tai khoan nguoi tha (FOR UPDATE) de hai lan bam cung luc
 * khong cung lot qua moc 10 giay, doc lan tha gan nhat, roi ghi cam_xuc va tha-cam-xuc cung luc now.
 */
export async function thaCamXuc(db: AnyDb, tuId: string, loai: unknown, now: Date = new Date()): Promise<ThaKetQua> {
  if (!laLoaiCamXuc(loai)) return "invalid";
  return db.transaction(async (tx): Promise<ThaKetQua> => {
    await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, tuId)).for("update");
    const [gan] = await tx
      .select({ id: camXuc.id })
      .from(camXuc)
      .where(and(eq(camXuc.tuId, tuId), gt(camXuc.luc, new Date(now.getTime() - CACH_THA_MS))))
      .limit(1);
    if (gan) return "som";
    await tx.insert(camXuc).values({ tuId, loai, luc: now });
    await recordActivity(tx, { kind: "tha-cam-xuc", actorId: tuId, at: now, detail: { cam: loai } });
    return "sent";
  });
}

/** Mot cam xuc nguoi kia gui ma nguoi xem chua thay, nhu linh vat dien. */
export type CamXucToi = { id: string; loai: LoaiCamXuc; luc: Date };

/**
 * Hang cho cua nguoi xem: cam xuc nguoi kia tha ma nguoi xem chua thay, nhieu nhat TOI_DA_HANG_CHO cai moi nhat, tra
 * theo thu tu cu toi moi (linh vat dien lan luot). Chi doc: cai cu hon ba cai do duoc danh da xem khi cai dau tien trong
 * hang duoc dien (daXemCamXuc).
 */
export async function camXucChoToi(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<CamXucToi[]> {
  const rows = await db
    .select({ id: camXuc.id, loai: camXuc.loai, luc: camXuc.luc })
    .from(camXuc)
    .where(and(ne(camXuc.tuId, viewerId), isNull(camXuc.daXemLuc), lte(camXuc.luc, now)))
    .orderBy(desc(camXuc.luc), desc(camXuc.id))
    .limit(TOI_DA_HANG_CHO);
  // oxlint-disable-next-line unicorn/no-array-reverse -- mang vua doc ra; toReversed can lib ES2023, du an dang o ES2022.
  return rows.reverse();
}

/**
 * Linh vat bat dau dien cam xuc id: danh da xem cam xuc do cung moi cam xuc nguoi kia gui truoc no ma chua xem (nguoi
 * vang lau khong phai xem ca trang; dong Hoat dong van con du). Chi cam xuc nguoi kia gui nguoi xem, chi khi chua xem.
 * Tra true khi chinh cam xuc id vua duoc danh; goi lai, id cua chinh minh, id la: false.
 */
export async function daXemCamXuc(db: AnyDb, viewerId: string, id: string, now: Date = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [cx] = await tx
      .select({ luc: camXuc.luc })
      .from(camXuc)
      .where(and(eq(camXuc.id, id), ne(camXuc.tuId, viewerId), isNull(camXuc.daXemLuc), lte(camXuc.luc, now)))
      .for("update");
    if (!cx) return false;
    await tx
      .update(camXuc)
      .set({ daXemLuc: now })
      .where(and(
        ne(camXuc.tuId, viewerId),
        isNull(camXuc.daXemLuc),
        sql`(${camXuc.luc}, ${camXuc.id}) <= (${cx.luc}, ${id}::uuid)`,
      ));
    return true;
  });
}
