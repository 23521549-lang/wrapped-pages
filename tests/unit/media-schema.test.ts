import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accounts, bookCovers, books, media } from "@/server/db/schema";
import { mediaStoreKey, STORE_KEY } from "@/lib/media/key";
import {
  AUDIO_MAX_MS, AUDIO_MIMES, IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX, IMAGE_MIMES, MEDIA_KINDS, MEDIA_MAX_BYTES, PEAK_COUNT, PEAK_MAX,
} from "@/lib/media/kinds";
import { viPham, type TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";

type MediaInsert = typeof media.$inferInsert;
type Bo = Awaited<ReturnType<typeof haiCuon>>;

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7a2e4c6b-8d0f-4a1c-9e3b-5d7f9b1d3f5a";
const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => i % (PEAK_MAX + 1));

/** Hang dung hinh cua tung loai ghi thang vao bang, de moi ca chi lam sai dung mot luat. */
const hangAnh = (s: Bo, id = ID): MediaInsert => ({
  id, ownerId: s.seat1.id, bookId: s.chung, kind: "anh", mime: "image/webp", bytes: 1000, width: 1200, height: 900,
  storeKey: mediaStoreKey(s.chung, id, "image/webp"),
});
const hangGhiAm = (s: Bo, id = ID): MediaInsert => ({
  id, ownerId: s.seat1.id, bookId: s.chung, kind: "ghi-am", mime: "audio/webm", bytes: 1000, durationMs: 42_000, peaks: SONG,
  storeKey: mediaStoreKey(s.chung, id, "audio/webm"),
});
const hangBia = (s: Bo, id = ID): MediaInsert => ({
  id, ownerId: s.seat1.id, bookId: null, kind: "bia", mime: "image/jpeg", bytes: 1000, width: 1200, height: 720,
  storeKey: mediaStoreKey(null, id, "image/jpeg"),
});

async function dinhNghia(db: TestDb, rangBuoc: string): Promise<string> {
  const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${rangBuoc}`);
  return (res.rows as { def: string }[])[0].def;
}

describe("bang media", () => {
  it("danh sach loai trong media_kind khop dung MEDIA_KINDS, ca thu tu", async () => {
    const { db } = await haiCuon();
    expect((await dinhNghia(db, "media_kind")).match(/'[a-z-]+'/g)).toEqual(MEDIA_KINDS.map((k) => `'${k}'`));
  });

  it("mime trong media_anh khop IMAGE_MIMES, trong media_ghi_am khop AUDIO_MIMES, ca thu tu", async () => {
    const { db } = await haiCuon();
    const mime = /'[a-z]+[/][a-z0-9]+'/g;
    expect((await dinhNghia(db, "media_anh")).match(mime)).toEqual(IMAGE_MIMES.map((m) => `'${m}'`));
    expect((await dinhNghia(db, "media_ghi_am")).match(mime)).toEqual(AUDIO_MIMES.map((m) => `'${m}'`));
  });

  it("mau cua media_store_key la dung STORE_KEY cua src/lib/media/key.ts", async () => {
    const { db } = await haiCuon();
    expect(await dinhNghia(db, "media_store_key")).toContain(`'${STORE_KEY.source}'`);
    expect(STORE_KEY.flags).toBe("");
  });

  it("khong co cot chu tu do: cot text chi co kind, mime va store_key", () => {
    const cols = getTableConfig(media).columns;
    expect(cols.map((c) => c.name).sort()).toEqual(
      ["book_id", "bytes", "created_at", "duration_ms", "height", "id", "kind", "mime", "owner_id", "peaks", "store_key", "width"],
    );
    expect(cols.filter((c) => c.getSQLType() === "text").map((c) => c.name).sort()).toEqual(["kind", "mime", "store_key"]);
  });

  it("nhan hang dung hinh cua ca ba loai, ke ca dung tung tran cua src/lib/media/kinds.ts", async () => {
    const s = await haiCuon();
    const tran = [
      { ...hangAnh(s), bytes: MEDIA_MAX_BYTES.anh, width: IMAGE_MAX_WIDTH_PX, height: IMAGE_MAX_HEIGHT_PX, mime: "image/jpeg" as const, storeKey: mediaStoreKey(s.chung, ID, "image/jpeg") },
      { ...hangGhiAm(s, ID_2), bytes: MEDIA_MAX_BYTES["ghi-am"], durationMs: AUDIO_MAX_MS, peaks: SONG.map(() => PEAK_MAX), mime: "audio/mp4" as const, storeKey: mediaStoreKey(s.chung, ID_2, "audio/mp4") },
      { ...hangBia(s, "3c5e7a9b-1d2f-4b6c-8a0e-2c4e6a8b0d1f"), bytes: MEDIA_MAX_BYTES.bia },
      { ...hangBia(s, "9e1b3d5f-7a2c-4e6b-8d0f-1a3c5e7b9d2f"), bookId: s.rieng, width: 5, height: 3, storeKey: mediaStoreKey(s.rieng, "9e1b3d5f-7a2c-4e6b-8d0f-1a3c5e7b9d2f", "image/jpeg") },
    ];
    await s.db.insert(media).values(tran);
    expect((await s.db.select({ kind: media.kind }).from(media)).map((r) => r.kind).sort()).toEqual(["anh", "bia", "bia", "ghi-am"]);
  });

  /** Moi ca chi lam hang dung hinh sai dung mot luat. */
  type Sua = [string, (s: Bo) => MediaInsert, string];

  it.each<Sua>([
    ["loai la", (s) => ({ ...hangAnh(s), kind: "video" as never }), "media_kind"],
    ["anh khong gan sach", (s) => ({ ...hangAnh(s), bookId: null }), "media_sach"],
    ["ghi am khong gan sach", (s) => ({ ...hangGhiAm(s), bookId: null }), "media_sach"],
    ["tep 0 byte", (s) => ({ ...hangAnh(s), bytes: 0 }), "media_bytes"],
    ["anh vuot tran byte", (s) => ({ ...hangAnh(s), bytes: MEDIA_MAX_BYTES.anh + 1 }), "media_bytes"],
    ["bia vuot tran byte", (s) => ({ ...hangBia(s), bytes: MEDIA_MAX_BYTES.bia + 1 }), "media_bytes"],
    ["ghi am vuot tran byte", (s) => ({ ...hangGhiAm(s), bytes: MEDIA_MAX_BYTES["ghi-am"] + 1 }), "media_bytes"],
    ["anh mang mime am thanh", (s) => ({ ...hangAnh(s), mime: "audio/webm" }), "media_anh"],
    ["anh PNG", (s) => ({ ...hangAnh(s), mime: "image/png" as never }), "media_anh"],
    ["anh thieu chieu rong", (s) => ({ ...hangAnh(s), width: null }), "media_anh"],
    ["anh thieu chieu cao", (s) => ({ ...hangAnh(s), height: null }), "media_anh"],
    ["anh rong 0", (s) => ({ ...hangAnh(s), width: 0 }), "media_anh"],
    ["anh rong vuot tran", (s) => ({ ...hangAnh(s), width: IMAGE_MAX_WIDTH_PX + 1 }), "media_anh"],
    ["anh cao vuot tran", (s) => ({ ...hangAnh(s), height: IMAGE_MAX_HEIGHT_PX + 1 }), "media_anh"],
    ["anh co thoi luong", (s) => ({ ...hangAnh(s), durationMs: 1 }), "media_anh"],
    ["anh co song am", (s) => ({ ...hangAnh(s), peaks: SONG }), "media_anh"],
    ["bia khong dung 5:3", (s) => ({ ...hangBia(s), height: 721 }), "media_bia"],
    ["ghi am mang mime anh", (s) => ({ ...hangGhiAm(s), mime: "image/webp" }), "media_ghi_am"],
    ["ghi am co kich thuoc", (s) => ({ ...hangGhiAm(s), width: 10, height: 10 }), "media_ghi_am"],
    ["ghi am thieu thoi luong", (s) => ({ ...hangGhiAm(s), durationMs: null }), "media_ghi_am"],
    ["ghi am 0 ms", (s) => ({ ...hangGhiAm(s), durationMs: 0 }), "media_ghi_am"],
    ["ghi am dai hon tran", (s) => ({ ...hangGhiAm(s), durationMs: AUDIO_MAX_MS + 1 }), "media_ghi_am"],
    ["ghi am thieu song am", (s) => ({ ...hangGhiAm(s), peaks: null }), "media_ghi_am"],
    ["song am thieu mot cot", (s) => ({ ...hangGhiAm(s), peaks: SONG.slice(1) }), "media_ghi_am"],
    ["song am khong phai mang", (s) => ({ ...hangGhiAm(s), peaks: { cot: 1 } as never }), "media_ghi_am"],
    ["song am co so am", (s) => ({ ...hangGhiAm(s), peaks: [-1, ...SONG.slice(1)] }), "media_ghi_am"],
    ["song am vuot PEAK_MAX", (s) => ({ ...hangGhiAm(s), peaks: [PEAK_MAX + 1, ...SONG.slice(1)] }), "media_ghi_am"],
    ["song am co so le", (s) => ({ ...hangGhiAm(s), peaks: [1.5, ...SONG.slice(1)] }), "media_ghi_am"],
    ["song am co chuoi", (s) => ({ ...hangGhiAm(s), peaks: ["5", ...SONG.slice(1)] as never }), "media_ghi_am"],
    ["key co chu nguoi dung", (s) => ({ ...hangAnh(s), storeKey: `${s.chung}/anh-dam-cuoi.webp` }), "media_store_key"],
    ["key vuot thu muc", (s) => ({ ...hangAnh(s), storeKey: `../${ID}.webp` }), "media_store_key"],
  ])("tu choi: %s", async (_ten, hang, rangBuoc) => {
    const s = await haiCuon();
    await viPham(s.db.insert(media).values(hang(s)), rangBuoc);
  });

  it("hai media khong trung key object", async () => {
    const s = await haiCuon();
    await s.db.insert(media).values(hangAnh(s));
    await viPham(s.db.insert(media).values({ ...hangAnh(s, ID_2), storeKey: hangAnh(s).storeKey }), "media_store_key_unique");
  });

  it("o bia moi tao chua co anh; xoa media dang nam trong mot o bia thi o do ve tranh ve san", async () => {
    const s = await haiCuon();
    expect((await s.db.select({ c: bookCovers.coverMediaId }).from(bookCovers)).map((r) => r.c)).toEqual([null, null]);
    await s.db.insert(media).values({ ...hangBia(s), bookId: s.chung, storeKey: mediaStoreKey(s.chung, ID, "image/jpeg") });
    await s.db.update(bookCovers).set({ coverMediaId: ID }).where(eq(bookCovers.bookId, s.chung));
    await s.db.delete(media).where(eq(media.id, ID));
    expect((await s.db.select({ cover: bookCovers.cover, c: bookCovers.coverMediaId }).from(bookCovers).where(eq(bookCovers.bookId, s.chung)))).toEqual([{ cover: "nui-xa", c: null }]);
  });

  it("xoa sach thi xoa media cua sach, bia cho gan con lai; xoa tai khoan thi xoa het media cua ho", async () => {
    const s = await haiCuon();
    await s.db.insert(media).values([hangAnh(s), hangBia(s, ID_2)]);
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect((await s.db.select({ id: media.id }).from(media)).map((r) => r.id)).toEqual([ID_2]);
    await s.db.delete(accounts).where(eq(accounts.id, s.seat1.id));
    expect(await s.db.select().from(media)).toEqual([]);
  });

  it("o bia chi tro toi dong media co that", async () => {
    const s = await haiCuon();
    await viPham(
      s.db.update(bookCovers).set({ coverMediaId: ID }).where(eq(bookCovers.bookId, s.chung)),
      "book_covers_cover_media_id_media_id_fk",
    );
  });
});
