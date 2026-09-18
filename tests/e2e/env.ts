import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const LOI = "e2e can DATABASE_URL hop le trong .env.local";
const E2E_PATH = "/mqce_e2e";
const LOI_TRO_VAO_E2E =
  "DATABASE_URL trong .env.local dang tro vao database kiem thu mqce_e2e. Doi ten database o cuoi chuoi ve database that (vd /neondb) roi chay lai.";

/**
 * Tinh hai chuoi ket noi cho e2e:
 * - appUrl: y het DATABASE_URL that trong .env.local, chi dung de tao database mqce_e2e.
 * - e2eUrl: appUrl nhung pathname doi thanh /mqce_e2e, con lai (query, channel_binding...) giu nguyen.
 *
 * Luon doc thang tu file, KHONG doc process.env - vi playwright.config.ts se ghi de
 * process.env.DATABASE_URL bang e2eUrl truoc khi worker/webServer khoi dong.
 * Khong bao gio in gia tri: moi nhanh loi deu nem thong diep co dinh, khong keo theo chuoi goc.
 */
export function e2eUrls(): { appUrl: string; e2eUrl: string } {
  let raw: string;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    throw new Error(LOI);
  }
  return e2eUrlsTuNoiDung(raw);
}

/** Phan thuan cua e2eUrls: nhan noi dung tep .env.local, de kiem duoc ma khong can tep that. */
export function e2eUrlsTuNoiDung(raw: string): { appUrl: string; e2eUrl: string } {
  const parsed = parseEnv(raw);
  const value = parsed.DATABASE_URL;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(LOI);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(LOI);
  }
  // .env.local tro thang vao database kiem thu (vd lay nham chuoi ket noi cua mqce_e2e tren Neon): e2e se xoa
  // sach chinh database ma web luc dev dang dung, con database that thi khong ai dung toi. Dung han, noi ro.
  if (url.pathname === E2E_PATH) throw new Error(LOI_TRO_VAO_E2E);

  const appUrl = url.toString();
  url.pathname = E2E_PATH;
  const e2eUrl = url.toString();
  return { appUrl, e2eUrl };
}
