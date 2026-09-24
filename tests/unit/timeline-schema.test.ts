import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bookCovers, bookTracks, books, drafts } from "@/server/db/schema";
import { COVERS } from "@/lib/book";
import { YOUTUBE_ID } from "@/lib/youtube";
import type { DocJson } from "@/lib/doc/types";
import { viPham } from "../helpers/db";
import { taoLuot } from "../helpers/round";
import { seedHai } from "../helpers/seed";

const TRONG: DocJson = { type: "doc", content: [{ type: "paragraph" }] };

async function motCuon() {
  const s = await seedHai();
  const [book] = await s.db
    .insert(books)
    .values({ ownerId: s.seat1.id, title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa" })
    .returning();
  return { ...s, book };
}

describe("bang book_covers", () => {
  it("nhan moi bia cua COVERS va tu choi bia ngoai danh sach", async () => {
    const { db, book } = await motCuon();
    for (const cover of COVERS) {
      const roundId = await taoLuot(db, book.id);
      await db.insert(bookCovers).values({ bookId: book.id, roundId, cover });
    }
    expect(await db.select().from(bookCovers)).toHaveLength(COVERS.length);
    const roundId = await taoLuot(db, book.id);
    await viPham(db.insert(bookCovers).values({ bookId: book.id, roundId, cover: "anh-tai-len" as never }), "book_covers_cover");
  });

  it("CHECK book_covers_cover chua dung cac gia tri cua COVERS, cung thu tu", async () => {
    const { db } = await seedHai();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'book_covers_cover'`);
    const def = (res.rows as { def: string }[])[0].def;
    expect([...def.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...COVERS]);
  });

  it("moi luot nhieu nhat mot o bia", async () => {
    const { db, book } = await motCuon();
    const roundId = await taoLuot(db, book.id);
    await db.insert(bookCovers).values({ bookId: book.id, roundId, cover: "nui-xa" });
    await viPham(db.insert(bookCovers).values({ bookId: book.id, roundId, cover: "hoa-dao" }), "book_covers_round_id_unique");
  });

  it("moi cuon nhieu nhat mot o mo dau, nhung hai cuon deu co o mo dau cua minh", async () => {
    const { db, book, seat1 } = await motCuon();
    const [khac] = await db.insert(books).values({ ownerId: seat1.id, title: "Cuốn hai", mode: "chia-se", cover: "chim-bay" }).returning();
    await db.insert(bookCovers).values({ bookId: book.id, roundId: null, cover: "nui-xa" });
    await db.insert(bookCovers).values({ bookId: khac.id, roundId: null, cover: "chim-bay" });
    await viPham(db.insert(bookCovers).values({ bookId: book.id, roundId: null, cover: "hoa-dao" }), "book_covers_mo_dau_idx");
  });

  it("xoa sach thi o bia mat theo; xoa anh bia thi o ve tranh ve san", async () => {
    const { db, book, seat1 } = await motCuon();
    const id = randomUUID();
    await db.execute(sql`insert into media (id, owner_id, book_id, kind, mime, bytes, width, height, store_key)
      values (${id}::uuid, ${seat1.id}::uuid, ${book.id}::uuid, 'bia', 'image/webp', 1024, 1200, 720, ${book.id} || '/' || ${id} || '.webp')`);
    await db.insert(bookCovers).values({ bookId: book.id, roundId: null, cover: "nui-xa", coverMediaId: id });
    await db.execute(sql`delete from media where id = ${id}::uuid`);
    expect((await db.select({ c: bookCovers.coverMediaId }).from(bookCovers)).map((r) => r.c)).toEqual([null]);
    await db.execute(sql`delete from books where id = ${book.id}::uuid`);
    expect(await db.select().from(bookCovers)).toEqual([]);
  });
});

describe("bang book_tracks", () => {
  it("nhan ma 11 ky tu va nhan null (o go nhac), tu choi ma sai dang", async () => {
    const { db, book } = await motCuon();
    for (const youtubeId of ["5qap5aO4i9A", "a-b_c-d_e-f", null]) {
      const roundId = await taoLuot(db, book.id);
      await db.insert(bookTracks).values({ bookId: book.id, roundId, youtubeId });
    }
    const roundId = await taoLuot(db, book.id);
    for (const youtubeId of ["5qap5aO4i9", "5qap5aO4i9AB", "5qap5aO4i9.", "", "https://youtu.be/5qap5aO4i9A"]) {
      await viPham(db.insert(bookTracks).values({ bookId: book.id, roundId, youtubeId }), "book_tracks_youtube_id");
    }
  });

  it("mau cua book_tracks_youtube_id la dung YOUTUBE_ID cua src/lib/youtube.ts", async () => {
    const { db } = await seedHai();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'book_tracks_youtube_id'`);
    expect((res.rows as { def: string }[])[0].def).toContain(`'${YOUTUBE_ID.source}'`);
  });

  it("moi luot nhieu nhat mot o nhac, moi cuon nhieu nhat mot o mo dau", async () => {
    const { db, book } = await motCuon();
    const roundId = await taoLuot(db, book.id);
    await db.insert(bookTracks).values({ bookId: book.id, roundId, youtubeId: "5qap5aO4i9A" });
    await viPham(db.insert(bookTracks).values({ bookId: book.id, roundId, youtubeId: null }), "book_tracks_round_id_unique");
    await db.insert(bookTracks).values({ bookId: book.id, roundId: null, youtubeId: null });
    await viPham(db.insert(bookTracks).values({ bookId: book.id, roundId: null, youtubeId: null }), "book_tracks_mo_dau_idx");
  });
});

describe("bon cot bia va nhac cua ban nhap", () => {
  it("mac dinh la khong co o nao", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: TRONG });
    expect(await db.select({ c: drafts.cover, m: drafts.coverMediaId, y: drafts.youtubeId, d: drafts.dropTrack }).from(drafts))
      .toEqual([{ c: null, m: null, y: null, d: false }]);
  });

  it("anh bia phai di cung mot tranh ve san", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: TRONG });
    await viPham(db.update(drafts).set({ cover: null, coverMediaId: randomUUID() }), "drafts_cover_media");
  });

  it("o go nhac khong di cung mot ma video", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: TRONG });
    await db.update(drafts).set({ dropTrack: true, youtubeId: null });
    await viPham(db.update(drafts).set({ dropTrack: true, youtubeId: "5qap5aO4i9A" }), "drafts_drop_track");
  });

  it("tranh ve san cua nhap chi nhan gia tri trong COVERS", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: TRONG });
    await viPham(db.update(drafts).set({ cover: "anh-tai-len" as never }), "drafts_cover");
  });
});
