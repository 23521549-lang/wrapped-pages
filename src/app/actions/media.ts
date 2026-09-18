"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { getMediaStore } from "@/server/media/get-store";
import { saveUpload } from "@/server/media/save-upload";
import { readMe } from "@/server/web/guard";
import { sweepMediaAfterResponse } from "@/server/web/media-sweep";
import { parseUploadForm, UPLOAD_ERRORS } from "@/lib/media/upload";
import { CAN_DANG_NHAP, CHUA_BAT_KHO_MEDIA, KHONG_THAY_SACH } from "./messages";

/**
 * Tai mot tep media len: anh trong trang, ghi am, hoac bia. Trinh duyet da xu ly tep; may chu kiem lai tat ca bang
 * parseUploadForm (tran byte, mime va kich thuoc that doc tu byte, mime dung loai, thoi luong va song am). Kho tat thi
 * tra loi em, web van chay. Cuon phai la cua nguoi dang nhap va kho phai con cho (saveUpload). Ghi xong hen don rac sau
 * phan hoi. Tra id
 * kem kich thuoc that, hoac thoi luong va song am, de man viet chen khoi.
 */
export async function actionUploadMedia(formData: FormData) {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const store = getMediaStore();
  if (!store) return { error: CHUA_BAT_KHO_MEDIA };
  const parsed = await parseUploadForm(formData);
  if ("error" in parsed) return parsed;
  const { upload, body } = parsed;
  const id = randomUUID();
  const luu = await saveUpload(db, store, { id, ownerId: me.accountId, ...upload }, body);
  if (luu === "not-found") return { error: KHONG_THAY_SACH };
  if (luu === "full") return { error: UPLOAD_ERRORS.full };
  sweepMediaAfterResponse();
  return upload.kind === "ghi-am" ? { id, ms: upload.durationMs, peaks: upload.peaks } : { id, w: upload.width, h: upload.height };
}
