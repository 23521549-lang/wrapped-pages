"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/server/db";
import { renameRound } from "@/server/library/edit-round";
import { deNghiXoa, rutLai, traLoi, xinViet } from "@/server/viet-cung/de-nghi";
import { readMe } from "@/server/web/guard";
import { sweepMediaAfterResponse } from "@/server/web/media-sweep";
import { TEN_LUOT_TOI_DA } from "@/lib/viet-cung";
import { CAN_DANG_NHAP, KHONG_THAY_SACH } from "./messages";

/*
 * Server action cua sach viet cung "Hai Ngòi Bút" (dot nam 5c). Nguoi lam luon la nguoi dang dang nhap (readMe), khong
 * bao gio nhan tu trinh duyet; moi luat nam o src/server/viet-cung/de-nghi.ts va renameRound. Thanh cong thi lam moi
 * trang dang mo (Ke sach, man doc, Sua sach, Sua luot) chu khong chuyen trang, tru dong y xoa: cuon khong con nen ve Ke
 * sach.
 */

const DA_CO_DE_NGHI = "Cuốn này đang có một đề nghị chờ trả lời.";
const DE_NGHI_KHONG_CON = "Đề nghị này không còn nữa.";
const TEN_LUOT_SAI = `Tên lượt phải từ 1 tới ${TEN_LUOT_TOI_DA} ký tự.`;
const KHONG_THAY_LUOT = "Không tìm thấy lượt này.";

type Ket = { error: string } | undefined;

/** Xin viet cung cuon cua nguoi kia (o man doc). Dang duoc moi thi thanh nhan loi luon. */
export async function actionXinViet(bookId: string): Promise<Ket> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await xinViet(db, me.accountId, bookId);
  if (r === "exists") return { error: DA_CO_DE_NGHI };
  if (r === "not-found") return { error: KHONG_THAY_SACH };
  refresh();
}

/**
 * Tra loi de nghi gui toi minh: dongY true la nhan loi (loi moi, loi xin) hay dong y xoa; false la tu choi hay giu lai.
 * Dong y xoa thi cuon mat han: hen don rac media (tep cua cuon khong con dong media) roi ve Ke sach.
 */
export async function actionTraLoi(bookId: string, dongY: boolean): Promise<Ket> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if (typeof dongY !== "boolean") return { error: DE_NGHI_KHONG_CON };
  const r = await traLoi(db, me.accountId, bookId, dongY);
  if (r === "not-found") return { error: DE_NGHI_KHONG_CON };
  if (r === "deleted") {
    sweepMediaAfterResponse();
    redirect("/ke-sach");
  }
  refresh();
}

/** Rut de nghi cua chinh minh (loi xin o man doc, de nghi xoa o Sua sach). */
export async function actionRutLai(bookId: string): Promise<Ket> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  if ((await rutLai(db, me.accountId, bookId)) !== "withdrawn") return { error: DE_NGHI_KHONG_CON };
  refresh();
}

/** De nghi xoa sach viet cung (muc Xoa cuon cua Sua sach); nguoi kia dong y thi cuon moi bi xoa. */
export async function actionDeNghiXoa(bookId: string): Promise<Ket> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await deNghiXoa(db, me.accountId, bookId);
  if (r === "exists") return { error: DA_CO_DE_NGHI };
  if (r === "not-found") return { error: KHONG_THAY_SACH };
  refresh();
}

/** Doi ten mot luot cua chinh minh trong sach viet cung (man Sua luot). Trung ten cu thi khong ghi gi, van lam moi. */
export async function actionDoiTenLuot(bookId: string, roundId: string, ten: string): Promise<Ket> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await renameRound(db, me.accountId, bookId, roundId, ten);
  if (r === "invalid") return { error: TEN_LUOT_SAI };
  if (r === "not-found") return { error: KHONG_THAY_LUOT };
  refresh();
}
