import { isStorable } from "@/lib/storable";

const SECRET_MAX = 500;

/** Kiem biet danh va loi nhan tu form. Dung chung cho tao cho ngoi va doi ten. */
export function parseNameInput(fd: FormData): { nickname: string; secret: string } | { error: string } {
  const nickname = String(fd.get("nickname") ?? "").trim();
  const secret = String(fd.get("secret") ?? "").trim();
  // Ky tu Postgres khong luu duoc (xem isStorable) chi den tu request gia mao, nen dung chung thong diep cua o do.
  if (nickname.length < 1 || nickname.length > 20 || !isStorable(nickname)) return { error: "Biệt danh phải từ 1 tới 20 ký tự." };
  if (secret.length < 4 || !isStorable(secret)) return { error: "Lời nhắn bí mật phải dài ít nhất 4 ký tự." };
  if (secret.length > SECRET_MAX) return { error: `Lời nhắn bí mật dài tối đa ${SECRET_MAX} ký tự.` };
  return { nickname, secret };
}
