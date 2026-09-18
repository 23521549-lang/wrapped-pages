"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { setMusicMuted } from "@/server/identity/prefs";
import { readMe } from "@/server/web/guard";
import { CAN_DANG_NHAP, CHUA_LUU_NHAC } from "./messages";

/**
 * Luu lua chon tat nhac nen cua nguoi dang dang nhap. muted den tu trinh duyet nen phai la boolean
 * that. Chi sua dong cua chinh ho. Luu xong thi refresh(): Next bo payload cu cua man doc, nen bam Back cua trinh
 * duyet khong dung lai tam bia va nhac nhu truoc luc tat. Ve lai khong nap lai trinh phat, vi MusicRoom dung yen
 * mot cho va chi doc gate mot lan luc gan.
 */
export async function actionSetMusicMuted(muted: boolean): Promise<{ error: string } | { ok: true }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (typeof muted !== "boolean") return { error: CHUA_LUU_NHAC };
  await setMusicMuted(db, me.accountId, muted);
  refresh();
  return { ok: true };
}
