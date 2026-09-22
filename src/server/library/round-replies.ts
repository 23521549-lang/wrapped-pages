import { asc, eq } from "drizzle-orm";
import { books, roundReplies, rounds, seals } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { recordActivity } from "@/server/feed/record";
import { closedToPartner } from "@/server/seal/seals";
import { checkReplyBody, type ReaderReply } from "@/lib/round-reply";
import { isUuid } from "@/lib/uuid";

/**
 * "sent": vua luu va ghi su kien. "exists": luot da co loi hoi dap (tab khac, hay hai lan bam cung luc), khong ghi gi.
 * "sealed": niem phong cua luot con dong voi nguoi gui. "not-found": luot la, ma rac, sach rieng tu hay chinh chu sach
 * (khong lo su ton tai). "invalid": chu khong qua checkReplyBody.
 */
export type RoundReplyResult = "sent" | "exists" | "sealed" | "not-found" | "invalid";

/**
 * Nguoi kia gui loi hoi dap cho mot luot, trong mot giao dich:
 * - kiem chu truoc khi cham database (checkReplyBody chuan hoa, dem theo code point);
 * - khoa dong luot va dong sach (FOR UPDATE tren ca hai bang cua join): xep hang voi updateBook doi che do chia se,
 *   publishDraft va editRound; nguoi gui phai khong phai chu sach va sach dang chia se;
 * - niem phong cua luot (neu co) phai da mo voi nguoi gui, dung luat cua src/server/seal (closedToPartner). Niem phong
 *   chi di mot chieu tu dong sang mo nen khong can khoa: doc thay con dong thi tra sealed, thu lai la duoc;
 * - chen ON CONFLICT DO NOTHING: khong co dong tra ve la da co loi hoi dap, mot duong ma cho ca lan gui thu hai lan
 *   hai lan gui dong thoi, khong bao gio de loi 23505 len toi nguoi dung;
 * - ghi su kien hoi-dap cung giao dich (shared = true vi sach dang chia se, khong gan niem phong).
 * Moi duong tra ve truoc lenh insert chi moi doc, nen commit cua drizzle o do khong ghi gi.
 */
export async function submitRoundReply(
  db: AnyDb, accountId: string, roundId: string, body: unknown, now: Date = new Date(),
): Promise<RoundReplyResult> {
  const checked = checkReplyBody(body);
  if (!checked.ok) return "invalid";
  if (!isUuid(roundId)) return "not-found";

  return db.transaction(async (tx): Promise<RoundReplyResult> => {
    const [row] = await tx
      .select({ bookId: rounds.bookId, ownerId: books.ownerId, mode: books.mode })
      .from(rounds)
      .innerJoin(books, eq(books.id, rounds.bookId))
      .where(eq(rounds.id, roundId))
      .for("update");
    if (!row || row.ownerId === accountId || row.mode !== "chia-se") return "not-found";
    const [seal] = await tx
      .select({ kind: seals.kind, opensAt: seals.opensAt, openedAt: seals.openedAt })
      .from(seals)
      .where(eq(seals.roundId, roundId));
    if (closedToPartner(seal, now)) return "sealed";
    const [moi] = await tx
      .insert(roundReplies)
      .values({ roundId, accountId, body: checked.body, createdAt: now })
      .onConflictDoNothing({ target: roundReplies.roundId })
      .returning({ roundId: roundReplies.roundId });
    if (!moi) return "exists";
    await recordActivity(tx, {
      kind: "hoi-dap", actorId: accountId, bookId: row.bookId, roundId, mode: row.mode, at: now, sealId: null,
    });
    return "sent";
  });
}

/** Moi loi hoi dap cua mot cuon, cu nhat truoc. Chi goi sau khi da kiem nguoi xem doc duoc cuon (readBook). */
export async function repliesOfBook(db: AnyDb, bookId: string): Promise<ReaderReply[]> {
  return db
    .select({ roundId: roundReplies.roundId, body: roundReplies.body, createdAt: roundReplies.createdAt })
    .from(roundReplies)
    .innerJoin(rounds, eq(rounds.id, roundReplies.roundId))
    .where(eq(rounds.bookId, bookId))
    .orderBy(asc(roundReplies.createdAt));
}
