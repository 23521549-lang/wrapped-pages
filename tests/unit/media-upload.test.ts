import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import { AUDIO_MAX_MS, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, MEDIA_MAX_BYTES, PEAK_COUNT, PEAK_MAX } from "@/lib/media/kinds";
import { parseUploadForm, UPLOAD_ERRORS } from "@/lib/media/upload";

// Moi byte viet bang so, khong dung chuoi thoat.
const u16be = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const u24le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
const u32le = (n: number) => [...u24le(n), (n >>> 24) & 0xff];

const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => i % (PEAK_MAX + 1));

/** WebP VP8X kich thuoc that w x h, dai dung total byte (phan du la du lieu chunk). */
function webp(w: number, h: number, total = 30): Uint8Array<ArrayBuffer> {
  const tep = new Uint8Array(total);
  tep.set([
    0x52, 0x49, 0x46, 0x46, ...u32le(total - 8), 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, ...u32le(total - 20), 0x10, 0x00, 0x00, 0x00, ...u24le(w - 1), ...u24le(h - 1),
  ]);
  return tep;
}
/** JPEG SOI, SOF0 kich thuoc w x h, EOI. */
const jpeg = (w: number, h: number) => new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, ...u16be(17), 0x08, ...u16be(h), ...u16be(w), 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]);
/** Header EBML chi co DocType webm. */
const webm = () => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);
/** Hop ftyp M4A 16 byte. */
const mp4 = () => new Uint8Array([0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0x00, 0x00, 0x00, 0x00]);
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

function form(fields: Record<string, string>, file?: Uint8Array<ArrayBuffer> | string): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file !== undefined) fd.set("file", typeof file === "string" ? file : new File([file], "tep"));
  return fd;
}

const GHI_AM = { kind: "ghi-am", book: BOOK, ms: "42000", peaks: JSON.stringify(SONG) };

describe("parseUploadForm", () => {
  it("anh trong trang: mime va kich thuoc that doc tu byte, truong kich thuoc cua trinh duyet bi bo qua", async () => {
    const tep = webp(1200, 900);
    expect(await parseUploadForm(form({ kind: "anh", book: BOOK, w: "1", h: "1" }, tep))).toEqual({
      upload: { kind: "anh", bookId: BOOK, mime: "image/webp", bytes: tep.length, width: 1200, height: 900 },
      body: tep,
    });
  });

  it("bia: cho gan khi khong co cuon hay cuon bo trong, thuoc cuon khi co uuid; WebP va JPEG dung 5:3", async () => {
    expect(await parseUploadForm(form({ kind: "bia" }, jpeg(1200, 720)))).toMatchObject({
      upload: { kind: "bia", bookId: null, mime: "image/jpeg", width: 1200, height: 720 },
    });
    expect(await parseUploadForm(form({ kind: "bia", book: "" }, webp(5, 3)))).toMatchObject({ upload: { bookId: null, width: 5, height: 3 } });
    expect(await parseUploadForm(form({ kind: "bia", book: BOOK }, webp(1200, 720)))).toMatchObject({ upload: { kind: "bia", bookId: BOOK } });
  });

  it("ghi am: WebM hoac MP4, thoi luong va song am tu form da kiem", async () => {
    expect(await parseUploadForm(form({ ...GHI_AM, ms: String(AUDIO_MAX_MS) }, webm()))).toEqual({
      upload: { kind: "ghi-am", bookId: BOOK, mime: "audio/webm", bytes: webm().length, durationMs: AUDIO_MAX_MS, peaks: SONG },
      body: webm(),
    });
    expect(await parseUploadForm(form({ ...GHI_AM, ms: "1" }, mp4()))).toMatchObject({ upload: { mime: "audio/mp4", durationMs: 1 } });
  });

  it("dung tran byte cua loai thi nhan, vuot mot byte thi bao lon qua ma khong can doc tep", async () => {
    expect(await parseUploadForm(form({ kind: "anh", book: BOOK }, webp(10, 10, MEDIA_MAX_BYTES.anh)))).toMatchObject({
      upload: { bytes: MEDIA_MAX_BYTES.anh },
    });
    const vuot: [Record<string, string>, number][] = [
      [{ kind: "anh", book: BOOK }, MEDIA_MAX_BYTES.anh + 1],
      [{ kind: "bia" }, MEDIA_MAX_BYTES.bia + 1],
      [GHI_AM, MEDIA_MAX_BYTES["ghi-am"] + 1],
    ];
    for (const [fields, size] of vuot) {
      expect(await parseUploadForm(form(fields, new Uint8Array(size)))).toEqual({ error: UPLOAD_ERRORS.tooLarge });
    }
  });

  it.each<[string, () => FormData]>([
    ["thieu tep", () => form({ kind: "anh", book: BOOK })],
    ["tep la chuoi", () => form({ kind: "anh", book: BOOK }, "RIFF")],
    ["loai la", () => form({ kind: "video", book: BOOK }, webp(10, 10))],
    ["thieu loai", () => form({ book: BOOK }, webp(10, 10))],
    ["anh thieu cuon", () => form({ kind: "anh" }, webp(10, 10))],
    ["ghi am cuon sai dang", () => form({ ...GHI_AM, book: "khong-phai-uuid" }, webm())],
    ["bia cuon sai dang", () => form({ kind: "bia", book: "cho" }, webp(5, 3))],
    ["tep rong", () => form({ kind: "anh", book: BOOK }, new Uint8Array(0))],
    ["PNG", () => form({ kind: "anh", book: BOOK }, png())],
    ["anh gui duoi dang ghi am", () => form(GHI_AM, webp(10, 10))],
    ["ghi am gui duoi dang anh", () => form({ kind: "anh", book: BOOK }, webm())],
    ["ghi am gui duoi dang bia", () => form({ kind: "bia" }, mp4())],
    ["anh rong vuot tran", () => form({ kind: "anh", book: BOOK }, webp(IMAGE_MAX_WIDTH_PX + 1, 10))],
    ["anh cao vuot tran", () => form({ kind: "anh", book: BOOK }, jpeg(10, IMAGE_MAX_HEIGHT_PX + 1))],
    ["bia khong dung 5:3", () => form({ kind: "bia" }, webp(1200, 721))],
    ["thieu thoi luong", () => form({ kind: "ghi-am", book: BOOK, peaks: GHI_AM.peaks }, webm())],
    ["thoi luong 0", () => form({ ...GHI_AM, ms: "0" }, webm())],
    ["thoi luong vuot tran", () => form({ ...GHI_AM, ms: String(AUDIO_MAX_MS + 1) }, webm())],
    ["thoi luong le", () => form({ ...GHI_AM, ms: "1.5" }, webm())],
    ["thoi luong co khoang trang", () => form({ ...GHI_AM, ms: " 42" }, webm())],
    ["thieu song am", () => form({ kind: "ghi-am", book: BOOK, ms: "42000" }, webm())],
    ["song am khong phai JSON", () => form({ ...GHI_AM, peaks: "[1,2" }, webm())],
    ["song am thieu mot cot", () => form({ ...GHI_AM, peaks: JSON.stringify(SONG.slice(1)) }, webm())],
    ["song am vuot PEAK_MAX", () => form({ ...GHI_AM, peaks: JSON.stringify([PEAK_MAX + 1, ...SONG.slice(1)]) }, webm())],
    ["song am le", () => form({ ...GHI_AM, peaks: JSON.stringify([0.5, ...SONG.slice(1)]) }, webm())],
    ["chuoi song am qua dai", () => form({ ...GHI_AM, peaks: `${" ".repeat(400)}${GHI_AM.peaks}` }, webm())],
  ])("tu choi: %s", async (_ten, fd) => {
    expect(await parseUploadForm(fd())).toEqual({ error: UPLOAD_ERRORS.invalid });
  });
});

describe("tran body cua server action", () => {
  it("la 3mb: du cho tep media lon nhat cong 20 KB phan thua multipart", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("3mb");
    expect(Math.max(...Object.values(MEDIA_MAX_BYTES)) + 20 * 1024).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});
