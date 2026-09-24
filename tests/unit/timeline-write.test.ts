import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { bookCovers, bookTracks, media } from "@/server/db/schema";
import { coversOfBook, newestCover, newestTrack, setCoverEntry, setTrackEntry, tracksOfBook } from "@/server/library/timeline";
import { recordUpload } from "@/server/media/access";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu, MOC_LUOT } from "../helpers/round";

/** Cuon chung cua seat1, co o bia mo dau (do createBook chen) va hai luot. */
async function haiLuot() {
  const s = await haiCuon();
  const l1 = await luotChu(s.db, s.chung, 1, 2);
  const l2 = await luotChu(s.db, s.chung, 3, 4, new Date(MOC_LUOT.getTime() + 60_000));
  return { ...s, l1, l2 };
}

async function taiBia(db: TestDb, ownerId: string, bookId: string | null): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  return id;
}

/** Anh cua mot to, khong phai bia: dung de kiem rang buoc loai cua lockCover. */
async function taiAnh(db: TestDb, ownerId: string, bookId: string): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId, kind: "anh", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  return id;
}

async function cuonCuaAnh(db: TestDb, mediaId: string): Promise<string | null> {
  const [row] = await db.select({ bookId: media.bookId }).from(media).where(eq(media.id, mediaId));
  return row.bookId;
}

describe("setCoverEntry", () => {
  it("dien o cua mot luot dang trong", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l2, { cover: "hoa-dao", coverMediaId: null })).toBe("saved");
    expect((await coversOfBook(s.db, s.chung)).map((o) => [o.roundId, o.cover])).toEqual([[null, "nui-xa"], [s.l2, "hoa-dao"]]);
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "hoa-dao", coverMediaId: null });
  });

  it("sua o mo dau, va sua mot o giua, khong sinh dong thu hai", async () => {
    const s = await haiLuot();
    await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "hoa-dao", coverMediaId: null });
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, null, { cover: "cau-go", coverMediaId: null })).toBe("saved");
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "doi-thong", coverMediaId: null })).toBe("saved");
    expect((await coversOfBook(s.db, s.chung)).map((o) => [o.roundId, o.cover])).toEqual([[null, "cau-go"], [s.l1, "doi-thong"]]);
  });

  it("bo mot o khi cuon con o khac", async () => {
    const s = await haiLuot();
    await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "hoa-dao", coverMediaId: null });
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, null)).toBe("saved");
    expect((await coversOfBook(s.db, s.chung)).map((o) => o.roundId)).toEqual([null]);
  });

  it("bo o bia CUOI CUNG bi tu choi va khong xoa gi", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, null, null)).toBe("last-cover");
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("don mot cho van con trong khong phai la bo o bia cuoi cung", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, null)).toBe("saved");
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("cuon cua nguoi khac tra not-found, y nhu cuon khong ton tai", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat2.id, s.chung, s.l1, { cover: "hoa-dao", coverMediaId: null })).toBe("not-found");
    expect(await setCoverEntry(s.db, s.seat2.id, s.chung, s.l1, null)).toBe("not-found");
    expect(await setCoverEntry(s.db, s.seat2.id, s.chung, null, { cover: "hoa-dao", coverMediaId: null })).toBe("not-found");
    expect((await coversOfBook(s.db, s.chung)).map((o) => [o.roundId, o.cover])).toEqual([[null, "nui-xa"]]);
  });

  it("nguoi khac khong gan duoc anh bia cua chinh minh vao cuon nguoi ta", async () => {
    const s = await haiLuot();
    const cuaKia = await taiBia(s.db, s.seat2.id, null);
    expect(await setCoverEntry(s.db, s.seat2.id, s.chung, s.l1, { cover: "hoa-dao", coverMediaId: cuaKia })).toBe("not-found");
    expect(await cuonCuaAnh(s.db, cuaKia)).toBeNull();
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("luot cua cuon khac, luot khong co that, hay ma sai dang: not-found", async () => {
    const s = await haiLuot();
    const laLuot = await luotChu(s.db, s.rieng, 1, 1);
    for (const r of [laLuot, randomUUID(), "khong-phai-uuid"]) {
      expect(await setCoverEntry(s.db, s.seat1.id, s.chung, r, { cover: "hoa-dao", coverMediaId: null })).toBe("not-found");
    }
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("ma cuon sai dang hay khong co that: not-found", async () => {
    const s = await haiLuot();
    for (const b of [randomUUID(), "khong-phai-uuid"]) {
      expect(await setCoverEntry(s.db, s.seat1.id, b, null, { cover: "hoa-dao", coverMediaId: null })).toBe("not-found");
    }
  });

  it("tranh ve ngoai danh sach bi tu choi truoc khi cham database", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "khong-co-that" as never, coverMediaId: null })).toBe("invalid");
  });

  it("anh bia cua nguoi khac: invalid-cover, khong ghi gi", async () => {
    const s = await haiLuot();
    const cuaKia = await taiBia(s.db, s.seat2.id, null);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: cuaKia })).toBe("invalid-cover");
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
    expect(await cuonCuaAnh(s.db, cuaKia)).toBeNull();
  });

  it("anh bia da thuoc cuon khac cua chinh chu: invalid-cover", async () => {
    const s = await haiLuot();
    const bia = await taiBia(s.db, s.seat1.id, null);
    expect(await setCoverEntry(s.db, s.seat1.id, s.rieng, null, { cover: "chim-bay", coverMediaId: bia })).toBe("saved");
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: bia })).toBe("invalid-cover");
    expect(await cuonCuaAnh(s.db, bia)).toBe(s.rieng);
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("dong media khong phai loai bia: invalid-cover", async () => {
    const s = await haiLuot();
    const anh = await taiAnh(s.db, s.seat1.id, s.chung);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: anh })).toBe("invalid-cover");
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("ma anh khong co that la invalid-cover, ma anh sai dang la invalid", async () => {
    const s = await haiLuot();
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: randomUUID() })).toBe("invalid-cover");
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: "khong-phai-uuid" })).toBe("invalid");
    expect(await coversOfBook(s.db, s.chung)).toHaveLength(1);
  });

  it("anh bia dung duoc thi vao o va duoc gan vao cuon", async () => {
    const s = await haiLuot();
    const bia = await taiBia(s.db, s.seat1.id, null);
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: bia })).toBe("saved");
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "nui-xa", coverMediaId: bia });
    expect(await cuonCuaAnh(s.db, bia)).toBe(s.chung);
  });

  it("anh da thuoc dung cuon nay thi dung lai duoc cho o khac", async () => {
    const s = await haiLuot();
    const bia = await taiBia(s.db, s.seat1.id, null);
    await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: bia });
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l2, { cover: "hoa-dao", coverMediaId: bia })).toBe("saved");
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "hoa-dao", coverMediaId: bia });
  });

  it("bo anh khoi mot o: o giu tranh ve, anh van nam trong kho cua cuon", async () => {
    const s = await haiLuot();
    const bia = await taiBia(s.db, s.seat1.id, null);
    await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: bia });
    expect(await setCoverEntry(s.db, s.seat1.id, s.chung, s.l1, { cover: "nui-xa", coverMediaId: null })).toBe("saved");
    expect(await newestCover(s.db, s.chung)).toEqual({ cover: "nui-xa", coverMediaId: null });
    expect(await cuonCuaAnh(s.db, bia)).toBe(s.chung);
  });
});

describe("setTrackEntry", () => {
  it("dien o nhac cho mot luot, roi sua no", async () => {
    const s = await haiLuot();
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, s.l1, { youtubeId: "5qap5aO4i9A" })).toBe("saved");
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, s.l1, { youtubeId: "dQw4w9WgXcQ" })).toBe("saved");
    expect((await tracksOfBook(s.db, s.chung)).map((o) => [o.roundId, o.youtubeId])).toEqual([[s.l1, "dQw4w9WgXcQ"]]);
  });

  it("o go nhac: cuon dang co nhac tro nen im tu luot do", async () => {
    const s = await haiLuot();
    await setTrackEntry(s.db, s.seat1.id, s.chung, null, { youtubeId: "5qap5aO4i9A" });
    expect(await newestTrack(s.db, s.chung)).toBe("5qap5aO4i9A");
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, s.l2, { youtubeId: null })).toBe("saved");
    expect(await newestTrack(s.db, s.chung)).toBeNull();
    expect(await tracksOfBook(s.db, s.chung)).toHaveLength(2);
  });

  it("bo o nhac cuoi cung van duoc: nhac khong co bat bien nhu bia", async () => {
    const s = await haiLuot();
    await setTrackEntry(s.db, s.seat1.id, s.chung, null, { youtubeId: "5qap5aO4i9A" });
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, null, null)).toBe("saved");
    expect(await tracksOfBook(s.db, s.chung)).toEqual([]);
  });

  it("ma video sai dang bi tu choi truoc khi cham database", async () => {
    const s = await haiLuot();
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, s.l1, { youtubeId: "qua-ngan" })).toBe("invalid");
    expect(await tracksOfBook(s.db, s.chung)).toEqual([]);
  });

  it("cuon cua nguoi khac va luot la deu la not-found", async () => {
    const s = await haiLuot();
    const laLuot = await luotChu(s.db, s.rieng, 1, 1);
    expect(await setTrackEntry(s.db, s.seat2.id, s.chung, s.l1, { youtubeId: "5qap5aO4i9A" })).toBe("not-found");
    expect(await setTrackEntry(s.db, s.seat2.id, s.chung, null, null)).toBe("not-found");
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, laLuot, { youtubeId: "5qap5aO4i9A" })).toBe("not-found");
    expect(await tracksOfBook(s.db, s.chung)).toEqual([]);
  });

  it("ma cuon hay ma luot sai dang: not-found", async () => {
    const s = await haiLuot();
    expect(await setTrackEntry(s.db, s.seat1.id, "khong-phai-uuid", null, { youtubeId: "5qap5aO4i9A" })).toBe("not-found");
    expect(await setTrackEntry(s.db, s.seat1.id, s.chung, "khong-phai-uuid", { youtubeId: "5qap5aO4i9A" })).toBe("not-found");
    expect(await tracksOfBook(s.db, s.chung)).toEqual([]);
  });

  it("moi luot van chi mot o nhac sau nhieu lan sua", async () => {
    const s = await haiLuot();
    for (const y of ["5qap5aO4i9A", "dQw4w9WgXcQ", null]) {
      await setTrackEntry(s.db, s.seat1.id, s.chung, s.l1, { youtubeId: y });
    }
    expect(await s.db.select().from(bookTracks).where(eq(bookTracks.bookId, s.chung))).toHaveLength(1);
    expect(await s.db.select().from(bookCovers).where(eq(bookCovers.bookId, s.chung))).toHaveLength(1);
  });
});
