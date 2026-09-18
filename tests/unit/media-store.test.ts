import { afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mediaStoreKey } from "@/lib/media/key";
import { LocalDiskStore } from "@/server/media/local-disk";
import { MemoryStore } from "@/server/media/memory";
import type { MediaStore } from "@/server/media/store";

const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const KEY = mediaStoreKey(BOOK, "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e", "image/webp");
const KEY_CHO = mediaStoreKey(null, "7a2e4c6b-8d0f-4a1c-9e3b-5d7f9b1d3f5a", "audio/webm");
/** Lon hon mot khuc doc cua LocalDiskStore (64 KB), de doc qua nhieu khuc. */
const DATA = new Uint8Array(Array.from({ length: 200_000 }, (_, i) => i % 251));
const KEY_SAI = ["../ngoai.webp", `${BOOK}/../0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e.webp`, "cho/anh-cua-em.webp", ""];

const GOC = await mkdtemp(join(tmpdir(), "mqce-media-test-"));
afterAll(() => rm(GOC, { recursive: true, force: true }));

async function docHet(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array | null> {
  return stream ? new Uint8Array(await new Response(stream).arrayBuffer()) : null;
}

describe.each<[string, () => MediaStore]>([
  ["MemoryStore", () => new MemoryStore()],
  ["LocalDiskStore", () => new LocalDiskStore(join(GOC, randomUUID()))],
])("%s", (_ten, taoKho) => {
  it("put roi get ca tep dung tung byte, ke ca key bia cho gan", async () => {
    const kho = taoKho();
    await kho.put(KEY, DATA, "image/webp");
    await kho.put(KEY_CHO, DATA.slice(0, 10), "audio/webm");
    expect(await docHet(await kho.get(KEY, null))).toEqual(DATA);
    expect(await docHet(await kho.get(KEY_CHO, null))).toEqual(DATA.slice(0, 10));
  });

  it("get mot khoang tinh ca hai dau: dau tep, qua nhieu khuc, dung byte cuoi", async () => {
    const kho = taoKho();
    await kho.put(KEY, DATA, "image/webp");
    expect(await docHet(await kho.get(KEY, { start: 0, end: 9 }))).toEqual(DATA.slice(0, 10));
    expect(await docHet(await kho.get(KEY, { start: 1000, end: 150_000 }))).toEqual(DATA.slice(1000, 150_001));
    expect(await docHet(await kho.get(KEY, { start: DATA.length - 1, end: DATA.length - 1 }))).toEqual(DATA.slice(-1));
  });

  it("key chua co thi null; remove roi thi null; remove key khong ton tai khong loi", async () => {
    const kho = taoKho();
    expect(await kho.get(KEY, null)).toBeNull();
    await kho.put(KEY, DATA, "image/webp");
    await kho.put(KEY_CHO, DATA, "audio/webm");
    await kho.remove([KEY, KEY_CHO]);
    expect([await kho.get(KEY, null), await kho.get(KEY_CHO, { start: 0, end: 1 })]).toEqual([null, null]);
    await expect(kho.remove([KEY])).resolves.toBeUndefined();
  });

  it("huy stream giua chung khong loi, doc lai van du", async () => {
    const kho = taoKho();
    await kho.put(KEY, DATA, "image/webp");
    const reader = (await kho.get(KEY, null))!.getReader();
    await reader.read();
    await reader.cancel();
    expect(await docHet(await kho.get(KEY, null))).toEqual(DATA);
  });

  it("sua mang goc sau khi put khong doi object da luu", async () => {
    const kho = taoKho();
    const ban = DATA.slice(0, 4);
    await kho.put(KEY, ban, "image/webp");
    ban[0] = 99;
    expect(await docHet(await kho.get(KEY, null))).toEqual(DATA.slice(0, 4));
  });

  it.each(KEY_SAI)("tu choi key sai dang %j o put, get va remove", async (key) => {
    const kho = taoKho();
    await expect(kho.put(key, DATA, "image/webp")).rejects.toThrow("key object sai dang");
    await expect(kho.get(key, null)).rejects.toThrow("key object sai dang");
    await expect(kho.remove([KEY, key])).rejects.toThrow("key object sai dang");
  });
});

describe("LocalDiskStore tren dia", () => {
  it("moi object la mot tep dir/tien to/id.duoi; key sai khong ghi gi ra ngoai dir", async () => {
    const dir = join(GOC, randomUUID());
    const kho: MediaStore = new LocalDiskStore(dir);
    await kho.put(KEY, DATA, "image/webp");
    await expect(kho.put("../ngoai.webp", DATA, "image/webp")).rejects.toThrow();
    expect(await readdir(dir, { recursive: true })).toEqual([BOOK, join(BOOK, "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e.webp")]);
    expect((await readdir(GOC)).filter((ten) => ten.endsWith(".webp"))).toEqual([]);
  });
});
