"use server";

import { db } from "@/server/db";
import { camXucChoToi, daXemCamXuc, thaCamXuc, type CamXucToi } from "@/server/cam-xuc/cam-xuc";
import { readMe } from "@/server/web/guard";
import { isUuid } from "@/lib/uuid";
import { CAN_DANG_NHAP, CHO_THA_TIEP, CHON_CAM_XUC } from "./messages";

/**
 * Nguoi dang dang nhap tha mot cam xuc cho nguoi kia. Id tai khoan lay tu phien; loai (chua tin) di thang toi thaCamXuc,
 * noi kiem. KHONG refresh(): linh vat dang dien, cot Hoat dong tu lam moi theo nhip cua Ke sach.
 */
export async function actionThaCamXuc(loai: unknown): Promise<{ ok: true } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await thaCamXuc(db, me.accountId, loai);
  if (r === "sent") return { ok: true };
  return { error: r === "som" ? CHO_THA_TIEP : CHON_CAM_XUC };
}

/** Hang cho cua nguoi dang nhap (linh vat hoi moi 15 giay); chua dang nhap thi rong. */
export async function actionCamXucChoToi(): Promise<CamXucToi[]> {
  const me = await readMe();
  if (!me) return [];
  return camXucChoToi(db, me.accountId);
}

/** Linh vat bat dau dien mot cam xuc: danh da xem (va cac cam xuc cu hon chua xem). Id la thi thoi. */
export async function actionDaXemCamXuc(id: unknown): Promise<void> {
  const me = await readMe();
  if (!me || !isUuid(id)) return;
  await daXemCamXuc(db, me.accountId, id);
}
