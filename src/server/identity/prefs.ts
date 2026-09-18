import { eq } from "drizzle-orm";
import { accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/**
 * Lua chon rieng cua tung nguoi, luu o may chu: hai nguoi co the dung chung mot may, nen localStorage
 * khong nho dung theo nguoi. Nhan db lam tham so, khong import next hay server-only.
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
