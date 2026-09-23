"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { setMood, withdrawMood } from "@/server/mood/moods";
import { readMe } from "@/server/web/guard";
import { parseMoodInput } from "@/lib/tam-trang/input";
import { CAN_DANG_NHAP } from "./messages";

/**
 * Tha tam trang cua nguoi dang dang nhap. weather va note den tu trinh duyet nen qua parseMoodInput truoc khi cham
 * database; nguoi tha luon la readMe(), khong bao gio nhan accountId tu client. Xong thi refresh(): cham mau tren nut
 * va dong "Ban dang giu" cua ke sach ve lai tu may chu. Khong ghi dong Hoat dong.
 */
export async function actionSetMood(weather: unknown, note: unknown): Promise<{ error: string } | { ok: true }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const input = parseMoodInput(weather, note);
  if ("error" in input) return input;
  const moi = await setMood(db, me.accountId, input.weather, input.note);
  if (!moi) return { error: CAN_DANG_NHAP };
  refresh();
  return { ok: true };
}

/**
 * Thu lai tam trang dang giu cua chinh nguoi dang dang nhap. Khong doc gia tri tra ve cua withdrawMood: khong con
 * gi de thu (da het han, da bi thay boi mot lan tha khac, hay da thu roi o the khac) van la ok, vi nguoi dung thay
 * ket qua giong het nhau - khong con tam trang nao dang giu.
 */
export async function actionWithdrawMood(): Promise<{ error: string } | { ok: true }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  await withdrawMood(db, me.accountId);
  refresh();
  return { ok: true };
}
