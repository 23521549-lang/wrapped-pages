import { accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { verifyPassword } from "./password";
import { beginAttempt, releaseAttempt, trustDevice, type LockReason } from "./rate-limit";

export type LoginResult =
  | { ok: true; accountId: string; seat: 1 | 2 }
  | { ok: false; reason: "sai-mat-khau" | LockReason | "nguoi-tao-khong-duoc-vao" };

export async function login(
  db: AnyDb,
  input: { password: string; deviceId: string },
): Promise<LoginResult> {
  // Giu cho truoc khi xet mat khau (xem beginAttempt): dong nay thanh lan sai neu mat khau sai.
  const attempt = await beginAttempt(db, input.deviceId);
  if ("lock" in attempt) return { ok: false, reason: attempt.lock };

  const rows = await db
    .select({
      id: accounts.id, seat: accounts.seat,
      passwordHash: accounts.passwordHash, createdByDevice: accounts.createdByDevice,
    })
    .from(accounts);

  for (const row of rows) {
    // oxlint-disable-next-line no-await-in-loop -- tim kiem tuan tu, dung ngay khi khop mat khau; chi toi da hai tai khoan (hai cho ngoi) nen khong dang gom Promise.all.
    const match = await verifyPassword(row.passwordHash, input.password);
    if (!match) continue;

    // Rao mem co chu y. Khong phai bao mat that.
    if (row.createdByDevice === input.deviceId) {
      // Go dung mat khau thi khong phai lan sai; cung khong lam may nguoi tao thanh tin cay.
      // oxlint-disable-next-line no-await-in-loop -- chi chay mot lan tren nhanh khop roi return ngay; nam trong vong lap chi vi cu phap.
      await releaseAttempt(db, attempt.id);
      return { ok: false, reason: "nguoi-tao-khong-duoc-vao" };
    }

    // Chi tha dong cua lan nay, KHONG xoa cac lan sai truoc cua trinh duyet: xoa het thi nguoi giu mot
    // trinh duyet tin cay do duoc mat khau nguoi kia mai mai bang vong "sai 4 lan, dang nhap dung
    // bang mat khau minh mot lan". De cac lan sai tu het han sau 15 phut; da co phien thi khong can.
    // oxlint-disable-next-line no-await-in-loop -- chi chay mot lan tren nhanh khop roi return ngay; nam trong vong lap chi vi cu phap.
    await releaseAttempt(db, attempt.id);
    // oxlint-disable-next-line no-await-in-loop -- nhu tren: nhanh khop chay mot lan roi return.
    await trustDevice(db, { deviceId: input.deviceId, accountId: row.id });
    return { ok: true, accountId: row.id, seat: row.seat as 1 | 2 };
  }

  // Dong da giu o beginAttempt nay la lan sai: de nguyen.
  return { ok: false, reason: "sai-mat-khau" };
}
