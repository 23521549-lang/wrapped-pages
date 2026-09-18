import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";

function keyOf(serverKey: string): Buffer {
  return createHash("sha256").update(serverKey).digest();
}

/** Tra ve "iv.tag.data", tat ca base64url. */
export function encryptSecret(plain: string, serverKey: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, keyOf(serverKey), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(cipher: string, serverKey: string): string {
  const parts = cipher.split(".");
  if (parts.length !== 3) throw new Error("ban ma khong dung dinh dang");
  const [ivB, tagB, dataB] = parts;
  const d = createDecipheriv(ALG, keyOf(serverKey), Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dataB, "base64url")), d.final()]).toString("utf8");
}
