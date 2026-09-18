import { desc, eq } from "drizzle-orm";
import { accounts } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { derivePassword, verifyPassword, MAX_DERIVE_TRIES } from "./password";
import { decryptSecret } from "./crypto";

/**
 * Ham nay KHONG mo them canh cua nao. Ai co database cong SERVER_KEY thi von da
 * dung lai duoc mat khau: secretCipher giai ma duoc, va derivePassword la ham tat
 * dinh. Ham chi noi thang ra dieu da dung san, de man ket qua "Da xong" mo lai
 * duoc sau khi Server Action redirect di mat state cua no.
 */
export async function recoverCreatedSeat(
  db: AnyDb,
  input: { deviceId: string; serverKey: string },
): Promise<{ seat: 1 | 2; password: string } | null> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.createdByDevice, input.deviceId))
    .orderBy(desc(accounts.createdAt))
    .limit(1);
  if (!row) return null;

  const secret = decryptSecret(row.secretCipher, input.serverKey);

  for (let counter = 0; counter < MAX_DERIVE_TRIES; counter++) {
    const candidate = derivePassword(row.nickname, secret, input.serverKey, counter);
    // oxlint-disable-next-line no-await-in-loop -- do tuan tu counter tang dan cho toi khi khop mat khau da luu; phai giu dung thu tu, khong the goi song song.
    const match = await verifyPassword(row.passwordHash, candidate);
    if (match) return { seat: row.seat as 1 | 2, password: candidate };
  }

  throw new Error("khong dung lai duoc mat khau cua cho ngoi");
}
