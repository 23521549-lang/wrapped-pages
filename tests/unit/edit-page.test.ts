import { describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { activity, drafts, media, pages, readMarks, seals } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import { editPage, readPageForEdit } from "@/server/library/edit-page";
import { readBook } from "@/server/library/pages";
import { canViewMedia, type UploadRecord } from "@/server/media/access";
import { MemoryStore } from "@/server/media/memory";
import { saveUpload } from "@/server/media/save-upload";
import type { MediaStore } from "@/server/media/store";
import { MEDIA_ORPHAN_MS, sweepMedia } from "@/server/media/sweep";
import { submitReply, tryAnswer } from "@/server/seal/unlock";
import type { DocJson, ParagraphNode } from "@/lib/doc/types";
import { mediaStoreKey } from "@/lib/media/key";
import { PEAK_COUNT } from "@/lib/media/kinds";
import type { MediaNode } from "@/lib/media/node";
import type { SealInput } from "@/lib/seal/types";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { CAU_DO, dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const GIO = 60 * 60_000;
/** Moc sua co dinh cho ca tep, sau moc dang that (published_at lay gio may luc chay) nen CHECK pages_edited_at qua. */
const T = new Date(Date.now() + GIO);
const TEP = new Uint8Array([1, 2, 3, 4]);
const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 7) % 101);

type Bo = Awaited<ReturnType<typeof haiCuon>>;

const doan = (chu: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text: chu }] });
const tai = (...content: DocJson["content"]): DocJson => ({ type: "doc", content });
const khoiAnh = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1, h: 1 } });
const khoiGhiAm = (id: string): MediaNode => ({ type: "ghi-am", attrs: { id, ms: 1, peaks: SONG.map(() => 0) } });
const anhThat = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1200, h: 900 } });

async function taiLen(db: TestDb, store: MediaStore, record: UploadRecord): Promise<string> {
  expect(await saveUpload(db, store, record, TEP.slice())).toBe("saved");
  return record.id;
}
const taiAnh = (db: TestDb, store: MediaStore, ownerId: string, bookId: string) =>
  taiLen(db, store, { id: randomUUID(), ownerId, bookId, kind: "anh", mime: "image/webp", bytes: TEP.length, width: 1200, height: 900 });

/** Moi dong pages cua mot cuon, theo vi tri, nguyen van. */
const cacTo = (db: TestDb, bookId: string) => db.select().from(pages).where(eq(pages.bookId, bookId)).orderBy(asc(pages.position));
/** Moi dong pages cua ca database, de chung minh khong ghi gi. */
const moiTo = (db: TestDb) => db.select().from(pages).orderBy(asc(pages.bookId), asc(pages.position));

/** Moc phien ban hien tai cua mot to, doc qua dung duong man sua dung. */
async function phienBan(s: Bo, position: number, bookId = s.chung): Promise<Date> {
  const r = await readPageForEdit(s.db, s.seat1.id, bookId, position);
  if (r?.kind !== "ok") throw new Error("to khong sua duoc");
  return new Date(r.version);
}

/** Cuon chung ba to chu thuong. */
async function baTo() {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Một", "Hai", "Ba");
  return s;
}

/** Cuon chung: to 1 thuong, to 2 nam trong niem phong seal. */
async function coNiemPhong(seal: SealInput) {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Tờ mở");
  await dangNiemPhong(s.db, s.seat1.id, s.chung, seal, "Tờ khóa");
  const [row] = await s.db.select({ id: seals.id }).from(seals);
  return { ...s, sealId: row.id };
}

describe("editPage", () => {
  it("saved: chi to duoc sua doi noi dung va edited_at; vi tri, moc dang, hoat dong, moc doc, nhap giu nguyen", async () => {
    const s = await baTo();
    await s.db.insert(readMarks).values({ accountId: s.seat2.id, bookId: s.chung, position: 3 });
    expect(await saveDraft(s.db, s.seat1.id, s.chung, to("Nháp dở"), 1)).toBeInstanceOf(Date);
    const [truoc, hoatDong, mocDoc, nhap] = [
      await cacTo(s.db, s.chung), await s.db.select().from(activity), await s.db.select().from(readMarks), await s.db.select().from(drafts),
    ];
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Hai đã sửa"), await phienBan(s, 2), T)).toBe("saved");
    const sau = await cacTo(s.db, s.chung);
    expect(sau[1]).toEqual({ ...truoc[1], content: to("Hai đã sửa"), editedAt: T });
    expect([sau[0], sau[2]]).toEqual([truoc[0], truoc[2]]);
    expect(await s.db.select().from(activity)).toEqual(hoatDong);
    expect(await s.db.select().from(readMarks)).toEqual(mocDoc);
    expect(await s.db.select().from(drafts)).toEqual(nhap);
  });

  it("unchanged: cung noi dung du khac thu tu khoa, edited_at van null", async () => {
    const s = await baTo();
    const truoc = await moiTo(s.db);
    const daoKhoa = { content: [{ content: [{ text: "Hai", type: "text" }], type: "paragraph" }], type: "doc" } as unknown as DocJson;
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, daoKhoa, await phienBan(s, 2), T)).toBe("unchanged");
    expect(await moiTo(s.db)).toEqual(truoc);
  });

  it.each<[string, (s: Bo) => [string, string, number]]>([
    ["nguoi kia sua sach chia se cua chu", (s) => [s.seat2.id, s.chung, 2]],
    ["nguoi kia sua sach rieng tu cua chu", (s) => [s.seat2.id, s.rieng, 1]],
    ["sach khong ton tai", (s) => [s.seat1.id, randomUUID(), 1]],
    ["vi tri 4 cua cuon ba to", (s) => [s.seat1.id, s.chung, 4]],
    ["bookId rac", (s) => [s.seat1.id, "rac", 1]],
    ["vi tri 0", (s) => [s.seat1.id, s.chung, 0]],
    ["vi tri -1", (s) => [s.seat1.id, s.chung, -1]],
    ["vi tri 1.5", (s) => [s.seat1.id, s.chung, 1.5]],
  ])("not-found (%s): khong dong nao doi", async (_ten, lay) => {
    const s = await baTo();
    await dang(s.db, s.seat1.id, s.rieng, "Riêng");
    const truoc = await moiTo(s.db);
    const [ai, sach, viTri] = lay(s);
    expect(await editPage(s.db, ai, sach, viTri, to("Chiếm"), await phienBan(s, 1), T)).toBe("not-found");
    expect(await moiTo(s.db)).toEqual(truoc);
  });

  it.each<[string, (s: Bo & { sealId: string }) => Promise<Date>, SealInput]>([
    ["cau do con khoa", async () => T, CAU_DO],
    ["cau do da mo", async (s) => {
      expect((await tryAnswer(s.db, s.seat2.id, s.sealId, "ben xe mien dong"))?.status).toBe("opened");
      return T;
    }, CAU_DO],
    ["hen gio truoc gio mo", async () => T, henGio(new Date(T.getTime() + GIO))],
    ["hen gio sau gio mo", async () => new Date(T.getTime() + 2 * GIO), henGio(new Date(T.getTime() + GIO))],
    ["trao doi chua tra loi", async () => T, TRAO_DOI],
    ["trao doi da co trang tra loi", async (s) => {
      expect(await submitReply(s.db, s.seat2.id, s.sealId, to("Em nghĩ về anh"))).not.toBeNull();
      return T;
    }, TRAO_DOI],
  ])("sealed (%s): noi dung khong doi", async (_ten, chuanBi, seal) => {
    const s = await coNiemPhong(seal);
    const now = await chuanBi(s);
    const truoc = await moiTo(s.db);
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Lộ"), truoc[1].publishedAt, now)).toBe("sealed");
    expect(await moiTo(s.db)).toEqual(truoc);
  });

  it("stale: base som hon 1 ms bi tu choi, khong ghi gi", async () => {
    const s = await baTo();
    const truoc = await moiTo(s.db);
    const base = await phienBan(s, 2);
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Muộn"), new Date(base.getTime() - 1), T)).toBe("stale");
    expect(await moiTo(s.db)).toEqual(truoc);
  });

  it("hai lan sua noi nhau voi moc moi deu qua; lan hai dung moc cu thi stale", async () => {
    const s = await baTo();
    const cu = await phienBan(s, 2);
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Lần một"), cu, T)).toBe("saved");
    const T2 = new Date(T.getTime() + 60_000);
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Lần hai"), cu, T2)).toBe("stale");
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Lần hai"), await phienBan(s, 2), T2)).toBe("saved");
    expect((await cacTo(s.db, s.chung))[1]).toMatchObject({ content: to("Lần hai"), editedAt: T2 });
  });

  it("moc co micro giay (defaultNow, hay .123956) van khop khi base la published_at doc qua driver", async () => {
    const s = await haiCuon();
    await s.db.insert(pages).values([
      { bookId: s.chung, position: 1, content: to("Một") },
      { bookId: s.chung, position: 2, content: to("Hai"), publishedAt: sql`'2026-01-02 03:04:05.123956+00'::timestamptz` },
    ]);
    const [mot, hai] = await cacTo(s.db, s.chung);
    expect(hai.publishedAt.toISOString()).toBe("2026-01-02T03:04:05.123Z");
    expect(await editPage(s.db, s.seat1.id, s.chung, 1, to("Một đã sửa"), mot.publishedAt, T)).toBe("saved");
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Hai đã sửa"), hai.publishedAt, T)).toBe("saved");
  });

  it.each<[string, (s: Bo, store: MediaStore) => Promise<MediaNode>]>([
    ["id cua to khac", async (s, store) => {
      const id = await taiAnh(s.db, store, s.seat1.id, s.chung);
      await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(id))]);
      return khoiAnh(id);
    }],
    ["id cua to hen gio con khoa", async (s, store) => {
      const id = await taiAnh(s.db, store, s.seat1.id, s.chung);
      await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(id))], henGio(new Date(T.getTime() + GIO)));
      return khoiAnh(id);
    }],
    ["id dang nam trong nhap", async (s, store) => {
      const id = await taiAnh(s.db, store, s.seat1.id, s.chung);
      expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)), 1)).toBeInstanceOf(Date);
      return khoiAnh(id);
    }],
    ["id cua cuon khac", async (s, store) => khoiAnh(await taiAnh(s.db, store, s.seat1.id, s.rieng))],
    ["id cua nguoi kia", async (s, store) => {
      const sach = await createBook(s.db, s.seat2.id, { title: "Của em", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
      return khoiAnh(await taiAnh(s.db, store, s.seat2.id, sach));
    }],
    ["sai loai", async (s, store) => khoiGhiAm(await taiAnh(s.db, store, s.seat1.id, s.chung))],
  ])("invalid-media (%s): khong ghi gi", async (_ten, lay) => {
    const s = await baTo();
    const khoi = await lay(s, new MemoryStore());
    const truoc = await moiTo(s.db);
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, tai(doan("Hai"), khoi), await phienBan(s, 2), T)).toBe("invalid-media");
    expect(await moiTo(s.db)).toEqual(truoc);
  });

  it("giu, them roi bo media: media bi bo chi con chu sach xem, don rac xoa han, media con tren to khac o lai", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const [a, b, c] = [
      await taiAnh(s.db, store, s.seat1.id, s.chung), await taiAnh(s.db, store, s.seat1.id, s.chung), await taiAnh(s.db, store, s.seat1.id, s.chung),
    ];
    await publishDraft(s.db, s.seat1.id, s.chung, [tai(doan("Có ảnh"), khoiAnh(a)), tai(khoiAnh(c))]);

    expect(await editPage(s.db, s.seat1.id, s.chung, 1, tai(doan("Có ảnh"), khoiAnh(a), khoiAnh(b)), await phienBan(s, 1), T)).toBe("saved");
    expect((await cacTo(s.db, s.chung))[0].content).toEqual(tai(doan("Có ảnh"), anhThat(a), anhThat(b)));

    const T2 = new Date(T.getTime() + 60_000);
    expect(await editPage(s.db, s.seat1.id, s.chung, 1, tai(doan("Có ảnh"), khoiAnh(b)), await phienBan(s, 1), T2)).toBe("saved");
    expect(await canViewMedia(s.db, s.seat2.id, a, T2)).toBeNull();
    expect(await canViewMedia(s.db, s.seat1.id, a, T2)).not.toBeNull();
    expect(await canViewMedia(s.db, s.seat2.id, b, T2)).not.toBeNull();

    const donLuc = new Date(Date.now() + MEDIA_ORPHAN_MS + GIO);
    expect(await sweepMedia(s.db, store, donLuc)).not.toBeNull();
    const conDong = async (id: string) => (await s.db.select({ id: media.id }).from(media).where(eq(media.id, id))).length === 1;
    const conTep = async (id: string) => (await store.get(mediaStoreKey(s.chung, id, "image/webp"), null)) !== null;
    expect([await conDong(a), await conTep(a)]).toEqual([false, false]);
    expect([await conDong(b), await conTep(b), await conDong(c), await conTep(c)]).toEqual([true, true, true, true]);
  });

  it("media dan o hai to cua cung lan dang: sua to thu nhat giu no van qua", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const id = await taiAnh(s.db, store, s.seat1.id, s.chung);
    await s.db.insert(pages).values([
      { bookId: s.chung, position: 1, content: tai(anhThat(id)) },
      { bookId: s.chung, position: 2, content: tai(anhThat(id), doan("Tiếp")) },
    ]);
    expect(await editPage(s.db, s.seat1.id, s.chung, 1, tai(doan("Thêm chữ"), khoiAnh(id)), await phienBan(s, 1), T)).toBe("saved");
  });
});

describe("readPageForEdit", () => {
  it("to thuong cua chu sach: noi dung, ten sach va moc; version doi theo lan sua", async () => {
    const s = await baTo();
    const [, hai] = await cacTo(s.db, s.chung);
    expect(await readPageForEdit(s.db, s.seat1.id, s.chung, 2)).toEqual({
      kind: "ok", position: 2, content: to("Hai"), version: hai.publishedAt.toISOString(),
      bookTitle: "Chuyện chưa kể", publishedAt: hai.publishedAt, editedAt: null,
    });
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Hai mới"), hai.publishedAt, T)).toBe("saved");
    expect(await readPageForEdit(s.db, s.seat1.id, s.chung, 2)).toMatchObject({ content: to("Hai mới"), version: T.toISOString(), editedAt: T });
  });

  it.each<[string, SealInput, (s: Bo & { sealId: string }) => Promise<unknown>]>([
    ["cau do con khoa", CAU_DO, async () => null],
    ["cau do da mo", CAU_DO, (s) => tryAnswer(s.db, s.seat2.id, s.sealId, "ben xe mien dong")],
    ["hen gio chua toi gio", henGio(new Date(Date.now() + GIO)), async () => null],
    ["hen gio da toi gio", henGio(new Date(Date.now() - GIO)), async () => null],
    ["trao doi chua tra loi", TRAO_DOI, async () => null],
    ["trao doi da tra loi", TRAO_DOI, (s) => submitReply(s.db, s.seat2.id, s.sealId, to("Em nghĩ về anh"))],
  ])("to niem phong (%s): chi co kind va position", async (_ten, seal, chuanBi) => {
    const s = await coNiemPhong(seal);
    await chuanBi(s);
    const r = await readPageForEdit(s.db, s.seat1.id, s.chung, 2);
    expect(r).toEqual({ kind: "sealed", position: 2 });
    expect(Object.keys(r!)).toEqual(["kind", "position"]);
  });

  it("to hen gio chua toi gio: khong cau lenh nao doc noi dung to; to thuong thi co (may do hoat dong)", async () => {
    const s = await coNiemPhong(henGio(new Date(Date.now() + GIO)));
    const log: string[] = [];
    // drizzle() gan $client luc chay; kieu TestDb cua helper khong mang theo truong do.
    const client = (s.db as unknown as { $client: PGlite }).$client;
    const theoDoi = drizzle(client, { schema, logger: { logQuery: (q) => log.push(q) } });
    const docNoiDung = /select[^;]*"content"[^;]*from "pages"/i;

    expect(await readPageForEdit(theoDoi, s.seat1.id, s.chung, 2)).toEqual({ kind: "sealed", position: 2 });
    expect(log.length).toBeGreaterThan(0);
    expect(log.filter((q) => docNoiDung.test(q))).toEqual([]);

    log.length = 0;
    expect((await readPageForEdit(theoDoi, s.seat1.id, s.chung, 1))?.kind).toBe("ok");
    expect(log.some((q) => docNoiDung.test(q))).toBe(true);
  });

  it.each<[string, (s: Bo) => [string, string, number]]>([
    ["bookId rac", (s) => [s.seat1.id, "rac", 1]],
    ["vi tri 0", (s) => [s.seat1.id, s.chung, 0]],
    ["vi tri 1.5", (s) => [s.seat1.id, s.chung, 1.5]],
    ["nguoi kia", (s) => [s.seat2.id, s.chung, 1]],
    ["sach khong ton tai", (s) => [s.seat1.id, randomUUID(), 1]],
    ["vi tri khong co", (s) => [s.seat1.id, s.chung, 4]],
  ])("null (%s)", async (_ten, lay) => {
    const s = await baTo();
    const [ai, sach, viTri] = lay(s);
    expect(await readPageForEdit(s.db, ai, sach, viTri)).toBeNull();
  });
});

describe("readBook editedAt", () => {
  it("to vua sua tra editedAt cho ca chu sach lan nguoi kia, to khac null", async () => {
    const s = await baTo();
    expect(await editPage(s.db, s.seat1.id, s.chung, 2, to("Hai đã sửa"), await phienBan(s, 2), T)).toBe("saved");
    for (const ai of [s.seat1.id, s.seat2.id]) {
      const v = await readBook(s.db, ai, s.chung, T);
      expect(v?.sheets.map((sh) => sh.editedAt)).toEqual([null, T, null]);
    }
  });

  it("to dang khoa voi nguoi xem luon null, du cot co gia tri; chu sach (khong khoa) van thay", async () => {
    const s = await coNiemPhong(CAU_DO);
    // Dung tinh huong luat khong cho xay ra, de chung minh lop chan thu hai o readBook.
    await s.db.update(pages).set({ editedAt: T }).where(eq(pages.position, 2));
    const cuaNguoiKia = await readBook(s.db, s.seat2.id, s.chung, T);
    expect(cuaNguoiKia?.sheets[1]).toMatchObject({ locked: true, editedAt: null });
    const cuaChu = await readBook(s.db, s.seat1.id, s.chung, T);
    expect(cuaChu?.sheets[1]).toMatchObject({ locked: false, editedAt: T });
  });
});
