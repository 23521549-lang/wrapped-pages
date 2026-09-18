import type { BookMode } from "@/lib/book";
import { isStorable } from "@/lib/storable";
import { normalizeAnswer } from "./answer";
import { SEAL_KINDS, SEAL_LIMITS, type SealInput } from "./types";

export type SealParse = { ok: true; seal: SealInput | null } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Chuoi sau khi cat khoang trang dai 1 toi max ky tu va luu duoc vao Postgres, khong thi null. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max && isStorable(t) ? t : null;
}

/**
 * Mang chuoi: bo phan tu rong, moi phan tu toi maxLen va luu duoc vao Postgres, toi da maxItems. Thieu truong
 * thi la mang rong. Dung ngay khi vuot maxItems de mot mang khong lo khong bi duyet het.
 */
function textList(v: unknown, maxItems: number, maxLen: number): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    const t = item.trim();
    if (t === "") continue;
    if (t.length > maxLen || !isStorable(t) || out.length === maxItems) return null;
    out.push(t);
  }
  return out;
}

/**
 * Thoi diem dang ISO 8601 day du ngay gio va mui gio (Z hoac +hh:mm / -hh:mm), dung dang toISOString ma trinh
 * duyet gui len. Chuoi khong mui gio bi may chu hieu lech gio, chuoi dang khac thi Date.parse doan mo.
 */
const ISO_WITH_ZONE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]{1,3})?)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

/**
 * Niem phong gui len cung lan dang. Den tu trinh duyet nen chua tin duoc. raw la null hoac undefined thi
 * khong gan niem phong. mode la che do cua cuon sach, now la dong ho may chu.
 */
export function parseSealInput(raw: unknown, mode: BookMode, now: Date): SealParse {
  if (raw === null || raw === undefined) return { ok: true, seal: null };
  if (!isObj(raw) || typeof raw.kind !== "string" || !(SEAL_KINDS as readonly string[]).includes(raw.kind)) {
    return { ok: false, error: "Loại niêm phong không hợp lệ." };
  }
  if (raw.kind !== "hen-gio" && mode === "rieng-tu") {
    return { ok: false, error: "Sách riêng tư chỉ gắn được niêm phong hẹn giờ." };
  }

  if (raw.kind === "hen-gio") {
    const iso = typeof raw.opensAt === "string" && ISO_WITH_ZONE.test(raw.opensAt) ? raw.opensAt : null;
    const t = iso ? Date.parse(iso) : Number.NaN;
    const lead = t - now.getTime();
    if (!Number.isFinite(t) || lead < SEAL_LIMITS.minLeadMs || lead > SEAL_LIMITS.maxLeadMs) {
      return { ok: false, error: "Giờ mở phải sau lúc này ít nhất 1 phút và trong vòng 10 năm." };
    }
    return { ok: true, seal: { kind: "hen-gio", opensAt: new Date(t) } };
  }

  const question = text(raw.question, SEAL_LIMITS.questionMax);
  if (!question) return { ok: false, error: `Câu hỏi dài 1 tới ${SEAL_LIMITS.questionMax} ký tự.` };
  if (raw.kind === "trao-doi") return { ok: true, seal: { kind: "trao-doi", question } };

  const rawAnswers = textList(raw.answers, SEAL_LIMITS.answersMax, SEAL_LIMITS.answerMax);
  const answers = rawAnswers ? [...new Set(rawAnswers.map(normalizeAnswer))] : null;
  if (!answers || answers.length === 0 || answers.includes("")) {
    return {
      ok: false,
      error: `Câu đố cần 1 tới ${SEAL_LIMITS.answersMax} đáp án có chữ, mỗi đáp án tới ${SEAL_LIMITS.answerMax} ký tự.`,
    };
  }
  const hints = textList(raw.hints, SEAL_LIMITS.hintsMax, SEAL_LIMITS.hintMax);
  if (!hints) {
    return { ok: false, error: `Tối đa ${SEAL_LIMITS.hintsMax} gợi ý, mỗi gợi ý tới ${SEAL_LIMITS.hintMax} ký tự.` };
  }
  return { ok: true, seal: { kind: "cau-do", question, answers, hints } };
}
