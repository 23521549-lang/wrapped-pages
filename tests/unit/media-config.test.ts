import { describe, it, expect } from "vitest";
import { S3_ENV, selectMediaStore, type MediaEnv, type MediaStoreChoice } from "@/lib/media/config";
import { mediaStoreKey, STORE_KEY } from "@/lib/media/key";
import { AUDIO_MIMES, IMAGE_MIMES } from "@/lib/media/kinds";

const TAM = "/tam/mqce-media";
const BI_MAT = "BI-MAT-KHONG-DUOC-IN";
const S3: MediaEnv = {
  MEDIA_S3_ENDPOINT: "https://tai-khoan.r2.cloudflarestorage.com",
  MEDIA_S3_REGION: "auto",
  MEDIA_S3_BUCKET: "mqce-media",
  MEDIA_S3_ACCESS_KEY_ID: "KHOA-TRUY-CAP",
  MEDIA_S3_SECRET_ACCESS_KEY: BI_MAT,
};
const CHON_S3: MediaStoreChoice = {
  kind: "s3",
  config: {
    endpoint: "https://tai-khoan.r2.cloudflarestorage.com", region: "auto", bucket: "mqce-media",
    accessKeyId: "KHOA-TRUY-CAP", secretAccessKey: BI_MAT,
  },
};

/** Thong diep loi cua selectMediaStore voi env nay; khong nem thi ca test do. */
function loiCua(env: MediaEnv): string {
  try {
    selectMediaStore(env, TAM);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("selectMediaStore khong nem loi");
}

describe("selectMediaStore", () => {
  it.each<[string, MediaEnv, MediaStoreChoice]>([
    ["du bien S3, khong o Vercel", S3, CHON_S3],
    ["du bien S3 tren Vercel", { ...S3, VERCEL: "1" }, CHON_S3],
    ["du bien S3 thi thang ca thu muc cuc bo", { ...S3, MEDIA_LOCAL_DIR: "/du-lieu" }, CHON_S3],
    ["khong S3, khong Vercel, co MEDIA_LOCAL_DIR", { MEDIA_LOCAL_DIR: "/du-lieu/media" }, { kind: "local", dir: "/du-lieu/media" }],
    ["khong S3, khong Vercel, khong thu muc: thu muc tam", {}, { kind: "local", dir: TAM }],
    ["khong S3 tren Vercel: tat", { VERCEL: "1" }, { kind: "tat" }],
    ["khong S3 tren Vercel, co MEDIA_LOCAL_DIR van tat", { VERCEL: "1", MEDIA_LOCAL_DIR: "/du-lieu" }, { kind: "tat" }],
    [
      "bien rong hay chi co khoang trang coi nhu khong dat",
      { ...Object.fromEntries(Object.values(S3_ENV).map((name) => [name, " "])), VERCEL: "", MEDIA_LOCAL_DIR: "  " },
      { kind: "local", dir: TAM },
    ],
    [
      "cat khoang trang hai dau va bo gach cheo cuoi",
      { ...S3, MEDIA_S3_ENDPOINT: " https://tai-khoan.r2.cloudflarestorage.com/ ", MEDIA_S3_SECRET_ACCESS_KEY: ` ${BI_MAT} ` },
      CHON_S3,
    ],
    [
      "endpoint co tien to duong dan (cong S3 cua Supabase) thi giu nguyen tien to",
      { ...S3, MEDIA_S3_ENDPOINT: "https://abc.supabase.co/storage/v1/s3/" },
      { kind: "s3", config: { ...CHON_S3.config, endpoint: "https://abc.supabase.co/storage/v1/s3" } },
    ],
  ])("%s", (_ten, env, want) => {
    expect(selectMediaStore(env, TAM)).toEqual(want);
  });

  it.each(Object.values(S3_ENV))("thieu rieng %s la cau hinh hong: nem loi neu ten bien, khong neu gia tri", (name) => {
    const loi = loiCua({ ...S3, [name]: undefined, VERCEL: "1" });
    expect(loi).toContain(name);
    for (const giaTri of Object.values(S3)) expect(loi).not.toContain(giaTri);
  });

  it.each([
    ["http thuong", "http://tai-khoan.r2.cloudflarestorage.com"],
    ["khong phai URL", "tai-khoan.r2.cloudflarestorage.com"],
    ["co ten dang nhap", "https://ai:do@tai-khoan.r2.cloudflarestorage.com"],
    ["co tham so", "https://tai-khoan.r2.cloudflarestorage.com/?x=1"],
  ])("endpoint %s thi nem loi khong lo bi mat", (_ten, endpoint) => {
    const loi = loiCua({ ...S3, MEDIA_S3_ENDPOINT: endpoint });
    expect(loi).toContain(S3_ENV.endpoint);
    expect(loi).not.toContain(BI_MAT);
  });

  it.each(["MQCE", "a", "mqce_media", "-mqce", "mqce/x"])("bucket %s sai luat S3 thi nem loi", (bucket) => {
    const loi = loiCua({ ...S3, MEDIA_S3_BUCKET: bucket });
    expect(loi).toContain(S3_ENV.bucket);
    expect(loi).not.toContain(BI_MAT);
  });
});

describe("key object", () => {
  const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
  const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";

  it("chi gom tien to sach hoac cho, id media va duoi theo mime; moi key dung mau STORE_KEY", () => {
    expect([...IMAGE_MIMES, ...AUDIO_MIMES].map((mime) => mediaStoreKey(BOOK, ID, mime))).toEqual([
      `${BOOK}/${ID}.webp`, `${BOOK}/${ID}.jpg`, `${BOOK}/${ID}.webm`, `${BOOK}/${ID}.m4a`,
    ]);
    expect(mediaStoreKey(null, ID, "image/webp")).toBe(`cho/${ID}.webp`);
    for (const mime of [...IMAGE_MIMES, ...AUDIO_MIMES]) {
      for (const book of [BOOK, null]) expect(STORE_KEY.test(mediaStoreKey(book, ID, mime))).toBe(true);
    }
  });

  it.each([
    ["vuot thu muc", `../${ID}.webp`],
    ["vuot thu muc sau tien to", `cho/../${ID}.webp`],
    ["uuid chu hoa", `cho/${ID.toUpperCase()}.webp`],
    ["duoi la", `cho/${ID}.png`],
    ["chu nguoi dung", "cho/anh-dam-cuoi.webp"],
    ["thieu tien to", `${ID}.webp`],
    ["duong dan tuyet doi", `/cho/${ID}.webp`],
    ["xuong dong o cuoi", `cho/${ID}.webp${String.fromCharCode(10)}`],
  ])("STORE_KEY tu choi %s", (_ten, key) => {
    expect(STORE_KEY.test(key)).toBe(false);
  });
});
