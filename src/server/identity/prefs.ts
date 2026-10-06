import { eq } from "drizzle-orm";
import { accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/**
 * Lua chon rieng cua tung nguoi, luu o may chu: hai nguoi co the dung chung mot may, nen localStorage
 * khong nho dung theo nguoi. Nhan db lam tham so, khong import next hay server-only.
 *
 * Hai lua chon o day: tat nhac nen (man doc sach co nhac), va an hoat dong (khung Hoat dong cua ca hai nguoi).
 */

/** Nguoi nay da tat nhac nen chua. Khong co tai khoan do thi coi nhu chua tat. */
export async function readMusicMuted(db: AnyDb, accountId: string): Promise<boolean> {
  const [row] = await db.select({ muted: accounts.musicMuted }).from(accounts).where(eq(accounts.id, accountId));
  return row?.muted ?? false;
}

/** Chi sua dong cua chinh accountId. */
export async function setMusicMuted(db: AnyDb, accountId: string, muted: boolean): Promise<void> {
  await db.update(accounts).set({ musicMuted: muted }).where(eq(accounts.id, accountId));
}

/**
 * Chi sua dong cua chinh accountId. Khong co ham doc di kem: co nay duoc doc o loadMe (src/server/identity/me.ts),
 * vi cau select o do von da cham bang accounts va duoc cache() theo request, nen doc o day la mot vong mang thua.
 */
export async function setAnHoatDong(db: AnyDb, accountId: string, an: boolean): Promise<void> {
  await db.update(accounts).set({ hoatDongAn: an }).where(eq(accounts.id, accountId));
}
