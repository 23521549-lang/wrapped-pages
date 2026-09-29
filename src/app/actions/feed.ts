"use server";

import { db } from "@/server/db";
import { markSeen } from "@/server/feed/seen";
import { readMe } from "@/server/web/guard";
import { CAN_DANG_NHAP } from "./messages";

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
