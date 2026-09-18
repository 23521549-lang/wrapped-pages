/** Cau hinh mot kho chuan S3. endpoint la goc https cua dich vu; object o duong dan /bucket/key. */
export type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

/** Kho tep duoc chon: S3 cho production, dia cuc bo cho dev va e2e, tat khi chay tren Vercel ma thieu bien. */
export type MediaStoreChoice = { kind: "s3"; config: S3Config } | { kind: "local"; dir: string } | { kind: "tat" };

export type MediaEnv = Readonly<Record<string, string | undefined>>;

/** Ten bien moi truong cua tung truong cau hinh S3. Khong bien nao co tien to NEXT_PUBLIC_. */
export const S3_ENV = {
  endpoint: "MEDIA_S3_ENDPOINT",
  region: "MEDIA_S3_REGION",
  bucket: "MEDIA_S3_BUCKET",
  accessKeyId: "MEDIA_S3_ACCESS_KEY_ID",
  secretAccessKey: "MEDIA_S3_SECRET_ACCESS_KEY",
} as const satisfies Record<keyof S3Config, string>;

/** Ten bucket theo luat S3: 3-63 ky tu chu thuong, so, cham, gach ngang, dau va cuoi la chu hoac so. */
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/**
 * Chon kho tep theo bien moi truong. Ham thuan: nhan env va thu muc tam mac dinh, khong doc process.env.
 * - Du ca nam bien S3: S3, ke ca tren Vercel.
 * - Khong co bien S3 nao va khong chay tren Vercel: dia cuc bo o MEDIA_LOCAL_DIR hoac defaultLocalDir.
 * - Khong co bien S3 nao tren Vercel: tat, web van chay.
 * Bien rong hay chi co khoang trang coi nhu khong dat. Thieu mot phan bien S3, endpoint hay bucket sai la cau hinh
 * hong: nem loi chi neu ten bien, khong bao gio neu gia tri.
 */
export function selectMediaStore(env: MediaEnv, defaultLocalDir: string): MediaStoreChoice {
  const config = s3Config(env);
  if (config) return { kind: "s3", config };
  if (envValue(env, "VERCEL")) return { kind: "tat" };
  return { kind: "local", dir: envValue(env, "MEDIA_LOCAL_DIR") ?? defaultLocalDir };
}

function envValue(env: MediaEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function s3Config(env: MediaEnv): S3Config | null {
  const endpoint = envValue(env, S3_ENV.endpoint);
  const region = envValue(env, S3_ENV.region);
  const bucket = envValue(env, S3_ENV.bucket);
  const accessKeyId = envValue(env, S3_ENV.accessKeyId);
  const secretAccessKey = envValue(env, S3_ENV.secretAccessKey);
  if (endpoint && region && bucket && accessKeyId && secretAccessKey) {
    if (!BUCKET.test(bucket)) throw new Error(`${S3_ENV.bucket} khong phai ten bucket S3 hop le`);
    return { endpoint: s3Endpoint(endpoint), region, bucket, accessKeyId, secretAccessKey };
  }
  const names = Object.values(S3_ENV);
  const missing = names.filter((name) => envValue(env, name) === null);
  if (missing.length === names.length) return null;
  throw new Error(`kho S3 thieu bien ${missing.join(", ")}: dat du ca ${names.length} bien MEDIA_S3_ hoac bo trong het`);
}

/**
 * Goc https cua dich vu kem tien to duong dan neu co: cong S3 cua Supabase la /storage/v1/s3, nen tu choi moi endpoint
 * co duong dan se tat han media voi Supabase. Van khong nhan ten dang nhap, tham so hay neo. Gach cheo cuoi bi cat de
 * dia chi object khong bao gio co hai gach cheo lien nhau.
 */
function s3Endpoint(raw: string): string {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${S3_ENV.endpoint} phai la dia chi https cua dich vu S3, vd https://tai-khoan.r2.cloudflarestorage.com`);
  }
  return url.origin + url.pathname.replace(/[/]+$/, "");
}
