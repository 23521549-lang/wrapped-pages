import { roundAt } from "@/lib/round";
import { isStorable } from "@/lib/storable";

/**
 * Loi hoi dap theo luot dang: luat chu dung chung cho may chu (submitRoundReply) va man doc (bo dem, khung hoi dap),
 * nen hai phia dem cung mot cach. Ham thuan, khong cham trinh duyet hay database.
 */

/** Tran ky tu cua mot loi hoi dap, dem theo code point nhu char_length cua Postgres; khop CHECK round_replies_body (co test). */
export const REPLY_MAX = 1000;

/** So dong trong lien tiep toi da duoc giu trong mot loi hoi dap. */
export const REPLY_BLANK_RUN_MAX = 2;

// Viet bang ma ky tu de ma nguon khong chua chuoi thoat.
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/**
 * Chu se luu: doi CRLF va CR ve LF, bo khoang trang va dong trong o hai dau, dong chi co khoang trang thanh dong trong,
 * moi day dong trong con toi da REPLY_BLANK_RUN_MAX dong. Khoang trang ben trong mot dong giu nguyen.
 */
export function normalizeReplyBody(raw: string): string {
  const dong = raw.split(CR + LF).join(LF).split(CR).join(LF).trim().split(LF);
  const out: string[] = [];
  let trong = 0;
  for (const d of dong) {
    if (d.trim() !== "") {
      trong = 0;
      out.push(d);
      continue;
    }
    trong += 1;
    if (trong <= REPLY_BLANK_RUN_MAX) out.push("");
  }
  return out.join(LF);
}

/** Do dai theo code point: mot ky tu ngoai BMP (hai don vi UTF-16) la mot, nhu char_length cua Postgres. */
export function replyLength(s: string): number {
  return Array.from(s).length;
}

export type ReplyCheck = { ok: true; body: string } | { ok: false; reason: "empty" | "too-long" | "invalid" };

/**
 * Kiem chu gui len tu trinh duyet: phai la chuoi Postgres luu duoc nguyen van (isStorable), sau khi chuan hoa con tu 1
 * toi REPLY_MAX ky tu. Tra kem chu da chuan hoa, la chu duy nhat duoc luu.
 */
export function checkReplyBody(raw: unknown): ReplyCheck {
  if (typeof raw !== "string" || !isStorable(raw)) return { ok: false, reason: "invalid" };
  const body = normalizeReplyBody(raw);
  const n = replyLength(body);
  if (n === 0) return { ok: false, reason: "empty" };
  if (n > REPLY_MAX) return { ok: false, reason: "too-long" };
  return { ok: true, body };
}

/**
 * Loi hoi dap nhu man doc nhan: chu da chuan hoa va luc gui. Khong mang id tai khoan: nguoi gui luon la nguoi khong
 * phai chu sach.
 */
export type ReaderReply = { roundId: string; body: string; createdAt: Date };

/**
 * Mot luot nhu khung hoi dap can: khoang to, niem phong cua luot con dong voi nguoi doc khong (ReaderRound.sealed), va
 * loi hoi dap neu co.
 */
export type ReplyRound = { id: string; first: number; last: number; sealed: boolean; reply: { body: string; at: Date } | null };

/** Gan loi hoi dap vao dung luot, giu thu tu cua rounds. */
export function replyRounds(
  rounds: readonly { id: string; first: number; last: number; sealed: boolean }[],
  replies: readonly ReaderReply[],
): ReplyRound[] {
  const cua = new Map(replies.map((r) => [r.roundId, r]));
  return rounds.map((r): ReplyRound => {
    const x = cua.get(r.id);
    return { id: r.id, first: r.first, last: r.last, sealed: r.sealed, reply: x ? { body: x.body, at: x.createdAt } : null };
  });
}

/**
 * Luot cua khung hoi dap theo cac to dang hien (vi tri tu 1, nhu Flipbook bao qua onShow): to ben phai truoc, vi hai
 * trang thuoc hai luot thi khung theo trang ben phai; khong co thi to ben trai.
 */
export function shownRound<T extends { first: number; last: number }>(
  rounds: readonly T[],
  shown: { first: number; last: number },
): T | undefined {
  return roundAt(rounds, shown.last) ?? roundAt(rounds, shown.first);
}
