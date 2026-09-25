import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { media } from "@/server/db/schema";
import { recordUpload } from "@/server/media/access";
import { khoBia } from "@/server/media/cover";
import { haiCuon } from "../helpers/library";
import type { TestDb } from "../helpers/db";

/**
 * Kho anh bia cua mot cuon la moi dong media loai bia dang thuoc cuon do. Yeu cau cua chu du an: tai anh len la khong
 * gioi han va anh cu khong bao gio bi anh moi the cho, ke ca khi khong o nao dang chon no. Tep nay la cong giu luat do.
 */

/**
 * Them mot anh bia vao mot cuon voi moc tai len cho truoc. media.created_at la defaultNow() nen may dong chen lien nhau
 * co the trung moc toi mili giay; dat moc ro rang roi DOC LAI de bai kiem khong bao gio xanh vi mot lenh khong lam gi.
 */
async function themBia(db: TestDb, ownerId: string, bookId: string | null, luc: Date): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
  await db.update(media).set({ createdAt: luc }).where(eq(media.id, id));
  const [lai] = await db.select({ createdAt: media.createdAt, bookId: media.bookId }).from(media).where(eq(media.id, id));
  expect(lai?.createdAt.getTime()).toBe(luc.getTime());
  expect(lai?.bookId).toBe(bookId);
  return id;
}

/** Mot anh trong trang (khong phai bia) cua cung cuon do. */
async function themAnhTrang(db: TestDb, ownerId: string, bookId: string): Promise<string> {
  const id = randomUUID();
  expect(await recordUpload(db, { id, ownerId, bookId, kind: "anh", mime: "image/webp", bytes: 1024, width: 800, height: 600 })).toBe(true);
  const [lai] = await db.select({ kind: media.kind }).from(media).where(eq(media.id, id));
  expect(lai?.kind).toBe("anh");
  return id;
}

const LUC = (phut: number) => new Date(Date.UTC(2026, 8, 20, 10, phut, 0));

describe("khoBia", () => {
  it("liet ke moi anh bia cua cuon, moi nhat truoc", async () => {
    const s = await haiCuon();
    const cu = await themBia(s.db, s.seat1.id, s.chung, LUC(0));
    const giua = await themBia(s.db, s.seat1.id, s.chung, LUC(5));
    const moi = await themBia(s.db, s.seat1.id, s.chung, LUC(9));
    expect((await khoBia(s.db, s.seat1.id, s.chung)).map((p) => p.id)).toEqual([moi, giua, cu]);
  });

  it("anh chua duoc o nao chon van nam trong kho", async () => {
    const s = await haiCuon();
    const id = await themBia(s.db, s.seat1.id, s.chung, LUC(0));
    // Khong goi setCoverEntry: anh nay khong nam trong o nao cua dong thoi gian.
    expect((await khoBia(s.db, s.seat1.id, s.chung)).map((p) => p.id)).toEqual([id]);
  });

  it("kho cua cuon nay khong lan sang cuon kia", async () => {
    const s = await haiCuon();
    const a = await themBia(s.db, s.seat1.id, s.chung, LUC(0));
    await themBia(s.db, s.seat1.id, s.rieng, LUC(1));
    expect((await khoBia(s.db, s.seat1.id, s.chung)).map((p) => p.id)).toEqual([a]);
  });

  it("cuon cua nguoi kia tra danh sach rong, y nhu cuon khong ton tai", async () => {
    const s = await haiCuon();
    await themBia(s.db, s.seat1.id, s.chung, LUC(0));
    expect(await khoBia(s.db, s.seat2.id, s.chung)).toEqual([]);
  });

  it("anh trong trang khong lot vao kho bia", async () => {
    const s = await haiCuon();
    const bia = await themBia(s.db, s.seat1.id, s.chung, LUC(0));
    await themAnhTrang(s.db, s.seat1.id, s.chung);
    expect((await khoBia(s.db, s.seat1.id, s.chung)).map((p) => p.id)).toEqual([bia]);
  });

  it("bia cho gan chua thuoc cuon nao thi khong thuoc kho cua cuon nao", async () => {
    const s = await haiCuon();
    await themBia(s.db, s.seat1.id, null, LUC(0));
    expect(await khoBia(s.db, s.seat1.id, s.chung)).toEqual([]);
  });

  it("bookId khong phai uuid tra rong chu khong nem loi", async () => {
    const s = await haiCuon();
    expect(await khoBia(s.db, s.seat1.id, "khong-phai-uuid")).toEqual([]);
  });

  it("cuon khong co anh bia nao tra rong", async () => {
    const s = await haiCuon();
    expect(await khoBia(s.db, s.seat1.id, s.chung)).toEqual([]);
  });
});
