import type { S3Config } from "@/lib/media/config";
import type { MediaMime } from "@/lib/media/kinds";
import { EMPTY_SHA256, sha256Hex, signRequest } from "./sigv4";
import { assertStoreKey, type ByteRange, type MediaStore } from "./store";

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const HTTP_NOT_FOUND = 404;
const HTTP_PARTIAL = 206;
/** AWS va R2 tu choi request co x-amz-date lech qua chung nay so voi dong ho cua ho (403 RequestTimeTooSkewed). */
const SKEW_MS = 15 * 60_000;
/**
 * Kho khong tra noi header trong chung nay thi coi nhu treo. Khong co moc nay thi mot kho im lang ghim ca mot lan goi
 * serverless toi khi nen tang tu giet no, va nguoi dung chi thay trang quay mai.
 *
 * Dong ho chi tinh den luc CO HEADER roi tat (AbortController + clearTimeout), khong phai ca than phan hoi nhu
 * AbortSignal.timeout: than cua GET di thang tu kho ra trinh duyet, toc do do duong truyen cua nguoi doc quyet, nen mot
 * dong ho phu ca than se cat ngang dung nhung lan doc cham nhat. PUT va DELETE khong co than de doc tiep (expectOk bo
 * than ngay), nen voi hai phuong thuc do day la tran cho ca request.
 */
const HEADER_TIMEOUT_MS = 15_000;

/**
 * Bo than phan hoi khong can doc, roi nem loi chi kem phuong thuc va ma HTTP khi kho tu choi. Neu header Date cua kho
 * lech qua SKEW_MS so voi dong ho cua tien trinh thi noi them mot cau: 403 do lech gio nhin giong het 403 do sai khoa,
 * nen khong noi thi nguoi thi cong chan nham huong. Header Date la gio cua may chu kho, khong phai bi mat.
 */
async function expectOk(res: Response, method: string, now: Date): Promise<void> {
  await res.body?.cancel();
  if (res.ok) return;
  const server = Date.parse(res.headers.get("date") ?? "");
  const lech = Number.isNaN(server) ? 0 : Math.abs(server - now.getTime());
  throw new Error(`kho S3 tu choi ${method}: HTTP ${res.status}${lech > SKEW_MS ? " (dong ho lech qua 15 phut)" : ""}`);
}

/**
 * Kho chuan S3 cho production: Cloudflare R2 hay cong S3 cua Supabase Storage, doi bang bien moi truong. Moi
 * request ky SigV4, dia chi object la {endpoint}/{bucket}/{key} nen endpoint giu duoc ca tien to duong dan cua
 * Supabase, bucket private. AWS S3 thi chua chac: AWS da thong bao ngung kieu duong dan nay cho bucket moi. fetch va
 * dong ho tiem duoc de test khong can mang. Loi nem ra khong bao gio chua khoa hay than phan hoi.
 */
export class S3Store implements MediaStore {
  readonly #config: S3Config;
  readonly #fetch: FetchFn;
  readonly #now: () => Date;

  constructor(config: S3Config, fetchFn: FetchFn = (url, init) => fetch(url, init), now: () => Date = () => new Date()) {
    this.#config = config;
    this.#fetch = fetchFn;
    this.#now = now;
  }

  async put(key: string, bytes: Uint8Array<ArrayBuffer>, mime: MediaMime): Promise<void> {
    const res = await this.#send("PUT", key, { "content-type": mime }, await sha256Hex(bytes), bytes);
    await expectOk(res, "PUT", this.#now());
  }

  async get(key: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array> | null> {
    const res = await this.#send("GET", key, range ? { range: `bytes=${range.start}-${range.end}` } : {}, EMPTY_SHA256);
    if (res.status === HTTP_NOT_FOUND) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok || !res.body) {
      await expectOk(res, "GET", this.#now());
      throw new Error("kho S3 tra GET khong co than");
    }
    if (range && res.status !== HTTP_PARTIAL) {
      await res.body.cancel();
      // Kho bo qua Range thi khong duoc lang le tra ca tep: serveMedia da khai Content-Range va Content-Length theo
      // khoang da tinh, nen mot than dai hon se lam hong chinh phan hoi do.
      throw new Error(`kho S3 bo qua Range o GET: HTTP ${res.status}`);
    }
    return res.body;
  }

  async remove(keys: readonly string[]): Promise<void> {
    for (const key of keys) assertStoreKey(key);
    await Promise.all(keys.map(async (key) => {
      const res = await this.#send("DELETE", key, {}, EMPTY_SHA256);
      if (res.status === HTTP_NOT_FOUND) await res.body?.cancel();
      else await expectOk(res, "DELETE", this.#now());
    }));
  }

  async #send(
    method: string, key: string, headers: Record<string, string>, payloadHash: string, body?: Uint8Array<ArrayBuffer>,
  ): Promise<Response> {
    assertStoreKey(key);
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } = this.#config;
    const url = new URL(`${endpoint}/${bucket}/${key}`);
    const signed = await signRequest(
      { method, url, headers, payloadHash },
      { accessKeyId, secretAccessKey, region, service: "s3" },
      this.#now(),
    );
    const dung = new AbortController();
    const hen = setTimeout(() => dung.abort(), HEADER_TIMEOUT_MS);
    try {
      return await this.#fetch(url.href, { method, headers: signed.headers, body, signal: dung.signal });
    } catch (err) {
      // Treo phai la mot loi ro rang. Tuyet doi khong duoc de no roi vao duong tra null cua get(): "kho khong tra loi"
      // khac han "object khong con trong kho", va hai cai do dan nguoi thi cong di hai huong khac nhau.
      if (dung.signal.aborted) throw new Error(`kho S3 khong tra loi ${method} trong ${HEADER_TIMEOUT_MS / 1_000} giay`, { cause: err });
      throw err;
    } finally {
      clearTimeout(hen);
    }
  }
}
