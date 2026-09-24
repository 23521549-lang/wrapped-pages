import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { books, media, mediaObjects, mediaSweeps } from "@/server/db/schema";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { setCoverEntry } from "@/server/library/timeline";
import type { UploadRecord } from "@/server/media/access";
import { MemoryStore } from "@/server/media/memory";
import { saveUpload } from "@/server/media/save-upload";
import type { MediaStore } from "@/server/media/store";
import { MEDIA_ORPHAN_MS, MEDIA_SWEEP_BATCH, MEDIA_SWEEP_INTERVAL_MS, sweepMedia } from "@/server/media/sweep";
import type { DocJson } from "@/lib/doc/types";
import { mediaStoreKey, STORE_KEY } from "@/lib/media/key";
import { MEDIA_MAX_BYTES, MEDIA_TOTAL_MAX_BYTES } from "@/lib/media/kinds";
import { viPham, type TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";

const TEP = new Uint8Array([1, 2, 3, 4]);
const GIO = 60 * 60_000;
/** Dong media va so cai lay gio cua database luc ghi, nen moc don tinh tu gio that. */
const sau = (ms: number) => new Date(Date.now() + ms);
const QUA_HAN = MEDIA_ORPHAN_MS + GIO;
const CON_HAN = MEDIA_ORPHAN_MS - GIO;

type Tep = { id: string; key: string };

async function tai(db: TestDb, store: MediaStore, record: UploadRecord): Promise<Tep> {
  expect(await saveUpload(db, store, record, TEP.slice())).toBe("saved");
  return { id: record.id, key: mediaStoreKey(record.bookId, record.id, record.mime) };
}

/** Do bang media toi dung soDong * MEDIA_MAX_BYTES.anh byte bang mot cau insert, de thu tran tong ma khong ghi kho. */
async function doDay(db: TestDb, ownerId: string, bookId: string, soDong: number): Promise<void> {
  await db.execute(sql`
    insert into media (id, owner_id, book_id, kind, mime, bytes, width, height, store_key)
    select u.id, ${ownerId}::uuid, ${bookId}::uuid, 'anh', 'image/webp', ${MEDIA_MAX_BYTES.anh}::int, 1200, 900,
      ${bookId}::text || '/' || u.id || '.webp'
    from (select gen_random_uuid() as id from generate_series(1, ${soDong}::int)) u
  `);
}
const taiAnh = (db: TestDb, store: MediaStore, ownerId: string, bookId: string) =>
  tai(db, store, { id: randomUUID(), ownerId, bookId, kind: "anh", mime: "image/webp", bytes: TEP.length, width: 1200, height: 900 });
const taiBia = (db: TestDb, store: MediaStore, ownerId: string, bookId: string | null) =>
  tai(db, store, { id: randomUUID(), ownerId, bookId, kind: "bia", mime: "image/jpeg", bytes: TEP.length, width: 1200, height: 720 });

/** Dong media con khong va object con trong kho khong. */
async function conLai(db: TestDb, store: MediaStore, tep: Tep): Promise<[boolean, boolean]> {
  const rows = await db.select({ id: media.id }).from(media).where(eq(media.id, tep.id));
  return [rows.length === 1, (await store.get(tep.key, null)) !== null];
}
const khoiAnh = (id: string): DocJson => ({ type: "doc", content: [{ type: "anh", attrs: { id, w: 1, h: 1 } }] });

describe("saveUpload", () => {
  it("ghi so cai, put vao kho roi ghi dong media; cuon cua nguoi kia thi khong ghi gi", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const tep = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await s.db.select({ k: mediaObjects.storeKey }).from(mediaObjects)).toEqual([{ k: tep.key }]);
    expect(await conLai(s.db, store, tep)).toEqual([true, true]);
    const id = randomUUID();
    const record: UploadRecord = { id, ownerId: s.seat2.id, bookId: s.chung, kind: "anh", mime: "image/webp", bytes: TEP.length, width: 1, height: 1 };
    expect(await saveUpload(s.db, store, record, TEP.slice())).toBe("not-found");
    expect(await s.db.select({ k: mediaObjects.storeKey }).from(mediaObjects)).toEqual([{ k: tep.key }]);
    expect(await store.get(mediaStoreKey(s.chung, id, "image/webp"), null)).toBeNull();
  });

  it("kho tu choi put: loi noi len, key van nam trong so cai, khong co dong media", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const hong: MediaStore = {
      put: async () => {
        throw new Error("kho hong");
      },
      get: (key, range) => store.get(key, range),
      remove: (keys) => store.remove(keys),
    };
    const record: UploadRecord = { id: randomUUID(), ownerId: s.seat1.id, bookId: null, kind: "bia", mime: "image/webp", bytes: TEP.length, width: 5, height: 3 };
    await expect(saveUpload(s.db, hong, record, TEP.slice())).rejects.toThrow("kho hong");
    expect(await s.db.select({ k: mediaObjects.storeKey }).from(mediaObjects)).toEqual([{ k: mediaStoreKey(null, record.id, "image/webp") }]);
    expect(await s.db.select().from(media)).toEqual([]);
  });

  it("tong byte cham dung MEDIA_TOTAL_MAX_BYTES thi van ghi", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    await doDay(s.db, s.seat1.id, s.chung, MEDIA_TOTAL_MAX_BYTES / MEDIA_MAX_BYTES.anh - 1);
    const record: UploadRecord = { id: randomUUID(), ownerId: s.seat1.id, bookId: s.chung, kind: "anh", mime: "image/webp", bytes: MEDIA_MAX_BYTES.anh, width: 1200, height: 900 };
    expect(await saveUpload(s.db, store, record, TEP.slice())).toBe("saved");
    expect(await store.get(mediaStoreKey(s.chung, record.id, "image/webp"), null)).not.toBeNull();
  });

  it("vuot MEDIA_TOTAL_MAX_BYTES mot byte: tra full, khong ghi so cai, khong cham kho", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    await doDay(s.db, s.seat1.id, s.chung, MEDIA_TOTAL_MAX_BYTES / MEDIA_MAX_BYTES.anh);
    const record: UploadRecord = { id: randomUUID(), ownerId: s.seat1.id, bookId: s.chung, kind: "anh", mime: "image/webp", bytes: 1, width: 1, height: 1 };
    expect(await saveUpload(s.db, store, record, TEP.slice())).toBe("full");
    expect(await s.db.select().from(mediaObjects)).toEqual([]);
    expect(await store.get(mediaStoreKey(s.chung, record.id, "image/webp"), null)).toBeNull();
  });
});

describe("sweepMedia", () => {
  it("chan tan suat bang moc chung: trong MEDIA_SWEEP_INTERVAL_MS thi null va khong xoa gi, dung moc thi don", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const t = sau(QUA_HAN);
    expect(await sweepMedia(s.db, store, t)).toEqual({ media: 0, objects: 0 });
    const tep = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await sweepMedia(s.db, store, new Date(t.getTime() + MEDIA_SWEEP_INTERVAL_MS - 1))).toBeNull();
    expect(await conLai(s.db, store, tep)).toEqual([true, true]);
    const moc = new Date(t.getTime() + MEDIA_SWEEP_INTERVAL_MS);
    expect(await sweepMedia(s.db, store, moc)).toEqual({ media: 1, objects: 1 });
    expect(await conLai(s.db, store, tep)).toEqual([false, false]);
    expect(await s.db.select().from(mediaSweeps)).toEqual([{ id: 1, ranAt: moc }]);
  });

  it("media khong ai tham chieu: con han thi giu, qua han thi xoa dong, object va so cai", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const tep = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await sweepMedia(s.db, store, sau(CON_HAN))).toEqual({ media: 0, objects: 0 });
    expect(await conLai(s.db, store, tep)).toEqual([true, true]);
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 1, objects: 1 });
    expect(await conLai(s.db, store, tep)).toEqual([false, false]);
    expect(await s.db.select().from(mediaObjects)).toEqual([]);
  });

  it("media con duoc tham chieu thi khong bao gio bi don: trong nhap, trong to da dang, la bia cua sach", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const trongNhap = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, khoiAnh(trongNhap.id), 1)).toBeInstanceOf(Date);
    const daDang = await taiAnh(s.db, store, s.seat1.id, s.rieng);
    expect(await publishDraft(s.db, s.seat1.id, s.rieng, [khoiAnh(daDang.id)])).not.toBeNull();
    const bia = await taiBia(s.db, store, s.seat1.id, s.chung);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, null, { cover: "nui-xa", coverMediaId: bia.id })).toBe("saved");
    // Neo TAM: luat don rac con hoi cot bia cu cua books, trong khi duong ghi bia that su chi con la o cua dong thoi
    // gian. Xoa dong nay ngay khi luat don rac doc book_covers.
    await s.db.update(books).set({ coverMediaId: bia.id }).where(eq(books.id, s.chung));
    const rac = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 1, objects: 1 });
    for (const giu of [trongNhap, daDang, bia]) expect(await conLai(s.db, store, giu)).toEqual([true, true]);
    expect(await conLai(s.db, store, rac)).toEqual([false, false]);
  });

  it("bia cho gan: con han thi giu, qua han thi bi don", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const bia = await taiBia(s.db, store, s.seat1.id, null);
    expect(await sweepMedia(s.db, store, sau(CON_HAN))).toEqual({ media: 0, objects: 0 });
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 1, objects: 1 });
    expect(await conLai(s.db, store, bia)).toEqual([false, false]);
  });

  it("sach bi xoa: dong media mat theo cascade, object tim lai qua so cai va bi xoa khi qua han", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const tep = await taiAnh(s.db, store, s.seat1.id, s.chung);
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect(await conLai(s.db, store, tep)).toEqual([false, true]);
    expect(await sweepMedia(s.db, store, sau(CON_HAN))).toEqual({ media: 0, objects: 0 });
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 0, objects: 1 });
    expect(await conLai(s.db, store, tep)).toEqual([false, false]);
    expect(await s.db.select().from(mediaObjects)).toEqual([]);
  });

  it("put xong ma khong ghi duoc dong media: object trong so cai van bi xoa khi qua han", async () => {
    const s = await haiCuon();
    const store: MediaStore = new MemoryStore();
    const key = mediaStoreKey(s.chung, randomUUID(), "audio/webm");
    await s.db.insert(mediaObjects).values({ storeKey: key });
    await store.put(key, TEP.slice(), "audio/webm");
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 0, objects: 1 });
    expect(await store.get(key, null)).toBeNull();
  });

  it("moi lan don xoa toi da MEDIA_SWEEP_BATCH object, lan sau xoa tiep phan con lai", async () => {
    const s = await haiCuon();
    const store: MediaStore = new MemoryStore();
    const keys = Array.from({ length: MEDIA_SWEEP_BATCH + 1 }, () => mediaStoreKey(null, randomUUID(), "image/webp"));
    await s.db.insert(mediaObjects).values(keys.map((storeKey) => ({ storeKey })));
    await Promise.all(keys.map((key) => store.put(key, TEP.slice(), "image/webp")));
    expect(await sweepMedia(s.db, store, sau(QUA_HAN))).toEqual({ media: 0, objects: MEDIA_SWEEP_BATCH });
    expect(await s.db.select().from(mediaObjects)).toHaveLength(1);
    expect(await sweepMedia(s.db, store, sau(QUA_HAN + MEDIA_SWEEP_INTERVAL_MS))).toEqual({ media: 0, objects: 1 });
    expect(await s.db.select().from(mediaObjects)).toEqual([]);
  });
});

describe("bang so cai va moc don", () => {
  it("so cai chi nhan key dung mau STORE_KEY; moc don chi co dong id = 1", async () => {
    const s = await haiCuon();
    const res = await s.db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'media_objects_store_key'`);
    expect((res.rows as { def: string }[])[0].def).toContain(`'${STORE_KEY.source}'`);
    await viPham(s.db.insert(mediaObjects).values({ storeKey: "cho/anh-dam-cuoi.webp" }), "media_objects_store_key");
    await viPham(s.db.insert(mediaSweeps).values({ id: 2, ranAt: new Date() }), "media_sweeps_one");
  });
});
