import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { dang, haiCuon, to } from "../helpers/library";
import { books, drafts, pages } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { saveDraft } from "@/server/library/drafts";
import { pickWriteTarget } from "@/server/library/write-target";

const luc = (iso: string) => new Date(iso);

describe("pickWriteTarget", () => {
  it("chua co cuon nao thi tra null", async () => {
    const { db, seat2 } = await haiCuon();
    expect(await pickWriteTarget(db, seat2.id)).toBeNull();
  });

  it("khong co ban nhap thi chon cuon co hoat dong gan nhat", async () => {
    const { db, seat1, chung, rieng } = await haiCuon();
    await db.update(books).set({ updatedAt: luc("2026-09-01T08:00:00Z") }).where(eq(books.id, chung));
    await db.update(books).set({ updatedAt: luc("2026-09-05T08:00:00Z") }).where(eq(books.id, rieng));
    expect(await pickWriteTarget(db, seat1.id)).toBe(rieng);
  });

  it("dang trang vao cuon cu thi cuon do thanh gan nhat", async () => {
    const { db, seat1, chung, rieng } = await haiCuon();
    await dang(db, seat1.id, chung, "một");
    await db.update(books).set({ updatedAt: luc("2026-09-01T08:00:00Z") }).where(eq(books.id, chung));
    await db.update(books).set({ updatedAt: luc("2026-09-05T08:00:00Z") }).where(eq(books.id, rieng));
    await db.update(pages).set({ publishedAt: luc("2026-09-10T08:00:00Z") }).where(eq(pages.bookId, chung));
    expect(await pickWriteTarget(db, seat1.id)).toBe(chung);
  });

  it("ban nhap thang moi hoat dong khac; ban nhap moi nhat thang ban nhap cu", async () => {
    const { db, seat1, chung, rieng } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("a"), 1);
    await saveDraft(db, seat1.id, rieng, to("b"), 1);
    await db.update(drafts).set({ updatedAt: luc("2026-09-02T08:00:00Z") }).where(eq(drafts.bookId, chung));
    await db.update(drafts).set({ updatedAt: luc("2026-09-01T08:00:00Z") }).where(eq(drafts.bookId, rieng));
    await db.update(books).set({ updatedAt: luc("2026-09-09T08:00:00Z") }).where(eq(books.id, rieng));
    expect(await pickWriteTarget(db, seat1.id)).toBe(chung);
  });

  it("khong bao gio chon sach hay ban nhap cua nguoi kia", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("a"), 1);
    expect(await pickWriteTarget(db, seat2.id)).toBeNull();
    const cuaB = await createBook(db, seat2.id, { title: "Sổ tay chạy bộ", mode: "chia-se", cover: "khom-truc", youtubeId: null, coverMediaId: null });
    expect(await pickWriteTarget(db, seat2.id)).toBe(cuaB);
  });
});
