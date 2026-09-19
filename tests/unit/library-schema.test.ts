import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { viPham } from "../helpers/db";
import { seedHai } from "../helpers/seed";
import { accounts, books, drafts, pages, readMarks } from "@/server/db/schema";
import { COVERS, MODES } from "@/lib/book";
import { YOUTUBE_ID } from "@/lib/youtube";
import type { DocJson } from "@/lib/doc/types";

const DOC: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Mưa đầu tháng chín" }] }] };

async function motCuon() {
  const s = await seedHai();
  const [book] = await s.db
    .insert(books)
    .values({ ownerId: s.seat1.id, title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa" })
    .returning();
  return { ...s, book };
}

describe("bang sach, to, ban nhap va moc doc", () => {
  it("nhan moi che do va moi bia trong src/lib/book.ts", async () => {
    const { db, seat1 } = await seedHai();
    for (const mode of MODES) {
      for (const cover of COVERS) {
        await db.insert(books).values({ ownerId: seat1.id, title: `${mode} ${cover}`, mode, cover });
      }
    }
    expect(await db.select().from(books)).toHaveLength(MODES.length * COVERS.length);
  });

  it("tu choi che do ngoai danh sach", async () => {
    const { db, seat1 } = await seedHai();
    await expect(
      db.insert(books).values({ ownerId: seat1.id, title: "X", mode: "cong-khai" as never, cover: "nui-xa" }),
    ).rejects.toThrow();
  });

  it("tu choi bia ngoai danh sach ve san", async () => {
    const { db, seat1 } = await seedHai();
    await expect(
      db.insert(books).values({ ownerId: seat1.id, title: "X", mode: "chia-se", cover: "anh-tai-len" as never }),
    ).rejects.toThrow();
  });

  it("CHECK books_cover chua dung cac gia tri cua COVERS, cung thu tu, khong thua khong thieu", async () => {
    const { db } = await seedHai();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'books_cover'`);
    const def = (res.rows as { def: string }[])[0].def;
    expect([...def.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...COVERS]);
  });

  it("edited_at nhan null va moc sau published_at, tu choi moc truoc (pages_edited_at)", async () => {
    const { db, book } = await motCuon();
    const T = new Date("2026-09-19T07:05:00.000Z");
    await db.insert(pages).values({ bookId: book.id, position: 1, content: DOC, publishedAt: T });
    const cuaTo = eq(pages.bookId, book.id);
    await db.update(pages).set({ editedAt: null }).where(cuaTo);
    await db.update(pages).set({ editedAt: T }).where(cuaTo);
    await db.update(pages).set({ editedAt: new Date(T.getTime() + 60_000) }).where(cuaTo);
    expect((await db.select({ editedAt: pages.editedAt }).from(pages))[0].editedAt).toEqual(new Date(T.getTime() + 60_000));
    await viPham(db.update(pages).set({ editedAt: new Date(T.getTime() - 1) }).where(cuaTo), "pages_edited_at");
  });

  it("nhac nen: nhan null va ma 11 ky tu, tu choi ma sai dang ngay o database", async () => {
    const { db, book } = await motCuon();
    for (const id of ["5qap5aO4i9A", "a-b_c-d_e-f", null]) {
      await db.update(books).set({ youtubeId: id }).where(eq(books.id, book.id));
    }
    for (const id of ["5qap5aO4i9", "5qap5aO4i9AB", "5qap5aO4i9.", "", "https://youtu.be/5qap5aO4i9A"]) {
      await viPham(db.update(books).set({ youtubeId: id }).where(eq(books.id, book.id)), "books_youtube_id");
    }
  });

  it("mau cua books_youtube_id la dung YOUTUBE_ID cua src/lib/youtube.ts", async () => {
    const { db } = await seedHai();
    const res = await db.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'books_youtube_id'`);
    expect((res.rows as { def: string }[])[0].def).toContain(`'${YOUTUBE_ID.source}'`);
    // Co g hay y thi .test() nho lastIndex giua cac lan goi, lan goi xen ke se sai.
    expect(YOUTUBE_ID.flags).toBe("");
  });

  it("tai khoan moi chua tat nhac nen", async () => {
    const { db } = await seedHai();
    expect((await db.select({ muted: accounts.musicMuted }).from(accounts)).map((r) => r.muted)).toEqual([false, false]);
  });

  it("mot cuon khong co hai to cung vi tri, va vi tri bat dau tu 1", async () => {
    const { db, book } = await motCuon();
    await db.insert(pages).values({ bookId: book.id, position: 1, content: DOC });
    await expect(db.insert(pages).values({ bookId: book.id, position: 1, content: DOC })).rejects.toThrow();
    await expect(db.insert(pages).values({ bookId: book.id, position: 0, content: DOC })).rejects.toThrow();
  });

  it("noi dung jsonb doc lai dung nguyen cau truc", async () => {
    const { db, book } = await motCuon();
    await db.insert(pages).values({ bookId: book.id, position: 1, content: DOC });
    const [row] = await db.select().from(pages);
    expect(row.content).toEqual(DOC);
  });

  it("moi cuon chi co mot ban nhap", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: DOC });
    await expect(db.insert(drafts).values({ bookId: book.id, content: DOC })).rejects.toThrow();
  });

  it("xoa cuon thi mat luon to, ban nhap va moc doc cua cuon do", async () => {
    const { db, book, seat2 } = await motCuon();
    await db.insert(pages).values({ bookId: book.id, position: 1, content: DOC });
    await db.insert(drafts).values({ bookId: book.id, content: DOC });
    await db.insert(readMarks).values({ accountId: seat2.id, bookId: book.id, position: 1 });
    await db.delete(books).where(eq(books.id, book.id));
    expect(await db.select().from(pages)).toHaveLength(0);
    expect(await db.select().from(drafts)).toHaveLength(0);
    expect(await db.select().from(readMarks)).toHaveLength(0);
  });
});
