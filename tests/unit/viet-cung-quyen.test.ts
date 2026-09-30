import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { activity, books, drafts, pages, rounds, seals } from "@/server/db/schema";
import { createBook, findWritableBook, readWritableBook } from "@/server/library/books";
import { listDrafts, listUnwrittenBooks, publishDraft, readDraft, saveDraft, setDraftTrim } from "@/server/library/drafts";
import { deleteUnpublishedBook, discardDraft } from "@/server/library/remove";
import { pickWriteTarget } from "@/server/library/write-target";
import type { TestDb } from "../helpers/db";
import { haiCuon, to, vietCung } from "../helpers/library";

/*
 * Quyen nguoi viet o cap cuon va nhap rieng tung nguoi (5c muc B, H1, H2): sach viet cung co hai nguoi viet, moi nguoi mot
 * ban nhap rieng khong bao gio lo cho nguoi kia; dang luot trong sach viet cung phai co ten, khong co niem phong.
 */

const NOW = new Date("2026-09-21T02:00:00.000Z");

describe("nguoi viet cua mot cuon", () => {
  it("sach viet cung: ca hai viet duoc; sach mot nguoi viet: chi chu cuon", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    const { chung } = await haiCuonCungDb(db, seat1.id);
    expect((await findWritableBook(db, seat1.id, sach))?.id).toBe(sach);
    expect((await findWritableBook(db, seat2.id, sach))?.id).toBe(sach);
    expect((await readWritableBook(db, seat2.id, sach))?.cover).toBe("hoa-dao");
    expect(await findWritableBook(db, seat2.id, chung)).toBeNull();
    expect((await findWritableBook(db, seat1.id, chung))?.id).toBe(chung);
    expect(await findWritableBook(db, seat1.id, "khong-phai-uuid")).toBeNull();
  });
});

describe("nhap rieng tung nguoi viet", () => {
  it("hai nguoi hai ban nhap cua cung mot cuon; readDraft khong bao gio tra nhap nguoi kia", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    expect(await saveDraft(db, seat1.id, sach, to("Linh viết"), 1)).toBeInstanceOf(Date);
    expect(await saveDraft(db, seat2.id, sach, to("Mạnh viết"), 2)).toBeInstanceOf(Date);
    expect(await db.select({ a: drafts.accountId }).from(drafts)).toHaveLength(2);
    expect((await readDraft(db, seat1.id, sach))?.content).toEqual(to("Linh viết"));
    expect((await readDraft(db, seat2.id, sach))?.content).toEqual(to("Mạnh viết"));
    expect((await readDraft(db, seat2.id, sach))?.sheetCount).toBe(2);
  });

  it("nguoi kia khong luu duoc nhap vao sach mot nguoi viet cua chu", async () => {
    const { db, seat2, chung } = await haiCuon();
    expect(await saveDraft(db, seat2.id, chung, to("chen vao"), 1)).toBe("not-found");
    expect(await setDraftTrim(db, seat2.id, chung, { cover: "nui-xa", coverMediaId: null, youtubeId: null, dropTrack: false })).toBe("not-found");
    expect(await db.select().from(drafts)).toEqual([]);
  });

  it("setDraftTrim ghi vao nhap cua chinh nguoi goi, khong cham nhap nguoi kia", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    expect(await setDraftTrim(db, seat2.id, sach, { cover: "cau-go", coverMediaId: null, youtubeId: null, dropTrack: false })).toBe("saved");
    expect((await readDraft(db, seat1.id, sach))?.trim.cover).toBeNull();
    expect((await readDraft(db, seat2.id, sach))?.trim.cover).toBe("cau-go");
  });

  it("listDrafts chi nhap cua chinh minh, ke ca nhap trong sach viet cung, co co vietCung", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    await saveDraft(db, seat2.id, sach, to("Mạnh"), 1);
    const cuaManh = await listDrafts(db, seat2.id);
    expect(cuaManh).toHaveLength(1);
    expect(cuaManh[0]).toMatchObject({ bookId: sach, excerpt: "Mạnh", vietCung: true });
    expect((await listDrafts(db, seat1.id)).map((d) => d.excerpt)).toEqual(["Linh"]);
  });

  it("discardDraft chi bo nhap cua nguoi goi", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    await saveDraft(db, seat2.id, sach, to("Mạnh"), 1);
    expect(await discardDraft(db, seat2.id, sach)).toBe("discarded");
    expect(await discardDraft(db, seat2.id, sach)).toBe("not-found");
    expect((await readDraft(db, seat1.id, sach))?.content).toEqual(to("Linh"));
  });
});

describe("dang luot trong sach viet cung", () => {
  it("thieu ten: can-ten, khong ghi gi, nhap con nguyen", async () => {
    const { db, seat2, sach } = await vietCung();
    await saveDraft(db, seat2.id, sach, to("Mạnh"), 1);
    expect(await publishDraft(db, seat2.id, sach, [to("Mạnh")], null, NOW, null)).toBe("can-ten");
    expect(await publishDraft(db, seat2.id, sach, [to("Mạnh")], null, NOW, "   ")).toBe("can-ten");
    expect(await db.select().from(rounds)).toEqual([]);
    expect(await db.select().from(pages)).toEqual([]);
    expect((await readDraft(db, seat2.id, sach))?.content).toEqual(to("Mạnh"));
  });

  it("co ten: luot mang ten da gom khoang trang va nguoi viet la nguoi dang; chi nhap cua nguoi dang bi xoa", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    await saveDraft(db, seat2.id, sach, to("Mạnh"), 1);
    expect(await publishDraft(db, seat2.id, sach, [to("Mạnh")], null, NOW, "  Bánh mì   chợ Hàng Da ")).toEqual({ firstPosition: 1, count: 1 });
    expect(await db.select({ tacGiaId: rounds.tacGiaId, ten: rounds.ten }).from(rounds)).toEqual([
      { tacGiaId: seat2.id, ten: "Bánh mì chợ Hàng Da" },
    ]);
    expect(await readDraft(db, seat2.id, sach)).toBeNull();
    expect((await readDraft(db, seat1.id, sach))?.content).toEqual(to("Linh"));
    expect(await db.select({ kind: activity.kind, actorId: activity.actorId, shared: activity.shared }).from(activity).where(eq(activity.kind, "dang-trang")))
      .toEqual([{ kind: "dang-trang", actorId: seat2.id, shared: true }]);
  });

  it("niem phong bi tu choi trong sach viet cung, ke ca hen gio", async () => {
    const { db, seat1, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    expect(await publishDraft(db, seat1.id, sach, [to("Linh")], { kind: "hen-gio", opensAt: new Date("2026-12-01T00:00:00Z") }, NOW, "Tên")).toBeNull();
    expect(await publishDraft(db, seat1.id, sach, [to("Linh")], { kind: "trao-doi", question: "Ăn gì?" }, NOW, "Tên")).toBeNull();
    expect(await db.select().from(seals)).toEqual([]);
    expect(await db.select().from(rounds)).toEqual([]);
  });

  it("sach mot nguoi viet: dang nhu cu, luot cua chu cuon, ten truyen vao bi bo qua", async () => {
    const { db, seat1, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("một"), 1);
    expect(await publishDraft(db, seat1.id, chung, [to("một")], null, NOW, "Tên không dùng")).toEqual({ firstPosition: 1, count: 1 });
    expect(await db.select({ tacGiaId: rounds.tacGiaId, ten: rounds.ten }).from(rounds)).toEqual([{ tacGiaId: seat1.id, ten: null }]);
  });

  it("nguoi kia khong dang duoc vao sach mot nguoi viet cua chu", async () => {
    const { db, seat2, chung } = await haiCuon();
    expect(await publishDraft(db, seat2.id, chung, [to("chen")], null, NOW, "Tên")).toBeNull();
    expect(await db.select().from(pages)).toEqual([]);
  });
});

describe("cho viet, xoa sach chua viet", () => {
  it("pickWriteTarget: nhap cua chinh minh truoc, roi cuon viet duoc gan nhat, ke ca sach viet cung cua nguoi kia", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    expect(await pickWriteTarget(db, seat2.id)).toBe(sach);
    await saveDraft(db, seat1.id, sach, to("Linh"), 1);
    // Nhap cua Linh khong keo Manh toi dau ca; Manh van toi sach viet cung vi day la cuon duy nhat Manh viet duoc.
    expect(await pickWriteTarget(db, seat2.id)).toBe(sach);
  });

  it("deleteUnpublishedBook tu choi sach viet cung; listUnwrittenBooks bo sach viet cung", async () => {
    const { db, seat1, sach } = await vietCung();
    expect(await listUnwrittenBooks(db, seat1.id)).toEqual([]);
    expect(await deleteUnpublishedBook(db, seat1.id, sach)).toBe("not-found");
    expect(await db.select({ id: books.id }).from(books)).toEqual([{ id: sach }]);
  });

  it("sach viet cung co luot cua ca hai: dang lan luot noi tiep vi tri", async () => {
    const { db, seat1, seat2, sach } = await vietCung();
    await saveDraft(db, seat1.id, sach, to("L"), 1);
    await publishDraft(db, seat1.id, sach, [to("L1"), to("L2")], null, NOW, "Mưa phùn đầu ngõ");
    await saveDraft(db, seat2.id, sach, to("M"), 1);
    expect(await publishDraft(db, seat2.id, sach, [to("M1")], null, new Date(NOW.getTime() + 1000), "Bánh mì")).toEqual({ firstPosition: 3, count: 1 });
    const luot = await db.select({ tacGiaId: rounds.tacGiaId, ten: rounds.ten }).from(rounds).orderBy(asc(rounds.publishedAt));
    expect(luot).toEqual([{ tacGiaId: seat1.id, ten: "Mưa phùn đầu ngõ" }, { tacGiaId: seat2.id, ten: "Bánh mì" }]);
  });
});

/** Them mot cuon chia se mot nguoi viet cua ownerId vao database dang co. */
async function haiCuonCungDb(db: TestDb, ownerId: string) {
  const chung = await createBook(db, ownerId, { title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
  return { chung };
}
