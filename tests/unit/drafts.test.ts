import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { dang, haiCuon, to } from "../helpers/library";
import { activity, books, drafts, media, pages, readSheets, rounds } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { listDrafts, listUnwrittenBooks, publishDraft, readDraft, saveDraft, setDraftTrim } from "@/server/library/drafts";
import { markRead, readBook } from "@/server/library/pages";
import { discardDraft } from "@/server/library/remove";
import { recordUpload } from "@/server/media/access";
import { TRANG_TRONG, type DocJson } from "@/lib/doc/types";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";

describe("ban nhap", () => {
  it("chi chu sach luu va doc duoc ban nhap; voi nguoi kia no nhu khong ton tai", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    expect(await saveDraft(db, seat2.id, chung, to("chen vao"), 1)).toBe("not-found");
    expect(await db.select().from(drafts)).toHaveLength(0);
    expect(await saveDraft(db, seat1.id, chung, to("Mưa"), 1)).toBeInstanceOf(Date);
    expect(await readDraft(db, seat2.id, chung)).toBeNull();
    expect((await readDraft(db, seat1.id, chung))?.content).toEqual(to("Mưa"));
  });

  it("moi cuon mot ban nhap, luu lai thi ghi de", async () => {
    const { db, seat1, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("một"), 1);
    await saveDraft(db, seat1.id, chung, to("hai"), 3);
    const rows = await db.select().from(drafts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ content: to("hai"), sheetCount: 3 });
  });

  it("so to khong hop le thi luu la 1, qua lon thi chan o 999", async () => {
    const { db, seat1, chung } = await haiCuon();
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      await saveDraft(db, seat1.id, chung, to("a"), bad);
      expect((await readDraft(db, seat1.id, chung))?.sheetCount).toBe(1);
    }
    await saveDraft(db, seat1.id, chung, to("a"), 5000);
    expect((await readDraft(db, seat1.id, chung))?.sheetCount).toBe(999);
  });

  it("danh sach ban nhap chi co cua chinh minh", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("Em tới sớm"), 2);
    await saveDraft(db, seat1.id, rieng, to("riêng"), 1);
    const mine = await listDrafts(db, seat1.id);
    expect(mine.map((d) => d.title).sort()).toEqual(["Chuyện chưa kể", "Cuốn không đặt tên"].sort());
    expect(mine.find((d) => d.bookId === chung)).toMatchObject({ excerpt: "Em tới sớm", sheetCount: 2, cover: "nui-xa", mode: "chia-se" });
    expect(mine.find((d) => d.bookId === rieng)).toMatchObject({ mode: "rieng-tu", cover: "chim-bay" });
    expect(await listDrafts(db, seat2.id)).toEqual([]);
  });

  it("listDrafts cho biet cuon da co to dang chua (hasPages)", async () => {
    const { db, seat1, chung, rieng } = await haiCuon();
    await dang(db, seat1.id, chung, "một");
    await saveDraft(db, seat1.id, chung, to("hai"), 1);
    await saveDraft(db, seat1.id, rieng, to("nháp"), 1);
    const ds = await listDrafts(db, seat1.id);
    expect(Object.fromEntries(ds.map((d) => [d.bookId, d.hasPages]))).toEqual({ [chung]: true, [rieng]: false });
  });

  it("listUnwrittenBooks: chi cuon cua chinh chu chua co to va chua co nhap, moi tao truoc", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    // Gio tao mac dinh la now() cua database, co the trung nhau: dat lui gio hai cuon cu de thu tu chac chan.
    await db.update(books).set({ createdAt: new Date("2026-09-01T00:00:00.000Z") }).where(eq(books.id, chung));
    await db.update(books).set({ createdAt: new Date("2026-09-02T00:00:00.000Z") }).where(eq(books.id, rieng));
    const moi = await createBook(db, seat1.id, { title: "Sổ mới tinh", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    await createBook(db, seat2.id, { title: "Của người kia", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    // Ban dau ca ba cuon cua seat1 deu chua viet; cuon moi nhat dung dau; cuon cua nguoi kia khong co.
    expect((await listUnwrittenBooks(db, seat1.id)).map((b) => b.bookId)).toEqual([moi, rieng, chung]);
    await dang(db, seat1.id, chung, "một");
    await saveDraft(db, seat1.id, rieng, to("nháp"), 1);
    const con = await listUnwrittenBooks(db, seat1.id);
    expect(con).toEqual([expect.objectContaining({ bookId: moi, title: "Sổ mới tinh", mode: "chia-se", cover: "nui-xa", coverMediaId: null })]);
    expect(con[0].createdAt).toBeInstanceOf(Date);
  });
});

describe("setDraftTrim", () => {
  it("cuon chua co nhap thi tao nhap rong mot doan, va ghi dung hai o", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await setDraftTrim(db, seat1.id, chung, { cover: "hoa-dao", coverMediaId: null, youtubeId: "5qap5aO4i9A", dropTrack: false })).toBe("saved");
    expect(await db.select({ c: drafts.content, n: drafts.sheetCount, bia: drafts.cover, nhac: drafts.youtubeId, go: drafts.dropTrack }).from(drafts))
      .toEqual([{ c: TRANG_TRONG, n: 1, bia: "hoa-dao", nhac: "5qap5aO4i9A", go: false }]);
  });

  it("khong cham content va sheet_count cua nhap dang co", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await saveDraft(db, seat1.id, chung, to("Đang viết dở"), 3)).toBeInstanceOf(Date);
    expect(await setDraftTrim(db, seat1.id, chung, { cover: "cau-go", coverMediaId: null, youtubeId: null, dropTrack: false })).toBe("saved");
    expect(await db.select({ c: drafts.content, n: drafts.sheetCount, bia: drafts.cover }).from(drafts))
      .toEqual([{ c: to("Đang viết dở"), n: 3, bia: "cau-go" }]);
  });

  it("o go nhac ghi duoc, va ghi de lua chon cu cua chinh lan truoc", async () => {
    const { db, seat1, chung } = await haiCuon();
    await setDraftTrim(db, seat1.id, chung, { cover: null, coverMediaId: null, youtubeId: "5qap5aO4i9A", dropTrack: false });
    expect(await setDraftTrim(db, seat1.id, chung, { cover: null, coverMediaId: null, youtubeId: null, dropTrack: true })).toBe("saved");
    expect(await db.select({ nhac: drafts.youtubeId, go: drafts.dropTrack }).from(drafts)).toEqual([{ nhac: null, go: true }]);
  });

  it("de trong het cung duoc: luot nay khong them o nao", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await setDraftTrim(db, seat1.id, chung, { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false })).toBe("saved");
    expect(await db.select({ bia: drafts.cover, nhac: drafts.youtubeId, go: drafts.dropTrack }).from(drafts))
      .toEqual([{ bia: null, nhac: null, go: false }]);
  });

  it("gia tri khong hop le thi tu choi va khong ghi gi", async () => {
    const { db, seat1, chung } = await haiCuon();
    const xau = [
      { cover: null, coverMediaId: randomUUID(), youtubeId: null, dropTrack: false },
      { cover: "khong-co-that" as never, coverMediaId: null, youtubeId: null, dropTrack: false },
      { cover: null, coverMediaId: null, youtubeId: "qua-ngan", dropTrack: false },
      { cover: null, coverMediaId: null, youtubeId: "5qap5aO4i9A", dropTrack: true },
    ];
    for (const t of xau) expect(await setDraftTrim(db, seat1.id, chung, t), JSON.stringify(t)).toBe("invalid");
    expect(await db.select().from(drafts)).toEqual([]);
  });

  it("cuon cua nguoi khac hay ma sach sai dang: not-found, khong ghi gi", async () => {
    const { db, seat2, chung } = await haiCuon();
    const t = { cover: "nui-xa" as const, coverMediaId: null, youtubeId: null, dropTrack: false };
    expect(await setDraftTrim(db, seat2.id, chung, t)).toBe("not-found");
    expect(await setDraftTrim(db, seat2.id, "khong-phai-uuid", t)).toBe("not-found");
    expect(await db.select().from(drafts)).toEqual([]);
  });

  it("anh bia cua nguoi khac hay khong co that: invalid-cover, khong ghi gi", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await setDraftTrim(db, seat1.id, chung, { cover: "nui-xa", coverMediaId: randomUUID(), youtubeId: null, dropTrack: false })).toBe("invalid-cover");
    expect(await db.select().from(drafts)).toEqual([]);
  });

  it("anh bia dung duoc thi duoc gan vao cuon ngay, de no thuoc kho anh cua cuon", async () => {
    const { db, seat1, chung } = await haiCuon();
    const bia = randomUUID();
    expect(await recordUpload(db, { id: bia, ownerId: seat1.id, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
    expect(await setDraftTrim(db, seat1.id, chung, { cover: "nui-xa", coverMediaId: bia, youtubeId: null, dropTrack: false })).toBe("saved");
    expect(await db.select({ b: media.bookId }).from(media).where(eq(media.id, bia))).toEqual([{ b: chung }]);
  });

  it("bo ban nhap thi hai o cua luot dang soan mat theo", async () => {
    const { db, seat1, chung } = await haiCuon();
    await setDraftTrim(db, seat1.id, chung, { cover: "hoa-dao", coverMediaId: null, youtubeId: "5qap5aO4i9A", dropTrack: false });
    expect(await discardDraft(db, seat1.id, chung)).toBe("discarded");
    expect(await db.select().from(drafts)).toEqual([]);
  });

  // Chon bia hay nhac la da co dong drafts, nen cuon roi muc "chua viet" sang muc ban nhap cua /ban-nhap voi doan trich
  // rong. Van xoa duoc ca cuon tu do (hasPages false), nen khong mat duong nao.
  it("chon bia thoi la cuon roi muc chua viet, sang muc ban nhap", async () => {
    const { db, seat1, chung } = await haiCuon();
    await setDraftTrim(db, seat1.id, chung, { cover: "hoa-dao", coverMediaId: null, youtubeId: null, dropTrack: false });
    expect((await listUnwrittenBooks(db, seat1.id)).map((b) => b.bookId)).not.toContain(chung);
    expect((await listDrafts(db, seat1.id)).find((d) => d.bookId === chung)).toMatchObject({ excerpt: "", hasPages: false });
  });
});

describe("dang trang", () => {
  it("dang noi tiep vi tri lien nhau va xoa ban nhap", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await dang(db, seat1.id, chung, "một", "hai")).toEqual({ firstPosition: 1, count: 2 });
    expect(await dang(db, seat1.id, chung, "ba", "bốn", "năm")).toEqual({ firstPosition: 3, count: 3 });
    const rows = await db.select().from(pages);
    expect(rows.map((r) => r.position).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(await db.select().from(drafts)).toHaveLength(0);
  });

  it("bo cac to trong o cuoi; toan to trong thi khong dang gi", async () => {
    const { db, seat1, chung } = await haiCuon();
    const trong = { type: "doc" as const, content: [{ type: "paragraph" as const }] };
    expect(await publishDraft(db, seat1.id, chung, [to("một"), trong, trong])).toEqual({ firstPosition: 1, count: 1 });
    expect(await publishDraft(db, seat1.id, chung, [trong])).toBeNull();
    expect(await db.select().from(pages)).toHaveLength(1);
  });

  it("khong dang qua 40 to mot lan", async () => {
    const { db, seat1, chung } = await haiCuon();
    const nhieu = Array.from({ length: MAX_SHEETS_PER_PUBLISH + 1 }, (_, i) => to(`tờ ${i + 1}`));
    expect(await publishDraft(db, seat1.id, chung, nhieu)).toBeNull();
    expect(await publishDraft(db, seat1.id, chung, nhieu.slice(0, MAX_SHEETS_PER_PUBLISH))).toEqual({ firstPosition: 1, count: 40 });
  });

  it("nguoi kia khong dang duoc vao sach cua minh; ma sach sai dang thi tra null", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    expect(await publishDraft(db, seat2.id, chung, [to("chen")])).toBeNull();
    expect(await publishDraft(db, seat1.id, "khong-phai-uuid", [to("a")])).toBeNull();
    expect(await db.select().from(pages)).toHaveLength(0);
    expect(await db.select().from(rounds)).toHaveLength(0);
  });

  it("moi lan dang tao dung mot luot; dau noi tiep o to dau bi bo, o nhanh dau to sau thi giu", async () => {
    const { db, seat1, chung } = await haiCuon();
    const dau: DocJson = { type: "doc", content: [{ type: "paragraph", noiTiep: true, content: [{ type: "text", text: "Một" }] }] };
    const sau: DocJson = { type: "doc", content: [{ type: "paragraph", noiTiep: true, content: [{ type: "text", text: "Hai" }] }] };
    await publishDraft(db, seat1.id, chung, [dau, sau]);
    await publishDraft(db, seat1.id, chung, [to("Ba")]);
    const luot = await db.select().from(rounds).where(eq(rounds.bookId, chung));
    expect(luot).toHaveLength(2);
    const cacTo = await db
      .select({ roundId: pages.roundId, content: pages.content, publishedAt: pages.publishedAt })
      .from(pages)
      .where(eq(pages.bookId, chung))
      .orderBy(asc(pages.position));
    expect(cacTo[1].roundId).toBe(cacTo[0].roundId);
    expect(cacTo[2].roundId).not.toBe(cacTo[0].roundId);
    expect(cacTo.map((t) => t.content)).toEqual([to("Một"), sau, to("Ba")]);
    const cua = luot.find((r) => r.id === cacTo[0].roundId);
    expect(cua?.publishedAt).toEqual(cacTo[0].publishedAt);
    expect(cua?.editedAt).toBeNull();
  });

  /*
   * Bang chung that su cho "hong mot phan thi khong co phan nao duoc ghi": mot buoc NAM SAU lenh ghi dau tien phai hong
   * that. To duoi day mang ky tu NUL, thu ma jsonb cua Postgres tu choi (dung ly do isStorable ton tai), nen lenh chen to
   * nem loi sau khi dong luot da duoc ghi trong cung giao dich. To nay khong bao gio den tu actionPublish
   * (checkPublishInput chan tu truoc); no dong vai "buoc sau do hong".
   */
  it("mot buoc sau do hong: khong to, luot hay su kien nao duoc ghi, ban nhap van con", async () => {
    const { db, seat1, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("nháp"), 1);
    await expect(publishDraft(db, seat1.id, chung, [to(`Mưa${String.fromCharCode(0)}`)])).rejects.toThrow();
    expect([await db.select().from(pages), await db.select().from(rounds), await db.select().from(activity)]).toEqual([[], [], []]);
    expect(await db.select().from(drafts)).toHaveLength(1);
  });
});

// Muc doi bia, ten, nhac o buoc dang da bi bo (spec 7.1), nen khong con duong ghi nao qua publishDraft.
describe("doc sach va cac to da xem", () => {
  it("readBook tra cac to theo thu tu va cac to nguoi doc da xem", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một", "hai", "ba");
    await markRead(db, seat2.id, chung, [1, 2]);
    const v = (await readBook(db, seat2.id, chung))!;
    expect(v.mine).toBe(false);
    expect([v.seen, v.firstUnread]).toEqual([[1, 2], 3]);
    expect(v.sheets.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(v.sheets[2].content).toEqual(to("ba"));
  });

  it("nguoi kia khong doc duoc sach rieng tu; chu sach doc duoc", async () => {
    const { db, seat1, seat2, rieng } = await haiCuon();
    await dang(db, seat1.id, rieng, "riêng tư thật sự");
    expect(await readBook(db, seat2.id, rieng)).toBeNull();
    expect((await readBook(db, seat1.id, rieng))?.mine).toBe(true);
  });

  it("chi ghi to co that, bo qua gia tri khong hop le va cum nhieu to hon mot khung", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một", "hai");
    await markRead(db, seat2.id, chung, [2, 3]);
    await markRead(db, seat2.id, chung, [0, 1]);
    await markRead(db, seat2.id, chung, [1.5, 2]);
    await markRead(db, seat2.id, chung, [1, 2, 3]);
    expect((await readBook(db, seat2.id, chung))?.seen).toEqual([2]);
    await markRead(db, seat2.id, chung, [1, 2]);
    const v = (await readBook(db, seat2.id, chung))!;
    expect([v.seen, v.firstUnread]).toEqual([[1, 2], 0]);
  });

  it("chu sach khong co dong nao; sach rieng tu cua nguoi kia va sach chua co to thi bo qua", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    await markRead(db, seat2.id, chung, [1, 1]);
    await dang(db, seat1.id, rieng, "riêng");
    await dang(db, seat1.id, chung, "một");
    await markRead(db, seat1.id, chung, [1, 1]);
    await markRead(db, seat2.id, rieng, [1, 1]);
    const rows = await db.select().from(readSheets);
    expect(rows).toHaveLength(0);
  });
});
