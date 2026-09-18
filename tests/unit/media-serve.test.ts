import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { publishDraft } from "@/server/library/drafts";
import type { UploadRecord } from "@/server/media/access";
import { MemoryStore } from "@/server/media/memory";
import { saveUpload } from "@/server/media/save-upload";
import { serveMedia } from "@/server/media/serve";
import type { MediaStore } from "@/server/media/store";
import { mediaStoreKey } from "@/lib/media/key";
import { PEAK_COUNT } from "@/lib/media/kinds";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";

const NOW = new Date();
const SONG = Array.from({ length: PEAK_COUNT }, () => 50);
/** Than tep bat ky: kho khong doc byte, route lay mime tu bang media. */
const TEP = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 251));
const KHONG_TEP = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

async function taiGhiAm(db: TestDb, store: MediaStore, ownerId: string, bookId: string): Promise<string> {
  const record: UploadRecord = { id: randomUUID(), ownerId, bookId, kind: "ghi-am", mime: "audio/webm", bytes: TEP.length, durationMs: 42_000, peaks: SONG };
  if ((await saveUpload(db, store, record, TEP.slice())) !== "saved") throw new Error("khong tai len duoc");
  return record.id;
}

/** Cuon chung co mot to da dang chua mot ghi am; cuon rieng tu co mot ghi am chua dang. */
async function coTep() {
  const s = await haiCuon();
  const store = new MemoryStore();
  const id = await taiGhiAm(s.db, store, s.seat1.id, s.chung);
  const rieng = await taiGhiAm(s.db, store, s.seat1.id, s.rieng);
  const to = { type: "doc" as const, content: [{ type: "ghi-am" as const, attrs: { id, ms: 1, peaks: SONG } }] };
  if (!(await publishDraft(s.db, s.seat1.id, s.chung, [to]))) throw new Error("khong dang duoc");
  return { ...s, store, id, rieng };
}

async function doc(res: Response): Promise<[number, Record<string, string>, Uint8Array]> {
  return [res.status, Object.fromEntries(res.headers), new Uint8Array(await res.arrayBuffer())];
}

describe("serveMedia", () => {
  it("nguoi kia doc to mo: 200, du byte, Content-Type tu bang media va header rieng tu", async () => {
    const s = await coTep();
    expect(await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, null, null, NOW))).toEqual([
      200,
      {
        "accept-ranges": "bytes",
        "cache-control": "private, no-cache",
        "content-disposition": "inline",
        "content-length": "1000",
        "content-type": "audio/webm",
        etag: `"${s.id}"`,
        "referrer-policy": "no-referrer",
        vary: "Cookie",
        "x-content-type-options": "nosniff",
      },
      TEP,
    ]);
  });

  it("Range: mot khoang va hau to la 206 kem Content-Range; khoang ngoai tep la 416", async () => {
    const s = await coTep();
    const [status, headers, body] = await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, "bytes=10-19", null, NOW));
    expect([status, body]).toEqual([206, TEP.slice(10, 20)]);
    expect(headers).toMatchObject({ "content-range": "bytes 10-19/1000", "content-length": "10", "content-type": "audio/webm", "accept-ranges": "bytes" });
    const hauTo = await doc(await serveMedia(s.db, s.store, s.seat1.id, s.id, "bytes=-5", null, NOW));
    expect([hauTo[0], hauTo[1]["content-range"], hauTo[2]]).toEqual([206, "bytes 995-999/1000", TEP.slice(995)]);
    expect(await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, "bytes=1000-", null, NOW))).toEqual([
      416, { ...KHONG_TEP, "accept-ranges": "bytes", "content-range": "bytes */1000" }, new Uint8Array(0),
    ]);
  });

  it("cache rieng tu theo phien: Vary Cookie, khong co max-age duong, If-None-Match khop thi 304 rong", async () => {
    const s = await coTep();
    const etag = `"${s.id}"`;
    const [, headers] = await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, null, null, NOW));
    expect([headers.etag, headers.vary, headers["cache-control"]]).toEqual([etag, "Cookie", "private, no-cache"]);
    expect(headers["cache-control"]).not.toMatch(/max-age=[1-9]/);
    expect(await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, null, etag, NOW))).toEqual([
      304, { "cache-control": "private, no-cache", etag, vary: "Cookie" }, new Uint8Array(0),
    ]);
  });

  it("chua dang nhap, sach rieng tu cua nguoi kia, id khong co hay sai dang: cung mot 404 rong", async () => {
    const s = await coTep();
    const cac = [
      await serveMedia(s.db, s.store, null, s.id, null, null, NOW),
      await serveMedia(s.db, s.store, s.seat2.id, s.rieng, null, null, NOW),
      await serveMedia(s.db, s.store, s.seat2.id, randomUUID(), null, null, NOW),
      await serveMedia(s.db, s.store, s.seat2.id, "khong-phai-uuid", "bytes=0-1", null, NOW),
    ];
    for (const res of cac) expect(await doc(res)).toEqual([404, KHONG_TEP, new Uint8Array(0)]);
    expect((await serveMedia(s.db, s.store, s.seat1.id, s.rieng, null, null, NOW)).status).toBe(200);
  });

  it("mat quyen thi 404 chu khong bao gio 304, du trinh duyet gui dung ETag", async () => {
    const s = await coTep();
    expect(await doc(await serveMedia(s.db, s.store, s.seat2.id, s.rieng, null, `"${s.rieng}"`, NOW))).toEqual([
      404, KHONG_TEP, new Uint8Array(0),
    ]);
  });

  it("kho tat: 503 chi voi nguoi co quyen, nguoi khong co quyen van 404", async () => {
    const s = await coTep();
    expect(await doc(await serveMedia(s.db, null, s.seat2.id, s.id, null, null, NOW))).toEqual([503, KHONG_TEP, new Uint8Array(0)]);
    expect((await serveMedia(s.db, null, s.seat2.id, s.rieng, null, null, NOW)).status).toBe(404);
  });

  it("dong media con ma object mat trong kho: 404 rong", async () => {
    const s = await coTep();
    await s.store.remove([mediaStoreKey(s.chung, s.id, "audio/webm")]);
    expect(await doc(await serveMedia(s.db, s.store, s.seat2.id, s.id, null, null, NOW))).toEqual([404, KHONG_TEP, new Uint8Array(0)]);
  });
});
