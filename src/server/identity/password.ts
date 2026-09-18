import { createHmac } from "node:crypto";
import { verify as argonVerify } from "@node-rs/argon2";
import { normalize } from "@/lib/vi";
import { WORDS } from "./words";

/** tu-tu-tu-NN, moi tu 2 toi 6 chu cai thuong, NN la hai chu so. */
export const PASSWORD_SHAPE = /^[a-z]{2,6}-[a-z]{2,6}-[a-z]{2,6}-\d{2}$/;

/**
 * So lan toi da thu mot bo dem khac roi sinh lai mat khau khi no trung voi mat
 * khau cua cho ngoi kia (hoac cua chinh nguoi doi, xem renameSelf o rename.ts).
 */
export const MAX_DERIVE_TRIES = 50;

export function derivePassword(
  nickname: string,
  secret: string,
  serverKey: string,
  counter = 0,
): string {
  const msg = `${normalize(nickname)}\n${normalize(secret)}\n${counter}`;
  const seed = createHmac("sha256", serverKey).update(msg).digest();
  const w = (i: number) => WORDS[seed[i] % WORDS.length];
  const num = String(Math.floor(((((seed[3] << 8) | seed[4]) / 65536) * 100)) % 100).padStart(2, "0");
  return `${w(0)}-${w(1)}-${w(2)}-${num}`;
}

/**
 * Boc argonVerify cho ca bon noi trong module identity so sanh mat khau. Argon2
 * nem loi khi `hash` hong hoac cut thay vi tra false, va bon noi do deu muon coi
 * truong hop nay la "khong khop" de luong dang nhap/doi ten/sinh cho ngoi khong
 * doi. Nuot loi hoan toan (.catch(() => false)) xoa mat dau vet duy nhat cua mot
 * loi xac thuc hong that su - nguoi dung se bi khoa sau vai lan thu ma khong ai
 * biet vi sao. Ham nay giu nguyen hanh vi tra false, nhung in loi goc ra truoc.
 * KHONG bao gio in `hash` hay `candidate` - chi in doi tuong loi ma argon2 nem ra.
 */
export async function verifyPassword(hash: string, candidate: string): Promise<boolean> {
  return argonVerify(hash, candidate).catch((e: unknown) => {
    console.error("argon2 verify loi, coi la khong khop:", e);
    return false;
  });
}
