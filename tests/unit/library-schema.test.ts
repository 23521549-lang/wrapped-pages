import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { viPham } from "../helpers/db";
import { taoLuot } from "../helpers/round";
import { seedHai } from "../helpers/seed";
import { accounts, books, drafts, pages, readSheets, rounds } from "@/server/db/schema";
import { MODES } from "@/lib/book";
import type { DocJson } from "@/lib/doc/types";

const DOC: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Mưa đầu tháng chín" }] }] };

async function motCuon() {
  const s = await seedHai();
  const [book] = await s.db
    .insert(books)
    .values({ ownerId: s.seat1.id, title: "Chuyện chưa kể", mode: "chia-se" })
    .returning();
  return { ...s, book };
}

// Bia va nhac khong con o bang books: cac luat cua chung duoc kiem o timeline-schema.test.ts.
describe("bang sach, to, ban nhap va moc doc", () => {
  it("nhan moi che do trong src/lib/book.ts", async () => {
    const { db, seat1 } = await seedHai();
    for (const mode of MODES) {
      await db.insert(books).values({ ownerId: seat1.id, title: mode, mode });
    }
    expect(await db.select().from(books)).toHaveLength(MODES.length);
  });

  it("tu choi che do ngoai danh sach", async () => {
    const { db, seat1 } = await seedHai();
    await expect(
      db.insert(books).values({ ownerId: seat1.id, title: "X", mode: "cong-khai" as never }),
    ).rejects.toThrow();
  });

  it("edited_at cua luot nhan null va moc sau published_at, tu choi moc truoc (rounds_edited_at)", async () => {
    const { db, book } = await motCuon();
    const T = new Date("2026-09-19T07:05:00.000Z");
    const id = await taoLuot(db, book.id, T);
    const cuaLuot = eq(rounds.id, id);
    await db.update(rounds).set({ editedAt: null }).where(cuaLuot);
    await db.update(rounds).set({ editedAt: T }).where(cuaLuot);
    await db.update(rounds).set({ editedAt: new Date(T.getTime() + 60_000) }).where(cuaLuot);
    expect((await db.select({ editedAt: rounds.editedAt }).from(rounds))[0].editedAt).toEqual(new Date(T.getTime() + 60_000));
    await viPham(db.update(rounds).set({ editedAt: new Date(T.getTime() - 1) }).where(cuaLuot), "rounds_edited_at");
  });

  it("moi to phai thuoc mot luot co that", async () => {
    const { db, book } = await motCuon();
    await expect(db.execute(sql`insert into pages (book_id, position, content) values (${book.id}, 1, ${JSON.stringify(DOC)}::jsonb)`)).rejects.toThrow();
    await expect(db.insert(pages).values({ bookId: book.id, roundId: "00000000-0000-4000-8000-000000000000", position: 1, content: DOC })).rejects.toThrow();
  });

  it("tai khoan moi chua tat nhac nen", async () => {
    const { db } = await seedHai();
    expect((await db.select({ muted: accounts.musicMuted }).from(accounts)).map((r) => r.muted)).toEqual([false, false]);
  });

  it("mot cuon khong co hai to cung vi tri, va vi tri bat dau tu 1", async () => {
    const { db, book } = await motCuon();
    const roundId = await taoLuot(db, book.id);
    await db.insert(pages).values({ bookId: book.id, roundId, position: 1, content: DOC });
    await expect(db.insert(pages).values({ bookId: book.id, roundId, position: 1, content: DOC })).rejects.toThrow();
    await expect(db.insert(pages).values({ bookId: book.id, roundId, position: 0, content: DOC })).rejects.toThrow();
  });

  it("noi dung jsonb doc lai dung nguyen cau truc", async () => {
    const { db, book } = await motCuon();
    const roundId = await taoLuot(db, book.id);
    await db.insert(pages).values({ bookId: book.id, roundId, position: 1, content: DOC });
    const [row] = await db.select().from(pages);
    expect(row.content).toEqual(DOC);
  });

  it("moi cuon chi co mot ban nhap", async () => {
    const { db, book } = await motCuon();
    await db.insert(drafts).values({ bookId: book.id, content: DOC });
    await expect(db.insert(drafts).values({ bookId: book.id, content: DOC })).rejects.toThrow();
  });

  it("xoa cuon thi mat luon to, ban nhap va cac to da xem cua cuon do", async () => {
    const { db, book, seat2 } = await motCuon();
    const roundId = await taoLuot(db, book.id);
    await db.insert(pages).values({ bookId: book.id, roundId, position: 1, content: DOC });
    await db.insert(drafts).values({ bookId: book.id, content: DOC });
    await db.insert(readSheets).values({ accountId: seat2.id, bookId: book.id, position: 1 });
    await db.delete(books).where(eq(books.id, book.id));
    expect(await db.select().from(pages)).toHaveLength(0);
    expect(await db.select().from(rounds)).toHaveLength(0);
    expect(await db.select().from(drafts)).toHaveLength(0);
    expect(await db.select().from(readSheets)).toHaveLength(0);
  });
});
