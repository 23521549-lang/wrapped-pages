/**
 * Ky AWS Signature Version 4 cho S3 bang Web Crypto (HMAC-SHA256), khong dependency, khong mang. Ham thuan theo
 * tham so: khong doc bien moi truong, khong in khoa. Chi ky duong dan object, khong ky query.
 */
const LF = String.fromCharCode(10);
const ALGORITHM = "AWS4-HMAC-SHA256";
const ENCODER = new TextEncoder();

/** SHA-256 cua than rong, dung cho GET va DELETE. */
export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type SigningCredentials = { accessKeyId: string; secretAccessKey: string; region: string; service: string };

/** headers la cac header can ky ngoai host, x-amz-date va x-amz-content-sha256 (ham tu them ba header nay). */
export type SigningRequest = { method: string; url: URL; headers: Readonly<Record<string, string>>; payloadHash: string };

/** headers la bo header gui kem request: header truyen vao, x-amz-date, x-amz-content-sha256 va authorization. */
export type SignedRequest = { headers: Record<string, string>; canonicalRequest: string; stringToSign: string; signature: string };

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer> | string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? ENCODER.encode(data) : data));
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(data));
}

/** Moc gio dang ISO 8601 co ban cua SigV4, vd 20130524T000000Z. */
export function amzDate(now: Date): string {
  return now.toISOString().replace(/[.][0-9]{3}/, "").replaceAll(/[-:]/g, "");
}

/** Ma hoa URI theo S3: giu A-Z, a-z, 0-9, "-", ".", "_", "~"; moi byte khac thanh %XX chu hoa. */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replaceAll(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Duong dan chuan: ma hoa tung doan mot lan, giu dau gach cheo. */
function canonicalPath(url: URL): string {
  return url.pathname.split("/").map((segment) => uriEncode(decodeURIComponent(segment))).join("/");
}

/** Gia tri header chuan: cat khoang trang hai dau, gop day khoang trang lien nhau thanh mot. */
function canonicalValue(value: string): string {
  return value.trim().replaceAll(/ +/g, " ");
}

async function signingKey(creds: SigningCredentials, day: string): Promise<ArrayBuffer> {
  const kDate = await hmac(ENCODER.encode(`AWS4${creds.secretAccessKey}`), day);
  const kRegion = await hmac(kDate, creds.region);
  const kService = await hmac(kRegion, creds.service);
  return hmac(kService, "aws4_request");
}

/**
 * Ky mot request theo SigV4 dang header Authorization: canonical request, chuoi can ky, khoa ky theo ngay, vung va
 * dich vu, roi chu ky. Moi header truyen vao, host, x-amz-content-sha256 va x-amz-date deu duoc ky.
 */
export async function signRequest(req: SigningRequest, creds: SigningCredentials, now: Date): Promise<SignedRequest> {
  if (req.url.search || req.url.hash) throw new Error("sigv4 chi ky duong dan object, khong ky query hay neo");
  const date = amzDate(now);
  const scope = `${date.slice(0, 8)}/${creds.region}/${creds.service}/aws4_request`;
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(req.headers).map(([name, value]) => [name.toLowerCase(), value])),
    "x-amz-content-sha256": req.payloadHash,
    "x-amz-date": date,
  };
  const signed: Record<string, string> = { ...headers, host: req.url.host };
  // oxlint-disable-next-line unicorn/no-array-sort -- mang ten vua tao tu Object.keys, khong ai khac giu tham chieu; toSorted() can nang tsconfig lib len ES2023.
  const names = Object.keys(signed).sort();
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    req.method, canonicalPath(req.url), "",
    ...names.map((name) => `${name}:${canonicalValue(signed[name])}`), "",
    signedHeaders, req.payloadHash,
  ].join(LF);
  const stringToSign = [ALGORITHM, date, scope, await sha256Hex(canonicalRequest)].join(LF);
  const signature = hex(await hmac(await signingKey(creds, date.slice(0, 8)), stringToSign));
  const authorization = `${ALGORITHM} Credential=${creds.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`;
  return { headers: { ...headers, authorization }, canonicalRequest, stringToSign, signature };
}
