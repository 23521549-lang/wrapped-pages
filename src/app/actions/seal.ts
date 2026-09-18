"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { giftKey, submitReply, tryAnswer } from "@/server/seal/unlock";
import { readMe } from "@/server/web/guard";
import { checkReplyInput } from "@/lib/doc/validate";
import { SEAL_LIMITS } from "@/lib/seal/types";
import { CAN_DANG_NHAP } from "./messages";

const KHONG_THAY = "Không tìm thấy trang này.";

/**
 * Nguoi kia go dap an cho mot cau do. Dung thi mo trang va chuyen toi to dau kem tham so mo de chay nghi
 * thuc mo. Sai hoac dang cho thi lam moi man doc tu may chu de hien goi y vua mo va so
 * lan con lai. Moi luat nam o tryAnswer.
 */
export async function actionAnswer(sealId: string, formData: FormData) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await tryAnswer(db, me.accountId, sealId, String(formData.get("guess") ?? ""));
  if (!r) return { error: KHONG_THAY };
  if (r.status === "invalid") return { error: `Câu trả lời cần có chữ hoặc số, tối đa ${SEAL_LIMITS.guessMax} ký tự.` };
  if (r.status === "opened") redirect(`/sach/${r.bookId}?trang=${r.firstPosition}&mo=${sealId}`);
  refresh();
  return { error: r.status === "cooldown" ? "Chờ một lát rồi thử lại." : "Chưa đúng." };
}

/**
 * Chu sach tang chia khoa kem loi nhan. Nguoi doc khong co cu bam nao nen khong chay nghi thuc mo.
 * Trang da mo tu truoc (tab khac da tang, nguoi kia vua mo) thi cung chuyen toi trang, khong bao loi.
 */
export async function actionGiftKey(sealId: string, formData: FormData) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await giftKey(db, me.accountId, sealId, String(formData.get("note") ?? ""));
  if (!r) return { error: "Chưa tặng được chìa khóa." };
  redirect(`/sach/${r.bookId}?trang=${r.firstPosition}`);
}

/**
 * Nguoi kia gui trang tra loi cho mot trao doi. doc den tu trinh duyet nen qua checkReplyInput truoc khi
 * cham database: nhu actionSaveDraft, va trang co khoi media bi tu choi. Gui xong ca hai trang mo cung luc, roi chay nghi thuc mo. Trang da mo tu
 * truoc (da gui o tab khac, hay da duoc tang chia khoa) thi tra mot thong diep ro rang va KHONG chuyen trang: khong
 * ghi gi, khong nghi thuc, va ReplyEditor giu ban luu tam, noi them "Chu van con o day." qua keptText.
 */
export async function actionSubmitReply(sealId: string, doc: unknown) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const checked = checkReplyInput(doc);
  if (!checked.ok) {
    return { error: checked.reason === "too-long" ? "Trang trả lời dài quá một trang." : "Trang trả lời có nội dung không đọc được." };
  }
  const r = await submitReply(db, me.accountId, sealId, checked.doc);
  if (!r) return { error: "Chưa gửi được trang trả lời." };
  if (r.status === "already") return { error: "Trang này đã được mở rồi." };
  redirect(`/sach/${r.bookId}?trang=${r.firstPosition}&mo=${sealId}`);
}
