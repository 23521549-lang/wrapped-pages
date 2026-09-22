"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { submitRoundReply, type RoundReplyResult } from "@/server/library/round-replies";
import { readMe } from "@/server/web/guard";
import { REPLY_MAX } from "@/lib/round-reply";
import { CAN_DANG_NHAP } from "./messages";

const LOI_HOI_DAP: Record<Exclude<RoundReplyResult, "sent">, string> = {
  exists: "Lượt này đã có lời hồi đáp rồi.",
  sealed: "Lượt này còn niêm phong, mở rồi hãy hồi đáp nhé.",
  "not-found": "Không tìm thấy lượt này.",
  invalid: `Lời hồi đáp cần có chữ, tối đa ${REPLY_MAX} ký tự.`,
};

/**
 * Nguoi dang dang nhap gui loi hoi dap cho mot luot. Id tai khoan lay tu phien, body (chua tin) di thang toi
 * submitRoundReply, noi kiem va chuan hoa. Gui xong thi refresh(): man doc ve lai tu may chu voi loi hoi dap vua luu.
 * exists va sealed cung refresh, vi trang thai that cua luot khac voi cai man dang ve (tab khac vua gui, hay man cu).
 */
export async function actionSubmitRoundReply(roundId: string, body: unknown): Promise<{ ok: true } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await submitRoundReply(db, me.accountId, roundId, body);
  if (r === "sent") {
    refresh();
    return { ok: true };
  }
  if (r === "exists" || r === "sealed") refresh();
  return { error: LOI_HOI_DAP[r] };
}
