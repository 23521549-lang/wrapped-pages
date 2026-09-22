import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { activity, books, drafts, media, pages } from "@/server/db/schema";
import { listDrafts, publishDraft, saveDraft } from "@/server/library/drafts";
import { deleteUnpublishedBook, discardDraft } from "@/server/library/remove";
import { listShelf } from "@/server/library/shelf";
import { MemoryStore } from "@/server/media/memory";
import { saveUpload } from "@/server/media/save-upload";
import { MEDIA_ORPHAN_MS, sweepMedia } from "@/server/media/sweep";
import { mediaStoreKey } from "@/lib/media/key";
import type { DocJson } from "@/lib/doc/types";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";

const GIO = 60 * 60_000;
const sau = (ms: number) => new Date(Date.now() + ms);
const khoiAnh = (id: string): DocJson => ({ type: "doc", content: [{ type: "anh", attrs: { id, w: 1, h: 1 } }] });

/** Tai mot anh (hoac bia) that vao kho nho cua test, tra id va key object. */
async function taiLen(db: TestDb, store: MemoryStore, ownerId: string, bookId: string, kind: "anh" | "bia") {
  const id = randomUUID();
  const record = kind === "anh"
    ? { id, ownerId, bookId, kind, mime: "image/webp" as const, bytes: 4, width: 1200, height: 900 }
    : { id, ownerId, bookId, kind, mime: "image/jpeg" as const, bytes: 4, width: 1200, height: 720 };
  expect(await saveUpload(db, store, record, new Uint8Array([1, 2, 3, 4]))).toBe("saved");
  return { id, key: mediaStoreKey(bookId, id, record.mime) };
}

const conSach = async (db: TestDb, id: string) => (await db.select({ id: books.id }).from(books).where(eq(books.id, id))).length === 1;

describe("deleteUnpublishedBook", () => {
  it("sach chua dang: xoa sach, ban nhap, media cua cuon; nguoi kia het thay tren ke; tep trong kho don sau 24 gio", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const anh = await taiLen(s.db, store, s.seat1.id, s.chung, "anh");
    const bia = await taiLen(s.db, store, s.seat1.id, s.chung, "bia");
    await s.db.update(books).set({ coverMediaId: bia.id }).where(eq(books.id, s.chung));
    expect(await saveDraft(s.db, s.seat1.id, s.chung, khoiAnh(anh.id), 1)).toBeInstanceOf(Date);
    expect((await listShelf(s.db, s.seat2.id)).map((b) => b.id)).toContain(s.chung);

    expect(await deleteUnpublishedBook(s.db, s.seat1.id, s.chung)).toBe("deleted");

    expect(await conSach(s.db, s.chung)).toBe(false);
    expect(await s.db.select().from(drafts).where(eq(drafts.bookId, s.chung))).toEqual([]);
    expect(await s.db.select().from(media).where(eq(media.bookId, s.chung))).toEqual([]);
    expect((await listShelf(s.db, s.seat2.id)).map((b) => b.id)).not.toContain(s.chung);
    expect((await listDrafts(s.db, s.seat1.id)).map((d) => d.bookId)).not.toContain(s.chung);
    expect(await conSach(s.db, s.rieng)).toBe(true);

    expect(await sweepMedia(s.db, store, sau(MEDIA_ORPHAN_MS + GIO))).toEqual({ media: 0, objects: 2 });
    for (const key of [anh.key, bia.key]) expect(await store.get(key, null)).toBeNull();
  });

  it("cuon vua tao, chua viet chu nao (khong co ban nhap) van xoa duoc", async () => {
    const s = await haiCuon();
    expect(await deleteUnpublishedBook(s.db, s.seat1.id, s.rieng)).toBe("deleted");
    expect(await conSach(s.db, s.rieng)).toBe(false);
  });

  it("xoa sach chua dang khong ghi dong Hoat dong nao (khong co recordActivity tren duong nay)", async () => {
    const s = await haiCuon();
    await saveDraft(s.db, s.seat1.id, s.chung, to("một"), 1);
    const truoc = (await s.db.select().from(activity)).length;
    expect(await deleteUnpublishedBook(s.db, s.seat1.id, s.chung)).toBe("deleted");
    expect((await s.db.select().from(activity)).length).toBe(truoc);
  });

  it("da co to dang: has-pages, khong xoa gi (sach, to, ban nhap giu nguyen)", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "một");
    await saveDraft(s.db, s.seat1.id, s.chung, to("hai"), 1);
    expect(await deleteUnpublishedBook(s.db, s.seat1.id, s.chung)).toBe("has-pages");
    expect(await conSach(s.db, s.chung)).toBe(true);
    expect(await s.db.select().from(pages).where(eq(pages.bookId, s.chung))).toHaveLength(1);
    expect(await s.db.select().from(drafts).where(eq(drafts.bookId, s.chung))).toHaveLength(1);
  });

  it("nguoi kia, ma sai dang, cuon khong ton tai: not-found, khong xoa gi", async () => {
    const s = await haiCuon();
    expect(await deleteUnpublishedBook(s.db, s.seat2.id, s.chung)).toBe("not-found");
    expect(await deleteUnpublishedBook(s.db, s.seat1.id, "' or 1=1 --")).toBe("not-found");
    expect(await deleteUnpublishedBook(s.db, s.seat1.id, randomUUID())).toBe("not-found");
    expect([await conSach(s.db, s.chung), await conSach(s.db, s.rieng)]).toEqual([true, true]);
  });

  // PGlite chi co MOT ket noi: Promise.all khong tao khoa dong thuc su giua hai giao dich, chi khien hai loi goi
  // xen ke qua cac diem await cua tung ham theo dung thu tu code viet ra. Ca nay vi vay chi chung minh ket qua CUOI
  // CUNG luon nhat quan (hoac da dang va khong xoa, hoac da xoa va khong dang) chu khong chung minh khoa FOR UPDATE
  // chan duoc hai ket noi that chay song song.
  it("goi dang trang va xoa sach lien tiep qua Promise.all: hoac da dang va khong xoa, hoac da xoa va khong dang; khong bao gio nua voi", async () => {
    const s = await haiCuon();
    await saveDraft(s.db, s.seat1.id, s.chung, to("một"), 1);
    const [dangXong, xoa] = await Promise.all([
      publishDraft(s.db, s.seat1.id, s.chung, [to("một")]),
      deleteUnpublishedBook(s.db, s.seat1.id, s.chung),
    ]);
    const ketQua = dangXong === null ? ["khong dang", xoa] : ["da dang", xoa];
    expect([["da dang", "has-pages"], ["khong dang", "deleted"]]).toContainEqual(ketQua);
    expect(await conSach(s.db, s.chung)).toBe(xoa !== "deleted");
  });
});

describe("discardDraft", () => {
  it("bo ban nhap cua sach da dang: chi mat dong drafts; sach, to giu nguyen; nhap het hien o Ban nhap", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "một");
    await saveDraft(s.db, s.seat1.id, s.chung, to("hai"), 1);
    expect(await discardDraft(s.db, s.seat1.id, s.chung)).toBe("discarded");
    expect(await s.db.select().from(drafts)).toEqual([]);
    expect(await conSach(s.db, s.chung)).toBe(true);
    expect(await s.db.select().from(pages).where(eq(pages.bookId, s.chung))).toHaveLength(1);
    expect(await listDrafts(s.db, s.seat1.id)).toEqual([]);
  });

  it("anh chi nam trong ban nhap thanh mo coi: don rac sau 24 gio nhu hien nay", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const anh = await taiLen(s.db, store, s.seat1.id, s.chung, "anh");
    await saveDraft(s.db, s.seat1.id, s.chung, khoiAnh(anh.id), 1);
    expect(await discardDraft(s.db, s.seat1.id, s.chung)).toBe("discarded");
    expect(await sweepMedia(s.db, store, sau(MEDIA_ORPHAN_MS + GIO))).toEqual({ media: 1, objects: 1 });
  });

  it("bo ban nhap cua sach DA co to dang (co dong Hoat dong tu lan dang truoc) khong ghi them dong Hoat dong nao", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "một");
    await saveDraft(s.db, s.seat1.id, s.chung, to("hai"), 1);
    const truoc = (await s.db.select().from(activity)).length;
    expect(truoc).toBeGreaterThan(0);
    expect(await discardDraft(s.db, s.seat1.id, s.chung)).toBe("discarded");
    expect((await s.db.select().from(activity)).length).toBe(truoc);
  });

  it("khong co ban nhap, nguoi kia, ma sai dang: not-found, ban nhap cua chu giu nguyen", async () => {
    const s = await haiCuon();
    expect(await discardDraft(s.db, s.seat1.id, s.chung)).toBe("not-found");
    await saveDraft(s.db, s.seat1.id, s.chung, to("hai"), 1);
    expect(await discardDraft(s.db, s.seat2.id, s.chung)).toBe("not-found");
    expect(await discardDraft(s.db, s.seat1.id, "khong-phai-uuid")).toBe("not-found");
    expect(await s.db.select().from(drafts)).toHaveLength(1);
  });
});
