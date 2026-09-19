import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { books, drafts, media, pages, sealReplies, seals } from "@/server/db/schema";
import { createBook, updateBook } from "@/server/library/books";
import { publishDraft, readDraft, saveDraft } from "@/server/library/drafts";
import { bindMedia, recordUpload, type UploadRecord } from "@/server/media/access";
import { submitReply } from "@/server/seal/unlock";
import type { DocJson, ParagraphNode } from "@/lib/doc/types";
import { PEAK_COUNT } from "@/lib/media/kinds";
import type { MediaNode } from "@/lib/media/node";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 7) % 101);
const SACH = { title: "Sổ ảnh", mode: "chia-se", cover: "trang-nuoc", youtubeId: null, coverMediaId: null } as const;

type Bo = Awaited<ReturnType<typeof haiCuon>>;

const doan = (chu: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text: chu }] });
const tai = (...content: DocJson["content"]): DocJson => ({ type: "doc", content });
/** Khoi media nhu trinh duyet gui len: kich thuoc, thoi luong va song am noi doi, may chu phai ghi de tu bang. */
const khoiAnh = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1, h: 1 } });
const khoiGhiAm = (id: string): MediaNode => ({ type: "ghi-am", attrs: { id, ms: 1, peaks: SONG.map(() => 0) } });
/** Khoi media voi thuoc tinh that cua dong media do cac ham tai len ben duoi ghi. */
const anhThat = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1200, h: 900 } });
const ghiAmThat = (id: string): MediaNode => ({ type: "ghi-am", attrs: { id, ms: 42_000, peaks: SONG } });

/** Ghi dong media qua duong that (recordUpload); tra id. */
async function ghi(db: TestDb, record: UploadRecord): Promise<string> {
  if (!(await recordUpload(db, record))) throw new Error("khong ghi duoc media");
  return record.id;
}
const taiAnh = (db: TestDb, ownerId: string, bookId: string) =>
  ghi(db, { id: randomUUID(), ownerId, bookId, kind: "anh", mime: "image/webp", bytes: 2048, width: 1200, height: 900 });
const taiGhiAm = (db: TestDb, ownerId: string, bookId: string) =>
  ghi(db, { id: randomUUID(), ownerId, bookId, kind: "ghi-am", mime: "audio/webm", bytes: 4096, durationMs: 42_000, peaks: SONG });
const taiBia = (db: TestDb, ownerId: string, bookId: string | null) =>
  ghi(db, { id: randomUUID(), ownerId, bookId, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 });

async function biaCuaSach(db: TestDb, bookId: string) {
  return (await db.select({ c: books.coverMediaId }).from(books).where(eq(books.id, bookId)))[0]?.c;
}
async function sachCuaMedia(db: TestDb, mediaId: string) {
  return (await db.select({ b: media.bookId }).from(media).where(eq(media.id, mediaId)))[0]?.b;
}

/** Id media ma seat1 khong duoc dat vao trang cua cuon chung. */
const MUON: [string, (s: Bo) => Promise<string>][] = [
  ["media cua nguoi kia", async (s) => taiAnh(s.db, s.seat2.id, await createBook(s.db, s.seat2.id, SACH))],
  ["media cua cuon khac cung chu", (s) => taiAnh(s.db, s.seat1.id, s.rieng)],
  ["bia tu tai len dat vao trang", (s) => taiBia(s.db, s.seat1.id, s.chung)],
  ["id da nam trong to da dang cua cuon", async (s) => {
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    if (!(await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(id))]))) throw new Error("khong dang duoc");
    return id;
  }],
  ["id khong co dong", async () => randomUUID()],
];

describe("saveDraft gan media", () => {
  it("luu nhap co media: thuoc tinh lay tu bang media, khong tu trinh duyet", async () => {
    const s = await haiCuon();
    const a = await taiAnh(s.db, s.seat1.id, s.chung);
    const g = await taiGhiAm(s.db, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(doan("Mưa"), khoiAnh(a), khoiGhiAm(g)), 1)).toBeInstanceOf(Date);
    expect((await readDraft(s.db, s.seat1.id, s.chung))?.content).toEqual(tai(doan("Mưa"), anhThat(a), ghiAmThat(g)));
  });

  it.each(MUON)("nhap muon id (%s): invalid-media, ban nhap dang co giu nguyen", async (_ten, muon) => {
    const s = await haiCuon();
    const id = await muon(s);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(doan("Nháp cũ")), 1)).toBeInstanceOf(Date);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(doan("Nháp mới"), khoiAnh(id)), 1)).toBe("invalid-media");
    expect((await readDraft(s.db, s.seat1.id, s.chung))?.content).toEqual(tai(doan("Nháp cũ")));
  });

  it("nguoi kia luu nhap vao sach cua chu: not-found truoc khi xet media, khong ghi gi", async () => {
    const s = await haiCuon();
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat2.id, s.chung, tai(khoiAnh(id)), 1)).toBe("not-found");
    expect(await s.db.select().from(drafts)).toEqual([]);
  });
});

describe("publishDraft gan media tung to", () => {
  it("dang to co media: moi to luu thuoc tinh tu bang, to cuoi chi co media khong bi bo", async () => {
    const s = await haiCuon();
    const a = await taiAnh(s.db, s.seat1.id, s.chung);
    const g = await taiGhiAm(s.db, s.seat1.id, s.chung);
    await saveDraft(s.db, s.seat1.id, s.chung, tai(khoiAnh(a), doan("Một"), khoiGhiAm(g)), 2);
    expect(await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(a), doan("Một")), tai(khoiGhiAm(g))])).toEqual({ firstPosition: 1, count: 2 });
    const rows = await s.db.select({ content: pages.content }).from(pages).orderBy(pages.position);
    expect(rows.map((r) => r.content)).toEqual([tai(anhThat(a), doan("Một")), tai(ghiAmThat(g))]);
    expect(await s.db.select().from(drafts)).toEqual([]);
  });

  it.each(MUON)("dang to muon id (%s): khong chen to nao, nhap con nguyen", async (_ten, muon) => {
    const s = await haiCuon();
    const id = await muon(s);
    const truoc = await s.db.select().from(pages);
    await saveDraft(s.db, s.seat1.id, s.chung, tai(doan("Nháp")), 2);
    expect(await publishDraft(s.db, s.seat1.id, s.chung, [tai(doan("Tờ đúng")), tai(khoiAnh(id))])).toBeNull();
    expect(await s.db.select().from(pages)).toEqual(truoc);
    expect(await s.db.select({ b: drafts.bookId }).from(drafts)).toEqual([{ b: s.chung }]);
  });

  it("to chi co media kem hen gio: dong he lo rong, niem phong khong goi y co media", async () => {
    const s = await haiCuon();
    const a = await taiAnh(s.db, s.seat1.id, s.chung);
    await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(a))], henGio(new Date(Date.now() + 3_600_000)));
    expect(await s.db.select({ teaser: seals.teaser }).from(seals)).toEqual([{ teaser: "" }]);
  });
});

/** Id media ma seat1 khong duoc dung lam bia cua cuon chung (hay cua cuon moi). */
const BIA_MUON: [string, (s: Bo) => Promise<string>][] = [
  ["bia cho gan cua nguoi kia", (s) => taiBia(s.db, s.seat2.id, null)],
  ["bia da thuoc cuon khac", (s) => taiBia(s.db, s.seat1.id, s.rieng)],
  ["anh trong trang, khong phai bia", (s) => taiAnh(s.db, s.seat1.id, s.chung)],
  ["id khong co dong", async () => randomUUID()],
  ["id khong phai uuid", async () => "khong-phai-uuid"],
];

describe("bia tu tai len", () => {
  it("tao sach voi bia cho gan: gan vao cuon moi trong cung giao dich", async () => {
    const s = await haiCuon();
    const bia = await taiBia(s.db, s.seat1.id, null);
    const id = await createBook(s.db, s.seat1.id, { ...SACH, coverMediaId: bia });
    expect(id).not.toBeNull();
    expect(await biaCuaSach(s.db, id!)).toBe(bia);
    expect(await sachCuaMedia(s.db, bia)).toBe(id);
  });

  it.each(BIA_MUON)("tao sach voi bia muon (%s): null, khong tao cuon, media khong doi", async (_ten, muon) => {
    const s = await haiCuon();
    const id = await muon(s);
    const truoc = await s.db.select().from(media);
    expect(await createBook(s.db, s.seat1.id, { ...SACH, coverMediaId: id })).toBeNull();
    expect(await s.db.select({ id: books.id }).from(books)).toHaveLength(2);
    expect(await s.db.select().from(media)).toEqual(truoc);
  });

  it("sua sach: gan bia cho gan, doi sang bia cua cuon, giu bia hien tai, bo bia bang null", async () => {
    const s = await haiCuon();
    const cho = await taiBia(s.db, s.seat1.id, null);
    expect(await updateBook(s.db, s.seat1.id, s.chung, { ...SACH, coverMediaId: cho })).toBe("saved");
    expect([await biaCuaSach(s.db, s.chung), await sachCuaMedia(s.db, cho)]).toEqual([cho, s.chung]);
    const cuaCuon = await taiBia(s.db, s.seat1.id, s.chung);
    expect(await updateBook(s.db, s.seat1.id, s.chung, { ...SACH, coverMediaId: cuaCuon })).toBe("saved");
    expect(await updateBook(s.db, s.seat1.id, s.chung, { ...SACH, coverMediaId: cuaCuon })).toBe("saved");
    expect(await biaCuaSach(s.db, s.chung)).toBe(cuaCuon);
    expect(await updateBook(s.db, s.seat1.id, s.chung, SACH)).toBe("saved");
    expect(await biaCuaSach(s.db, s.chung)).toBeNull();
  });

  it.each(BIA_MUON)("sua sach voi bia muon (%s): invalid-cover, sach va media khong doi", async (_ten, muon) => {
    const s = await haiCuon();
    const id = await muon(s);
    const [sachTruoc, mediaTruoc] = [await s.db.select().from(books), await s.db.select().from(media)];
    expect(await updateBook(s.db, s.seat1.id, s.chung, { ...SACH, coverMediaId: id })).toBe("invalid-cover");
    expect(await s.db.select().from(books)).toEqual(sachTruoc);
    expect(await s.db.select().from(media)).toEqual(mediaTruoc);
  });

  it("nguoi kia sua sach cua chu voi bia cho gan cua chinh ho: not-found, bia van cho gan", async () => {
    const s = await haiCuon();
    const bia = await taiBia(s.db, s.seat2.id, null);
    expect(await updateBook(s.db, s.seat2.id, s.chung, { ...SACH, coverMediaId: bia })).toBe("not-found");
    expect([await biaCuaSach(s.db, s.chung), await sachCuaMedia(s.db, bia)]).toEqual([null, null]);
  });
});

describe("trang tra loi cua trao doi", () => {
  it("co khoi media thi submitReply tu choi: khong luu trang, khong mo niem phong", async () => {
    const s = await haiCuon();
    await dangNiemPhong(s.db, s.seat1.id, s.chung, TRAO_DOI, "Tờ khóa");
    const [seal] = await s.db.select({ id: seals.id }).from(seals);
    const id = await taiAnh(s.db, s.seat2.id, await createBook(s.db, s.seat2.id, SACH));
    expect(await submitReply(s.db, s.seat2.id, seal.id, tai(doan("Em nghĩ về anh"), khoiAnh(id)))).toBeNull();
    expect(await s.db.select({ openedAt: seals.openedAt }).from(seals)).toEqual([{ openedAt: null }]);
    expect(await s.db.select().from(sealReplies)).toEqual([]);
  });
});

describe("bindMedia khi sua to (keep)", () => {
  /** Dang mot to chi co anh id vao cuon chung; tra id. */
  async function dangAnh(s: Bo, id: string) {
    if (!(await publishDraft(s.db, s.seat1.id, s.chung, [tai(doan("Tờ ảnh"), khoiAnh(id))]))) throw new Error("khong dang duoc");
    return id;
  }

  it("id dang nam tren chinh to (co trong keep): gan duoc, thuoc tinh lay tu bang", async () => {
    const s = await haiCuon();
    const id = await dangAnh(s, await taiAnh(s.db, s.seat1.id, s.chung));
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(doan("Mới"), khoiAnh(id)), { keep: new Set([id]) }))
      .toEqual(tai(doan("Mới"), anhThat(id)));
  });

  it("cung id do khi khong truyen opts: null nhu truoc, keep moi la thu cho qua", async () => {
    const s = await haiCuon();
    const id = await dangAnh(s, await taiAnh(s.db, s.seat1.id, s.chung));
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)))).toBeNull();
  });

  it("id vua tai, chua nam o dau, keep rong: gan duoc", async () => {
    const s = await haiCuon();
    const a = await taiAnh(s.db, s.seat1.id, s.chung);
    const g = await taiGhiAm(s.db, s.seat1.id, s.chung);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(a), khoiGhiAm(g)), { keep: new Set() }))
      .toEqual(tai(anhThat(a), ghiAmThat(g)));
  });

  it("id nam tren to khac cua cuon, khong trong keep: null", async () => {
    const s = await haiCuon();
    const id = await dangAnh(s, await taiAnh(s.db, s.seat1.id, s.chung));
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)), { keep: new Set() })).toBeNull();
  });

  it("id nam tren to hen gio con khoa, khong trong keep: null", async () => {
    const s = await haiCuon();
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(id))], henGio(new Date(Date.now() + 3_600_000)));
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)), { keep: new Set() })).toBeNull();
  });

  it("id dang nam trong ban nhap hien tai cua cuon, khong trong keep: null", async () => {
    const s = await haiCuon();
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(doan("Nháp"), khoiAnh(id)), 1)).toBeInstanceOf(Date);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)), { keep: new Set() })).toBeNull();
  });

  it("id trong ban nhap cua cuon khac khong chan cuon nay", async () => {
    const s = await haiCuon();
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat1.id, s.rieng, tai(doan("Nháp cuốn kia")), 1)).toBeInstanceOf(Date);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoiAnh(id)), { keep: new Set() })).toEqual(tai(anhThat(id)));
  });

  it.each<[string, (s: Bo) => Promise<{ id: string; khoi: MediaNode }>]>([
    ["cuon khac cung chu", async (s) => {
      const id = await taiAnh(s.db, s.seat1.id, s.rieng);
      return { id, khoi: khoiAnh(id) };
    }],
    ["cua nguoi kia", async (s) => {
      const id = await taiAnh(s.db, s.seat2.id, await createBook(s.db, s.seat2.id, SACH));
      return { id, khoi: khoiAnh(id) };
    }],
    ["sai loai: khoi ghi am mang id anh", async (s) => {
      const id = await taiAnh(s.db, s.seat1.id, s.chung);
      return { id, khoi: khoiGhiAm(id) };
    }],
    ["bia cua cuon", async (s) => {
      const id = await taiBia(s.db, s.seat1.id, s.chung);
      return { id, khoi: khoiAnh(id) };
    }],
  ])("id sai luat chu, cuon hay loai (%s): null ke ca khi co trong keep", async (_ten, lay) => {
    const s = await haiCuon();
    const { id, khoi } = await lay(s);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(khoi), { keep: new Set([id]) })).toBeNull();
  });

  it("media dan o hai to lien nhau cua cung lan dang: sua to thu nhat voi keep chua no van gan duoc", async () => {
    const s = await haiCuon();
    const id = await taiAnh(s.db, s.seat1.id, s.chung);
    await s.db.insert(pages).values([
      { bookId: s.chung, position: 1, content: tai(anhThat(id)) },
      { bookId: s.chung, position: 2, content: tai(anhThat(id), doan("Tiếp")) },
    ]);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, tai(doan("Sửa"), khoiAnh(id)), { keep: new Set([id]) }))
      .toEqual(tai(doan("Sửa"), anhThat(id)));
  });
});
