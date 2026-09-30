"use server";

import { db } from "@/server/db";
import { guiThu, moThu, thuChuaMo, type GuiThuKetQua } from "@/server/thu/thu";
import { readMe } from "@/server/web/guard";
import { THU_TOI_DA } from "@/lib/thu";
import { momentLabel } from "@/lib/when";
import { CAN_DANG_NHAP } from "./messages";

const LOI_GUI: Record<Exclude<GuiThuKetQua, "sent">, string> = {
  exists: "Bạn đã gửi thư tháng này rồi.",
  open: "Tháng này chưa khép, ngày 1 tháng sau mới viết được thư.",
  invalid: `Thư cần có chữ, tối đa ${THU_TOI_DA} ký tự.`,
};

/**
 * Nguoi dang dang nhap gui thu thang cho nguoi kia. Id tai khoan lay tu phien; thang va chu (chua tin) di thang toi
 * guiThu, noi kiem va chuan hoa. KHONG refresh(): tang giay dang gap thanh phong bi va chim dang bay, trang tu lam moi
 * sau khi chim bay xong.
 */
export async function actionGuiThu(thang: unknown, noiDung: unknown): Promise<{ ok: true } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await guiThu(db, me.accountId, thang, noiDung);
  return r === "sent" ? { ok: true } : { error: LOI_GUI[r] };
}

/** La thu nguoi kia gui ma nguoi dang nhap chua mo (la thu troi hoi moi 20 giay); khong co hay chua dang nhap thi null. */
export async function actionThuChuaMo(): Promise<{ id: string; thang: string } | null> {
  const me = await readMe();
  if (!me) return null;
  return thuChuaMo(db, me.accountId);
}

/** Thu da mo, nhu cua so doc thu hien: gio gui da thanh chu theo gio Viet Nam. */
export type ThuDaMo = { thang: string; noiDung: string; gio: string; minhGui: boolean };

/** Mo thu nguoi kia gui nguoi dang nhap cua mot thang (ghi mo_luc lan dau), tra noi dung de cua so doc thu hien. */
export async function actionMoThu(thang: unknown): Promise<{ thu: ThuDaMo } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const now = new Date();
  const thu = await moThu(db, me.accountId, thang, now);
  if (!thu) return { error: "Không tìm thấy thư này." };
  return { thu: { thang: thu.thang, noiDung: thu.noiDung, gio: momentLabel(thu.guiLuc, now), minhGui: thu.minhGui } };
}
