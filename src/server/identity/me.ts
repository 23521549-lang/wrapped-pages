import { accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/** Nguoi dang dung web, kem biet danh nguoi kia de giao dien noi "Linh doc duoc". */
export type Me = {
  accountId: string;
  seat: 1 | 2;
  nickname: string;
  partnerNickname: string;
  /**
   * Nguoi nay dang an hoat dong cua minh (accounts.hoat_dong_an). Di kem o day chu khong doc rieng: cau select duoi
   * von da cham bang accounts, va readMe duoc boc cache() nen moi request chi mot lan doc. Doc rieng la them mot vong
   * mang cho dung mot boolean, tren chinh man Ke sach ma tai lieu thiet ke (muc 17b) da ghi la co qua nhieu lan hoi.
   */
  anHoatDong: boolean;
};

/**
 * Doc ca hai cho ngoi trong mot truy van. Tra null khi chua du hai cho ngoi, hoac khi accountId khong
 * thuoc cho nao: moi man ben trong va moi action ghi deu can du hai nguoi.
 */
export async function loadMe(db: AnyDb, accountId: string): Promise<Me | null> {
  const rows = await db
    .select({ id: accounts.id, seat: accounts.seat, nickname: accounts.nickname, hoatDongAn: accounts.hoatDongAn })
    .from(accounts);
  if (rows.length !== 2) return null;
  const self = rows.find((r) => r.id === accountId);
  const partner = rows.find((r) => r.id !== accountId);
  if (!self || !partner) return null;
  return {
    accountId: self.id, seat: self.seat as 1 | 2, nickname: self.nickname, partnerNickname: partner.nickname,
    anHoatDong: self.hoatDongAn,
  };
}
