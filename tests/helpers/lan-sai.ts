import { loginAttempts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { beginAttempt, releaseAttempt, type LockReason } from "@/server/identity/rate-limit";

/** Ghi thang mot lan sai vao bang (chi dung de dung canh trong test; ma chay that ghi qua beginAttempt). */
export async function ghiLanSai(db: AnyDb, deviceId: string, at: Date = new Date()) {
  await db.insert(loginAttempts).values({ deviceId, at });
}

/**
 * Hoi trinh duyet nay luc nay co bi khoa khong, qua dung duong cua ma that: beginAttempt roi tha
 * dong vua giu neu khong bi khoa. Ket qua giong het mot lan dang nhap bat dau luc `now`.
 */
export async function trangThaiKhoa(db: AnyDb, deviceId: string, now: Date = new Date()): Promise<LockReason | null> {
  const lan = await beginAttempt(db, deviceId, now);
  if ("lock" in lan) return lan.lock;
  await releaseAttempt(db, lan.id);
  return null;
}
