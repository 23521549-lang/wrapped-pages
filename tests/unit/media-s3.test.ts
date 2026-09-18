import { describe, it, expect, vi } from "vitest";
import type { S3Config } from "@/lib/media/config";
import { mediaStoreKey } from "@/lib/media/key";
import { S3Store, type FetchFn } from "@/server/media/s3";
import { EMPTY_SHA256, sha256Hex, signRequest } from "@/server/media/sigv4";

const CONFIG: S3Config = {
  endpoint: "https://tai-khoan.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "mqce-media",
  accessKeyId: "KHOA-TRUY-CAP",
  secretAccessKey: "BI-MAT-KHONG-DUOC-IN",
};
const NOW = new Date("2026-09-16T08:00:00.000Z");
const KEY = mediaStoreKey("5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a", "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e", "image/webp");
const KEY_CHO = mediaStoreKey(null, "7a2e4c6b-8d0f-4a1c-9e3b-5d7f9b1d3f5a", "audio/webm");
const URL_CUA = (key: string) => `https://tai-khoan.r2.cloudflarestorage.com/mqce-media/${key}`;
const DATA = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

type Goi = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** fetch gia: ghi lai tung request, tra lan luot cac phan hoi dat san. */
function ghiLai(...phanHoi: Response[]) {
  const goi: Goi[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    goi.push({ url, method: init.method ?? "GET", headers: Object.fromEntries(new Headers(init.headers)), body: init.body });
    const res = phanHoi.shift();
    if (!res) throw new Error("fetch gia het phan hoi");
    return res;
  };
  return { goi, fetchFn };
}

/** Kho dung CONFIG mau, noi vao fetch gia o tren. */
function fetchGia(...phanHoi: Response[]) {
  const { goi, fetchFn } = ghiLai(...phanHoi);
  return { goi, kho: new S3Store(CONFIG, fetchFn, () => NOW) };
}

/** Header cua request phai dung bo header ky SigV4 cho chinh URL, phuong thuc va than do. */
async function kyDung(g: Goi, headers: Record<string, string>, payloadHash: string) {
  const { accessKeyId, secretAccessKey, region } = CONFIG;
  const signed = await signRequest({ method: g.method, url: new URL(g.url), headers, payloadHash }, { accessKeyId, secretAccessKey, region, service: "s3" }, NOW);
  expect(g.headers).toEqual(signed.headers);
  expect(g.headers.authorization).toContain("Credential=KHOA-TRUY-CAP/20260916/auto/s3/aws4_request,");
  expect(JSON.stringify(g)).not.toContain(CONFIG.secretAccessKey);
}

describe("S3Store", () => {
  it("put: PUT dung URL kieu /bucket/key, content-type, hash than va chu ky hop le", async () => {
    const { goi, kho } = fetchGia(new Response(null, { status: 200 }));
    await kho.put(KEY, DATA, "image/webp");
    expect(goi.map((g) => [g.method, g.url, g.body])).toEqual([["PUT", URL_CUA(KEY), DATA]]);
    const hash = await sha256Hex(DATA);
    expect(goi[0].headers).toMatchObject({ "content-type": "image/webp", "x-amz-content-sha256": hash, "x-amz-date": "20260916T080000Z" });
    expect(goi[0].headers.authorization).toContain("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date,");
    await kyDung(goi[0], { "content-type": "image/webp" }, hash);
  });

  it("get co khoang: chuyen tiep Range, ky ca range, tra than cua phan hoi 206", async () => {
    const { goi, kho } = fetchGia(new Response(DATA.slice(2, 6), { status: 206 }));
    const body = await kho.get(KEY_CHO, { start: 2, end: 5 });
    expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(DATA.slice(2, 6));
    expect(goi.map((g) => [g.method, g.url, g.headers.range])).toEqual([["GET", URL_CUA(KEY_CHO), "bytes=2-5"]]);
    await kyDung(goi[0], { range: "bytes=2-5" }, EMPTY_SHA256);
  });

  it("get ca tep khong gui Range; 404 thi null", async () => {
    const { goi, kho } = fetchGia(new Response(DATA, { status: 200 }), new Response("NoSuchKey", { status: 404 }));
    expect(new Uint8Array(await new Response(await kho.get(KEY, null)).arrayBuffer())).toEqual(DATA);
    expect(await kho.get(KEY, null)).toBeNull();
    expect(goi.map((g) => "range" in g.headers)).toEqual([false, false]);
    await kyDung(goi[0], {}, EMPTY_SHA256);
  });

  it("remove: DELETE tung key, bo qua 404", async () => {
    const { goi, kho } = fetchGia(new Response(null, { status: 204 }), new Response(null, { status: 404 }));
    await kho.remove([KEY, KEY_CHO]);
    expect(goi.map((g) => [g.method, g.url]).sort()).toEqual([["DELETE", URL_CUA(KEY)], ["DELETE", URL_CUA(KEY_CHO)]].sort());
    for (const g of goi) await kyDung(g, {}, EMPTY_SHA256);
  });

  it("kho tu choi thi nem loi chi kem phuong thuc va ma HTTP, khong kem khoa hay than phan hoi", async () => {
    const tuChoi = () => new Response(`<Error>${CONFIG.accessKeyId}</Error>`, { status: 403 });
    const { kho } = fetchGia(tuChoi(), tuChoi(), tuChoi());
    for (const lam of [() => kho.put(KEY, DATA, "image/webp"), () => kho.get(KEY, null), () => kho.remove([KEY])]) {
      const loi = await lam().then(() => null, (e: unknown) => (e as Error).message);
      expect(loi).toMatch(/^kho S3 tu choi (PUT|GET|DELETE): HTTP 403$/);
    }
  });

  it("key sai dang thi nem truoc khi goi mang", async () => {
    const { goi, kho } = fetchGia();
    await expect(kho.put("../ngoai.webp", DATA, "image/webp")).rejects.toThrow("key object sai dang");
    await expect(kho.get("cho/anh.webp", null)).rejects.toThrow("key object sai dang");
    await expect(kho.remove([KEY, "../x.webp"])).rejects.toThrow("key object sai dang");
    expect(goi).toEqual([]);
  });

  it("endpoint co tien to duong dan: dia chi object giu nguyen tien to do", async () => {
    const { goi, fetchFn } = ghiLai(new Response(null, { status: 200 }));
    const kho = new S3Store({ ...CONFIG, endpoint: "https://abc.supabase.co/storage/v1/s3" }, fetchFn, () => NOW);
    await kho.put(KEY, DATA, "image/webp");
    expect(goi[0].url).toBe(`https://abc.supabase.co/storage/v1/s3/mqce-media/${KEY}`);
  });

  it("kho bo qua Range va tra ca tep: get nem loi chu khong tra than dai hon khoang", async () => {
    const { kho } = fetchGia(new Response(DATA, { status: 200 }));
    await expect(kho.get(KEY, { start: 2, end: 5 })).rejects.toThrow("bo qua Range");
  });

  /*
   * Truoc khi sua, fetch khong co signal: mot kho khong bao gio tra loi se ghim
   * ca mot lan goi serverless toi khi nen tang tu giet no. Loi bao ra phai noi ro la kho khong tra loi - tuyet doi
   * khong duoc thanh null cua get(), vi null co nghia la "object khong con trong kho", mot huong chan doan khac han.
   */
  it("kho treo khong tra noi header: bo request va nem loi ro, khong bien thanh 'khong co object'", async () => {
    vi.useFakeTimers();
    try {
      // Kho nhan request roi im lang mai. daGui bao luc request da that su di (ky SigV4 xong, dong ho da len lich):
      // chay dong ho truoc thoi diem do thi khong co hen nao de chay va test se treo that.
      let daGui!: () => void;
      const dangCho = new Promise<void>((r) => { daGui = r; });
      const fetchFn: FetchFn = (_url, init) => new Promise((_ok, that) => {
        init.signal?.addEventListener("abort", () => that(new DOMException("aborted", "AbortError")));
        daGui();
      });
      const kho = new S3Store(CONFIG, fetchFn, () => NOW);
      const ket = kho.get(KEY, null).then((r) => `tra ve ${r === null ? "null" : "than"}`, (e: unknown) => (e as Error).message);
      await dangCho;
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await ket).toBe("kho S3 khong tra loi GET trong 15 giay");
    } finally {
      vi.useRealTimers();
    }
  });

  it("403 kem header Date lech qua 15 phut: loi noi them la dong ho lech, van khong lo khoa", async () => {
    const date = new Date(NOW.getTime() + 20 * 60_000).toUTCString();
    const { kho } = fetchGia(new Response(`<Error>${CONFIG.accessKeyId}</Error>`, { status: 403, headers: { date } }));
    const loi = await kho.put(KEY, DATA, "image/webp").then(() => "", (e: unknown) => (e as Error).message);
    expect(loi).toBe("kho S3 tu choi PUT: HTTP 403 (dong ho lech qua 15 phut)");
    expect(loi).not.toContain(CONFIG.secretAccessKey);
  });
});
