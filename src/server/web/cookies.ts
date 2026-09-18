import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { readSession } from "@/server/identity/session";

export const DEVICE_COOKIE = "mqce_device";
export const SESSION_COOKIE = "mqce_session";
export const FOUNDER_COOKIE = "mqce_founder";

/** 400 ngay la tran Max-Age cac trinh duyet chap nhan. Vong doi phien that do may chu quyet (readSession). */
const COOKIE_OPTIONS = {
  httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 400,
};

/** CHI goi tu Server Action hoac Route Handler: ham nay co the GHI cookie. */
export async function getDeviceId(): Promise<string> {
  const jar = await cookies();
  const found = jar.get(DEVICE_COOKIE)?.value;
  if (found) return found;
  const id = randomUUID();
  jar.set(DEVICE_COOKIE, id, COOKIE_OPTIONS);
  return id;
}

/** Chi DOC dau thiet bi, goi duoc tu Server Component. Khong bao gio ghi cookie. */
export async function readDeviceId(): Promise<string | null> {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}

/** Chi DOC cookie, goi duoc tu Server Component. Moi request chi tra database mot lan. */
export const currentAccount = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSession(db, token);
});

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

export async function setFounderCookie() {
  (await cookies()).set(FOUNDER_COOKIE, "1", COOKIE_OPTIONS);
}
