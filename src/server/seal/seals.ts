import { and, asc, eq, inArray } from "drizzle-orm";
import { sealAttempts, sealReplies, seals } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { DocJson } from "@/lib/doc/types";
import { attemptState } from "@/lib/seal/attempts";
import { RITUAL_WINDOW_MS, type KnockEntry, type ReaderSeal, type SealInput } from "@/lib/seal/types";

export type SealRow = typeof seals.$inferSelect;
export type SealRange = Pick<SealRow, "id" | "bookId" | "firstPosition" | "lastPosition" | "kind" | "opensAt" | "openedAt" | "teaser">;

/** Cot rieng cua tung loai niem phong. */
function sealColumns(input: SealInput) {
  if (input.kind === "hen-gio") return { kind: input.kind, opensAt: input.opensAt };
  if (input.kind === "trao-doi") return { kind: input.kind, question: input.question };
  return { kind: input.kind, question: input.question, answers: input.answers, hints: input.hints };
}

/** Ghi mot niem phong phu cac to firstPosition toi lastPosition, tra id. Goi ben trong giao dich cua publishDraft. */
export async function insertSeal(
  tx: AnyDb, bookId: string, firstPosition: number, lastPosition: number, input: SealInput, teaser: string,
): Promise<string> {
  const [row] = await tx
    .insert(seals)
    .values({ bookId, firstPosition, lastPosition, teaser, ...sealColumns(input) })
    .returning({ id: seals.id });
  return row.id;
}

/**
 * Niem phong con khoa voi nguoi xem khong. Hen gio khoa ca chu sach cho toi opensAt.
 * Cau do va trao doi khong khoa chu sach, va mo voi nguoi kia khi openedAt da co.
 */
export function isLockedFor(seal: Pick<SealRow, "kind" | "opensAt" | "openedAt">, isOwner: boolean, now: Date): boolean {
  if (seal.kind === "hen-gio") return seal.opensAt === null || now.getTime() < seal.opensAt.getTime();
  return !isOwner && seal.openedAt === null;
}

/** Moi niem phong cua mot cuon, theo vi tri. Dong day du, chi dung ben trong may chu. */
export async function sealsOfBook(db: AnyDb, bookId: string): Promise<SealRow[]> {
  return db.select().from(seals).where(eq(seals.bookId, bookId)).orderBy(asc(seals.firstPosition));
}

/** Khoang to va trang thai niem phong cua nhieu cuon mot luc, cho ke sach. Khong lay cau hoi, dap an hay goi y. */
export async function sealsOfBooks(db: AnyDb, bookIds: readonly string[]): Promise<SealRange[]> {
  if (bookIds.length === 0) return [];
  return db
    .select({
      id: seals.id, bookId: seals.bookId, firstPosition: seals.firstPosition, lastPosition: seals.lastPosition,
      kind: seals.kind, opensAt: seals.opensAt, openedAt: seals.openedAt, teaser: seals.teaser,
    })
    .from(seals)
    .where(inArray(seals.bookId, [...bookIds]))
    .orderBy(asc(seals.bookId), asc(seals.firstPosition));
}

/** Niem phong phu vi tri position, neu co. */
export function sealAt<T extends Pick<SealRow, "firstPosition" | "lastPosition">>(list: readonly T[], position: number): T | undefined {
  return list.find((s) => s.firstPosition <= position && position <= s.lastPosition);
}

/** Gom cac dong theo khoa key trong mot luot, giu thu tu ban dau trong tung nhom. */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

/**
 * Trang thai cac niem phong cua mot cuon nhu nguoi xem duoc phep biet. Day la noi duy nhat quyet truong
 * nao cua mot niem phong duoc roi may chu: dap an khong bao gio, goi y chua mo khong bao gio.
 */
export async function readerSeals(
  db: AnyDb, rows: readonly SealRow[], viewerId: string, mine: boolean, now: Date,
): Promise<ReaderSeal[]> {
  const riddleIds = rows.filter((s) => s.kind === "cau-do").map((s) => s.id);
  const openedExchangeIds = rows.filter((s) => s.kind === "trao-doi" && s.openedAt !== null).map((s) => s.id);
  // Chu sach nhan nhat ky go cua day du, ke ca chuoi da go. Nguoi kia chi can dung sai va luc thu cua chinh minh
  // (goi y, so lan con lai, nghi thuc), nen truy van cua ho khong lay cot guess. Khong gioi han so dong: cat bot
  // se lam mat nhat ky go cua cua chu sach, con so lan thu tang cham vi cu 5 lan sai phai cho 10 phut.
  const [knocks, viewerAttempts, replies] = await Promise.all([
    !mine || riddleIds.length === 0
      ? Promise.resolve([] as (KnockEntry & { sealId: string })[])
      : db
        .select({ sealId: sealAttempts.sealId, guess: sealAttempts.guess, correct: sealAttempts.correct, at: sealAttempts.at })
        .from(sealAttempts)
        .where(inArray(sealAttempts.sealId, riddleIds))
        .orderBy(asc(sealAttempts.at)),
    mine || riddleIds.length === 0
      ? Promise.resolve([] as { sealId: string; correct: boolean; at: Date }[])
      : db
        .select({ sealId: sealAttempts.sealId, correct: sealAttempts.correct, at: sealAttempts.at })
        .from(sealAttempts)
        .where(and(inArray(sealAttempts.sealId, riddleIds), eq(sealAttempts.accountId, viewerId)))
        .orderBy(asc(sealAttempts.at)),
    openedExchangeIds.length === 0
      ? Promise.resolve([] as { sealId: string; content: DocJson }[])
      : db.select({ sealId: sealReplies.sealId, content: sealReplies.content }).from(sealReplies).where(inArray(sealReplies.sealId, openedExchangeIds)),
  ]);
  const knocksOf = groupBy(knocks, (k) => k.sealId);
  const attemptsOf = groupBy(viewerAttempts, (a) => a.sealId);

  return rows.map((s): ReaderSeal => {
    const locked = isLockedFor(s, mine, now);
    const ownAttempts = attemptsOf.get(s.id) ?? [];
    const state = s.kind === "cau-do" && !mine && locked
      ? attemptState(ownAttempts.filter((a) => !a.correct).map((a) => a.at), s.hints.length, now)
      : null;
    const reply = locked ? null : (replies.find((r) => r.sealId === s.id)?.content ?? null);
    // Chi nguoi kia tu mo (tra loi dung hoac gui trang tra loi) moi co nghi thuc; tang chia khoa va hen gio thi khong.
    const selfOpened = !mine && !locked && (s.kind === "cau-do" ? ownAttempts.some((a) => a.correct) : s.kind === "trao-doi" && reply !== null);
    return {
      id: s.id,
      kind: s.kind,
      firstPosition: s.firstPosition,
      lastPosition: s.lastPosition,
      mine,
      locked,
      question: s.question,
      opensAt: s.opensAt,
      hints: s.kind !== "cau-do" ? [] : mine ? [...s.hints] : state ? s.hints.slice(0, state.hintsUnlocked) : [],
      remaining: state ? state.remaining : null,
      lockedUntil: state ? state.lockedUntil : null,
      openedAt: s.openedAt,
      ritual: selfOpened && s.openedAt !== null && now.getTime() - s.openedAt.getTime() <= RITUAL_WINDOW_MS,
      giftNote: locked ? null : s.giftNote,
      reply,
      answerCount: s.kind === "cau-do" && mine ? s.answers.length : null,
      knocks: s.kind === "cau-do" && mine ? (knocksOf.get(s.id) ?? []).map(({ guess, correct, at }) => ({ guess, correct, at })) : [],
    };
  });
}
