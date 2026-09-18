import { and, asc, eq } from "drizzle-orm";
import { books, sealAttempts, sealReplies, seals } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { recordActivity } from "@/server/feed/record";
import type { DocJson } from "@/lib/doc/types";
import { docCharCount, hasMediaBlock, isBlankDoc } from "@/lib/doc/text";
import { matchesAnswer, normalizeAnswer } from "@/lib/seal/answer";
import { attemptState, type AttemptState } from "@/lib/seal/attempts";
import { SEAL_LIMITS } from "@/lib/seal/types";
import { isStorable } from "@/lib/storable";
import { isUuid } from "@/lib/uuid";

export type Opened = { bookId: string; firstPosition: number };

/**
 * Ket qua cua giftKey va submitReply. "opened": lan goi nay vua mo trang. "already": trang da mo tu truoc (tab
 * khac, hay nguoi kia vua mo), lan goi nay khong ghi gi; action van chuyen toi trang, khong kem nghi thuc.
 */
export type OpenResult = { status: "opened" | "already" } & Opened;

export type AnswerResult =
  | ({ status: "opened" } & Opened)
  | { status: "wrong"; state: AttemptState }
  | { status: "cooldown"; state: AttemptState }
  | { status: "invalid" };

/** Khoa dong niem phong kem chu sach va che do cua cuon, trong giao dich dang chay. */
async function lockSeal(tx: AnyDb, sealId: string) {
  const [row] = await tx
    .select({ seal: seals, ownerId: books.ownerId, mode: books.mode })
    .from(seals)
    .innerJoin(books, eq(books.id, seals.bookId))
    .where(eq(seals.id, sealId))
    .for("update");
  return row;
}

type LockedSeal = NonNullable<Awaited<ReturnType<typeof lockSeal>>>;

/** Phan chung cua moi su kien mo khoa: niem phong, cuon, khoang to, che do cuon va luc ghi. */
function sealEvent(row: LockedSeal, at: Date) {
  const { id, bookId, firstPosition, lastPosition } = row.seal;
  return { sealId: id, bookId, firstPosition, lastPosition, mode: row.mode, at };
}

/**
 * Nguoi kia go dap an cho mot cau do. null khi niem phong nay khong ton tai voi nguoi nay: ma rac, khong
 * phai cau do, sach rieng tu, hay chinh chu sach. Dang trong khoang cho thi khong ghi lan thu nao, ke ca
 * dap an dung, de ha nhiet khong bi lach bang cach go tiep.
 */
export async function tryAnswer(
  db: AnyDb, viewerId: string, sealId: string, guess: string, now: Date = new Date(),
): Promise<AnswerResult | null> {
  if (!isUuid(sealId)) return null;
  const g = guess.trim();
  if (g.length === 0 || g.length > SEAL_LIMITS.guessMax || !isStorable(g) || normalizeAnswer(g) === "") return { status: "invalid" };

  return db.transaction(async (tx): Promise<AnswerResult | null> => {
    const row = await lockSeal(tx, sealId);
    if (!row || row.seal.kind !== "cau-do" || row.mode !== "chia-se" || row.ownerId === viewerId) return null;
    const opened: Opened = { bookId: row.seal.bookId, firstPosition: row.seal.firstPosition };
    if (row.seal.openedAt !== null) return { status: "opened", ...opened };

    const fails = (
      await tx
        .select({ at: sealAttempts.at })
        .from(sealAttempts)
        .where(and(eq(sealAttempts.sealId, sealId), eq(sealAttempts.accountId, viewerId), eq(sealAttempts.correct, false)))
        .orderBy(asc(sealAttempts.at))
    ).map((a) => a.at);
    const before = attemptState(fails, row.seal.hints.length, now);
    if (before.lockedUntil) return { status: "cooldown", state: before };

    const correct = matchesAnswer(g, row.seal.answers);
    await tx.insert(sealAttempts).values({ sealId, accountId: viewerId, guess: g, correct, at: now });
    if (correct) {
      await tx.update(seals).set({ openedAt: now }).where(eq(seals.id, sealId));
      await recordActivity(tx, { ...sealEvent(row, now), kind: "mo-trang", actorId: viewerId });
      return { status: "opened", ...opened };
    }
    await recordActivity(tx, { ...sealEvent(row, now), kind: "thu-sai", actorId: viewerId });
    // "now" o day chinh la gia tri vua ghi vao lan thu nay, nen luon dong nhat voi DB, khong phai loi bypass.
    return { status: "wrong", state: attemptState([...fails, now], row.seal.hints.length, now) };
  });
}

/**
 * Chu sach tang chia khoa: mo cau do hoac trao doi cho nguoi kia, kem mot loi nhan. Khong dung cho hen
 * gio. Loi nhan rong thi luu null. Da mo tu truoc thi tra "already" ma khong ghi loi nhan.
 */
export async function giftKey(
  db: AnyDb, ownerId: string, sealId: string, note: string, now: Date = new Date(),
): Promise<OpenResult | null> {
  if (!isUuid(sealId)) return null;
  const n = note.trim();
  if (n.length > SEAL_LIMITS.giftNoteMax || !isStorable(n)) return null;

  return db.transaction(async (tx): Promise<OpenResult | null> => {
    const row = await lockSeal(tx, sealId);
    if (!row || row.ownerId !== ownerId || row.mode !== "chia-se" || row.seal.kind === "hen-gio") return null;
    const opened: Opened = { bookId: row.seal.bookId, firstPosition: row.seal.firstPosition };
    if (row.seal.openedAt !== null) return { status: "already", ...opened };
    await tx.update(seals).set({ openedAt: now, giftNote: n === "" ? null : n }).where(eq(seals.id, sealId));
    await recordActivity(tx, { ...sealEvent(row, now), kind: "tang-khoa", actorId: ownerId });
    return { status: "opened", ...opened };
  });
}

/**
 * Nguoi kia gui trang tra loi cho mot trao doi. Luu trang va mo niem phong trong cung giao dich, nen ca
 * hai trang mo cung luc cho ca hai nguoi. doc da qua checkReplyInput o action; o day chan them
 * trang trong, trang co khoi media va tran ky tu cua mot to. Da mo tu truoc (da gui, hay da duoc tang chia khoa)
 * thi tra "already" va khong ghi trang tra loi nao.
 */
export async function submitReply(
  db: AnyDb, viewerId: string, sealId: string, doc: DocJson, now: Date = new Date(),
): Promise<OpenResult | null> {
  if (!isUuid(sealId) || isBlankDoc(doc) || hasMediaBlock(doc) || docCharCount(doc) > SEAL_LIMITS.replyMaxChars) return null;

  return db.transaction(async (tx): Promise<OpenResult | null> => {
    const row = await lockSeal(tx, sealId);
    if (!row || row.seal.kind !== "trao-doi" || row.mode !== "chia-se" || row.ownerId === viewerId) return null;
    const opened: Opened = { bookId: row.seal.bookId, firstPosition: row.seal.firstPosition };
    if (row.seal.openedAt !== null) return { status: "already", ...opened };
    await tx.insert(sealReplies).values({ sealId, accountId: viewerId, content: doc, createdAt: now });
    await tx.update(seals).set({ openedAt: now }).where(eq(seals.id, sealId));
    await recordActivity(tx, { ...sealEvent(row, now), kind: "mo-trang", actorId: viewerId });
    return { status: "opened", ...opened };
  });
}
