import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { sessions, accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

export const SESSION_DAYS = 90;
const LIFETIME_MS = SESSION_DAYS * 86_400_000;

/** Database chi giu ban bam; token that chi nam trong cookie cua nguoi dung. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createSession(db: AnyDb, accountId: string, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + LIFETIME_MS);
  await db.insert(sessions).values({ token: hashToken(token), accountId, expiresAt });
  return token;
}

/**
 * Phien truot: con hop le ma da qua nua han thi day han len them 90 ngay tinh tu bay gio.
 * Con hon nua han thi khong ghi gi, de khong phai ghi database o moi request.
 */
export async function readSession(db: AnyDb, token: string, now: Date = new Date()) {
  const hashed = hashToken(token);
  const [row] = await db
    .select({ accountId: sessions.accountId, seat: accounts.seat, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.token, hashed), gt(sessions.expiresAt, now)));
  if (!row) return null;

  let expiresAt = row.expiresAt;
  if (expiresAt.getTime() - now.getTime() < LIFETIME_MS / 2) {
    expiresAt = new Date(now.getTime() + LIFETIME_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.token, hashed));
  }
  return { accountId: row.accountId, seat: row.seat as 1 | 2, expiresAt };
}

export async function destroySession(db: AnyDb, token: string) {
  await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
}
