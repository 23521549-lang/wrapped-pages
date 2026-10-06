"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { markSeen } from "@/server/feed/seen";
import { phienBanKe } from "@/server/feed/version";
import { setAnHoatDong } from "@/server/identity/prefs";
import { readMe } from "@/server/web/guard";
import { CAN_DANG_NHAP, CHUA_LUU_HOAT_DONG } from "./messages";

/**
 * Trinh duyet bao nhung dong Hoat dong vua duoc xem (dau Moi tan tai cho). ids den tu trinh duyet nen chi giu chuoi;
 * markSeen tu bo id sai dang, gioi han so id va chi ghi dong nguoi dang nhap duoc thay. Khong refresh(): trang khong
 * can ve lai, dau Moi da tan tren man hinh; lan ve sau doc lai tu database.
 */
export async function actionSeenActivity(ids: unknown): Promise<{ error: string } | { ok: true }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (!Array.isArray(ids)) return { ok: true };
  await markSeen(db, me.accountId, ids.filter((x): x is string => typeof x === "string"));
  return { ok: true };
}

/**
 * Phien ban cua trang Ke sach cho nguoi dang dang nhap (TuCapNhat hoi moi 15 giay khi tab dang duoc xem). Chua dang
 * nhap thi chuoi rong: TuCapNhat thay khac phien ban va lam moi, trang tu chuyen ve dang nhap.
 */
export async function actionPhienBanKe(): Promise<string> {
  const me = await readMe();
  if (!me) return "";
  return phienBanKe(db, me.accountId);
}

/**
 * Luu lua chon an hoat dong cua nguoi dang dang nhap (06/10). `an` den tu trinh duyet nen phai la boolean that, nhu
 * actionSetMusicMuted. Chi sua dong cua chinh ho. Luu xong thi refresh(): Next bo payload cu, nen Ke sach ve lai voi
 * khung Hoat dong da loc va dong nhac "Hoat dong cua ban dang an" dung trang thai moi.
 *
 * Dau `an` cua TUNG DONG dong luc ghi (recordActivity), nen action nay chi doi hanh vi cua nhung dong ghi VE SAU; dong
 * da co khong bi sua.
 */
export async function actionAnHoatDong(an: boolean): Promise<{ error: string } | { ok: true }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (typeof an !== "boolean") return { error: CHUA_LUU_HOAT_DONG };
  await setAnHoatDong(db, me.accountId, an);
  refresh();
  return { ok: true };
}
