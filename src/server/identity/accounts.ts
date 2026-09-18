import { hash as argonHash } from "@node-rs/argon2";
import { accounts, secretHistory } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { derivePassword, verifyPassword, MAX_DERIVE_TRIES } from "./password";
import { encryptSecret } from "./crypto";

export type SeatState =
  | { phase: "trong" }
  | { phase: "mot-nguoi"; takenSeat: 1 | 2 }
  | { phase: "du-hai" };

/** Nem khi da du hai cho ngoi. Loi co ten rieng de tang web nhan ra ma khong phai so chuoi. */
export class SeatsFullError extends Error {
  constructor() {
    super("da du hai cho ngoi");
    this.name = "SeatsFullError";
  }
}

export async function readSeatState(db: AnyDb): Promise<SeatState> {
  const rows = await db.select({ seat: accounts.seat }).from(accounts);
  if (rows.length === 0) return { phase: "trong" };
  if (rows.length === 1) return { phase: "mot-nguoi", takenSeat: rows[0].seat as 1 | 2 };
  return { phase: "du-hai" };
}

export async function createSeat(
  db: AnyDb,
  input: { nickname: string; secret: string; deviceId: string; serverKey: string },
): Promise<{ seat: 1 | 2; password: string }> {
  const existing = await db
    .select({ seat: accounts.seat, passwordHash: accounts.passwordHash })
    .from(accounts);

  if (existing.length >= 2) throw new SeatsFullError();

  const seat = (existing.length === 0 ? 1 : 2) as 1 | 2;

  // Sinh mat khau, tang counter cho toi khi khong trung voi cho ngoi kia.
  let password = "";
  for (let counter = 0; counter < MAX_DERIVE_TRIES; counter++) {
    password = derivePassword(input.nickname, input.secret, input.serverKey, counter);
    // oxlint-disable-next-line no-await-in-loop -- da gom Promise.all cho ca hai cho ngoi hien co; vong lap counter ben ngoai phai tuan tu vi counter sau chi sinh khi counter truoc bi trung.
    const clash = await Promise.all(
      existing.map((r) => verifyPassword(r.passwordHash, password)),
    );
    if (!clash.some(Boolean)) break;
    password = "";
  }
  if (!password) throw new Error("khong sinh duoc mat khau khong trung");

  const passwordHash = await argonHash(password);
  const secretCipher = encryptSecret(input.secret, input.serverKey);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({ seat, nickname: input.nickname, passwordHash, secretCipher, createdByDevice: input.deviceId })
      .returning({ id: accounts.id });

    await tx.insert(secretHistory).values({
      accountId: row.id, secretCipher, nickname: input.nickname,
    });
  });

  return { seat, password };
}

/**
 * Ai duoc tao cho ngoi tiep theo.
 * Chua co ai: nguoi mo dau tao cho 1 cho nguoi kia.
 * Da co mot cho: CHI nguoi dang dang nhap o cho do moi tao duoc cho con lai.
 * Du hai: khong ai.
 */
export function mayCreateNextSeat(state: SeatState, actor: { seat: 1 | 2 } | null): boolean {
  if (state.phase === "trong") return true;
  if (state.phase === "mot-nguoi") return actor !== null && actor.seat === state.takenSeat;
  return false;
}
