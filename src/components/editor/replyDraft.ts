import type { JSONContent } from "@tiptap/core";
import { docCharCount, isBlankDoc } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { checkReplyInput } from "@/lib/doc/validate";
import { SEAL_LIMITS } from "@/lib/seal/types";

/** Tien to khoa luu tam cua trang tra loi trong sessionStorage. */
export const REPLY_DRAFT_PREFIX = "mqce-tra-loi-";

/**
 * Khoa luu tam cua mot niem phong. Quy uoc du an la khoa theo tai khoan; o day khoa theo niem phong da la
 * theo tai khoan: route tra loi chi ve trinh viet cho dung mot nguoi (nguoi kia cua cuon chia se, khong phai
 * chu sach), nen moi sealId chi co mot tai khoan viet duoc vao khoa nay. sessionStorage lai rieng tung the.
 * Chu co the con lai sau khi niem phong da mo (gui bao mat ket noi nhung may chu da luu, hay chu sach vua
 * tang chia khoa); luc do route tra 404, nen moi loi tren man nay deu noi chu van con de nguoi viet chep lai.
 */
export function replyDraftKey(sealId: string): string {
  return `${REPLY_DRAFT_PREFIX}${sealId}`;
}

/** Doc ban luu tam. Chuoi hong hay khong phai tai lieu thi null; cau truc ben trong de TipTap tu xu ly. */
export function readReplyDraft(raw: string | null): JSONContent | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const doc = value as JSONContent;
  return doc.type === "doc" && Array.isArray(doc.content) ? doc : null;
}

export type ReplyCheck =
  | { ok: true; doc: DocJson }
  | { ok: false; reason: "invalid" | "too-long" | "blank" | "too-many-chars" };

/**
 * Kiem trang tra loi dung nhu may chu, cung ham va cung thu tu: actionSubmitReply goi checkReplyInput, roi
 * submitReply tu choi tai lieu trong (isBlankDoc sau cleanDoc) va tai lieu qua SEAL_LIMITS.replyMaxChars
 * (docCharCount). May chu tra mot thong diep chung cho hai ly do sau; trinh duyet bao rieng tung ly do.
 */
export function checkReply(input: unknown): ReplyCheck {
  const checked = checkReplyInput(input);
  if (!checked.ok) return { ok: false, reason: checked.reason };
  if (isBlankDoc(checked.doc)) return { ok: false, reason: "blank" };
  if (docCharCount(checked.doc) > SEAL_LIMITS.replyMaxChars) return { ok: false, reason: "too-many-chars" };
  return { ok: true, doc: checked.doc };
}

/** Them cau noi chu van con. Dung cho moi loi tren man tra loi, tru trang trong. */
export function keptText(message: string): string {
  return `${message} Chữ vẫn còn ở đây.`;
}

/** Thong diep loi cua man tra loi, theo ly do. */
export const REPLY_ERRORS = {
  blank: "Trang còn trống, chưa có gì để gửi.",
  "too-long": keptText("Trang trả lời dài quá một trang. Gọn lại rồi gửi."),
  "too-many-chars": keptText("Trang trả lời nhiều ký tự quá. Bớt một ít rồi gửi."),
  invalid: keptText("Trang trả lời có nội dung không đọc được."),
  overflow: keptText("Trang trả lời dài quá một trang. Gọn lại rồi gửi."),
  "not-ready": keptText("Trang chưa sẵn sàng. Thử lại sau một giây."),
  "not-measured": keptText("Chưa đo được trang. Thử sửa một chút rồi gửi lại."),
  offline: keptText("Mất kết nối lúc gửi. Kiểm tra mạng rồi thử lại."),
} as const;
