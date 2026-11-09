"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { KIND_CUA_MINH, chuDongChip, type KichHoatChuDong, type LoiChuDong } from "@/server/chip/chu-dong";
import { laDangChip } from "@/lib/cam-xuc";
import { lamSachTrang } from "@/server/chip/ngu-canh";
import {
  chaoChip, datCaiDatChip, docTroChuyen, hoiChip, trangThaiChip, xoaTroChuyen, type LoiChao, type TinChip, type TrangThaiChip,
} from "@/server/chip/tro-chuyen";
import type { FeedKind } from "@/lib/feed/types";
import { readMe } from "@/server/web/guard";
import { CAN_DANG_NHAP, CHO_CHIP_TRA_LOI, TIN_CHIP_HONG } from "./messages";

/**
 * Nguoi dang dang nhap noi voi Chip. Id tai khoan va biet danh lay tu phien; chu, ten trang va viec gan day (chua tin) di
 * thang toi hoiChip, noi kiem va lam sach. Tra cac tin moi de to tro chuyen noi vao, va luc Chip ngu toi neu co.
 */
export async function actionHoiChip(noiDung: unknown, trang: unknown, viec: unknown): Promise<{ tin: TinChip[]; nguDen: Date | null } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  const r = await hoiChip(db, me.accountId, me.nickname, me.partnerNickname, noiDung, trang, viec, new Date(), undefined, me.khoangLang);
  if (r.kieu === "invalid") return { error: TIN_CHIP_HONG };
  if (r.kieu === "som") return { error: CHO_CHIP_TRA_LOI };
  return { tin: r.tin, nguDen: r.nguDen };
}

/** Cuoc tro chuyen cua chinh nguoi dang nhap (60 tin gan nhat) va trang thai Chip, khi mo to tro chuyen. */
export async function actionDocChip(): Promise<{ tin: TinChip[]; trangThai: TrangThaiChip } | null> {
  const me = await readMe();
  if (!me) return null;
  const [tin, trangThai] = await Promise.all([docTroChuyen(db, me.accountId, 60, me.khoangLang, me.partnerNickname), trangThaiChip(db, me.accountId)]);
  return { tin, trangThai };
}

/** Chip chao khi mo trang (cau co san, khong goi AI); ghi lan cuoi thay web. */
export async function actionChaoChip(): Promise<LoiChao | null> {
  const me = await readMe();
  if (!me) return null;
  return chaoChip(db, me.accountId, me.nickname, me.partnerNickname, new Date(), me.khoangLang);
}

/**
 * Chip bat chuyen truoc theo viec vua xay ra (goi truc tiep sau mot hanh dong, hay quet luc mo trang). Dau vao tu
 * trinh duyet chi la goi y: loai truc tiep phai nam trong danh sach trigger, duong dan duoc lam sach nhu ten trang.
 * Tra null khi khong co loi (tat, dang ngu, cooldown, xac suat khong trung, Groq loi) - trinh duyet khong lam gi them.
 */
export async function actionChuDongChip(kichHoat: unknown): Promise<LoiChuDong | null> {
  const me = await readMe();
  if (!me) return null;
  if (typeof kichHoat !== "object" || kichHoat === null) return null;
  const kieu = (kichHoat as { kieu?: unknown }).kieu;
  let kich: KichHoatChuDong | null = null;
  if (kieu === "truc-tiep") {
    const kind = (kichHoat as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !(KIND_CUA_MINH as readonly string[]).includes(kind)) return null;
    kich = { kieu: "truc-tiep", kind: kind as FeedKind };
  } else if (kieu === "quet") {
    kich = { kieu: "quet", duongDan: lamSachTrang((kichHoat as { duongDan?: unknown }).duongDan) };
  }
  if (kich === null) return null;
  return chuDongChip(db, me.accountId, me.nickname, me.partnerNickname, kich, new Date(), undefined, me.khoangLang);
}

/** Cai dat Chip cua nguoi dang nhap (hien Chip, tu noi, dang nao); lam moi trang de moi cho thay ngay. */
export async function actionCaiDatChip(dat: { an?: unknown; tuNoi?: unknown; dang?: unknown }): Promise<void> {
  const me = await readMe();
  if (!me) return;
  await datCaiDatChip(db, me.accountId, {
    an: typeof dat.an === "boolean" ? dat.an : undefined,
    tuNoi: typeof dat.tuNoi === "boolean" ? dat.tuNoi : undefined,
    dang: laDangChip(dat.dang) ? dat.dang : undefined,
  });
  refresh();
}

/** Xoa het tin cua chinh nguoi dang nhap voi Chip. */
export async function actionXoaChip(): Promise<{ ok: true } | { error: string }> {
  const me = await readMe();
  if (!me) return { error: CAN_DANG_NHAP };
  await xoaTroChuyen(db, me.accountId);
  return { ok: true };
}
