import { normalize } from "@/lib/vi";

/**
 * Chuan hoa dap an: bo dau, thuong hoa, bo dau cau, gop khoang trang.
 * normalize lan dau bo dau va thuong hoa, nen sau do moi ky tu con lai ngoai a-z va 0-9 deu la dau cau
 * hay ky hieu. Thay ca cum bang mot khoang trang de "xe.buyt" thanh "xe buyt" chu khong dinh lien,
 * roi normalize lan hai gop khoang trang va cat hai dau.
 */
export function normalizeAnswer(s: string): string {
  return normalize(normalize(s).replace(/[^a-z0-9]+/g, " "));
}

/** answers la cac dap an DA chuan hoa. Chuoi go rong sau khi chuan hoa khong bao gio khop. */
export function matchesAnswer(guess: string, answers: readonly string[]): boolean {
  const g = normalizeAnswer(guess);
  return g !== "" && answers.includes(g);
}
