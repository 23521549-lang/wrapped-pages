import { DOC_LIMITS } from "./validate";

/** Bo dem ky tu o dau man viet hien tu ty le nay cua DOC_LIMITS.maxChars tro len. */
export const CHAR_COUNT_SHOW_RATIO = 0.9;

export type CharCountLabel = { kind: "an" } | { kind: "gan"; text: string } | { kind: "tran"; text: string };

/** "20000" thanh "20 000": ngan nghin bang dau cach thuong. Intl vi-VN dung dau cham nen tu dinh dang. */
export function groupThousands(n: number): string {
  const digits = String(n);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.join(" ");
}

/**
 * Chu cua bo dem cho so ky tu cua ca ban nhap. Duoi nguong hien thi thi an. Vuot DOC_LIMITS.maxChars (actionSaveDraft
 * tu choi tu day) thi la canh bao thay cho trang thai luu; dung bang tran van luu duoc nen van la so dem.
 */
export function charCountLabel(chars: number): CharCountLabel {
  const max = DOC_LIMITS.maxChars;
  if (chars > max) return { kind: "tran", text: `Vượt ${groupThousands(max)} ký tự, nháp không lưu được. Đăng bớt trang rồi viết tiếp.` };
  if (chars < max * CHAR_COUNT_SHOW_RATIO) return { kind: "an" };
  return { kind: "gan", text: `${groupThousands(chars)} / ${groupThousands(max)} ký tự` };
}
