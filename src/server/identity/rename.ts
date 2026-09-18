import { hash as argonHash } from "@node-rs/argon2";
import { and, desc, eq } from "drizzle-orm";
import { accounts, secretHistory } from "@/server/db/schema";
import { recordActivity } from "@/server/feed/record";
import { derivePassword, verifyPassword, MAX_DERIVE_TRIES } from "./password";
import { encryptSecret, decryptSecret } from "./crypto";
import type { AnyDb } from "@/server/db/types";

/** Lay ca hai cho ngoi: nguoi dang thao tac va nguoi kia. Thieu ai thi nem loi, khong doan. */
async function actorAndPartner(db: AnyDb, actorAccountId: string) {
  const rows = await db.select().from(accounts);
  const actor = rows.find((r) => r.id === actorAccountId);
  if (!actor) throw new Error("khong tim thay nguoi dang thao tac");
  const partner = rows.find((r) => r.id !== actorAccountId);
  if (!partner) throw new Error("chua co nguoi kia");
  return { actor, partner };
}

export async function renamePartner(
  db: AnyDb,
  input: { actorAccountId: string; nickname: string; secret: string; serverKey: string },
  now: Date = new Date(),
): Promise<{ password: string }> {
  const { actor, partner } = await actorAndPartner(db, input.actorAccountId);

  // Mat khau moi cua nguoi kia khong duoc trung mat khau hien tai cua chinh nguoi doi.
  let password = "";
  for (let counter = 0; counter < MAX_DERIVE_TRIES; counter++) {
    const candidate = derivePassword(input.nickname, input.secret, input.serverKey, counter);
    // oxlint-disable-next-line no-await-in-loop -- do tuan tu counter tang dan cho toi khi mat khau moi khong trung mat khau hien tai; phai giu dung thu tu.
    const clash = await verifyPassword(actor.passwordHash, candidate);
    if (!clash) { password = candidate; break; }
  }
  if (!password) throw new Error("khong sinh duoc mat khau khong trung");

  const passwordHash = await argonHash(password);
  const secretCipher = encryptSecret(input.secret, input.serverKey);

  // Doi mat khau, ghi lich su va bao nguoi kia qua dong Hoat dong cung thanh hoac cung khong.
  // Mot moc now cho ca updatedAt lan su kien, nhu cac ham ghi su kien khac.
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ nickname: input.nickname, passwordHash, secretCipher, updatedAt: now })
      .where(eq(accounts.id, partner.id));
    await tx.insert(secretHistory).values({
      accountId: partner.id, secretCipher, nickname: input.nickname,
    });
    await recordActivity(tx, { kind: "doi-mat-khau", actorId: actor.id, subjectId: partner.id, at: now });
  });

  return { password };
}

export async function readSecretHistory(
  db: AnyDb,
  input: { actorAccountId: string; serverKey: string },
) {
  const { partner } = await actorAndPartner(db, input.actorAccountId);
  const rows = await db
    .select()
    .from(secretHistory)
    .where(eq(secretHistory.accountId, partner.id))
    .orderBy(desc(secretHistory.createdAt));

  return rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    secret: decryptSecret(r.secretCipher, input.serverKey),
    revealed: r.revealed === 1,
    createdAt: r.createdAt,
  }));
}

export async function revealSecret(
  db: AnyDb,
  input: { actorAccountId: string; historyId: string },
) {
  const { partner } = await actorAndPartner(db, input.actorAccountId);
  await db
    .update(secretHistory)
    .set({ revealed: 1 })
    .where(and(eq(secretHistory.id, input.historyId), eq(secretHistory.accountId, partner.id)));
}

/** Nguoi ngoi accountId chi doc duoc nhung ban da duoc nguoi kia bam Gui. */
export async function readRevealedSecrets(
  db: AnyDb,
  input: { accountId: string; serverKey: string },
) {
  const rows = await db
    .select()
    .from(secretHistory)
    .where(and(eq(secretHistory.accountId, input.accountId), eq(secretHistory.revealed, 1)))
    .orderBy(desc(secretHistory.createdAt));

  return rows.map((r) => ({ secret: decryptSecret(r.secretCipher, input.serverKey), createdAt: r.createdAt }));
}
