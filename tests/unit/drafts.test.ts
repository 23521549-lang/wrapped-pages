import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { dang, haiCuon, to } from "../helpers/library";
import { activity, books, drafts, media, pages, readSheets, rounds } from "@/server/db/schema";
import type { BookEdit } from "@/lib/book";
import { createBook } from "@/server/library/books";
import { listDrafts, listUnwrittenBooks, publishDraft, readDraft, saveDraft } from "@/server/library/drafts";
import { markRead, readBook } from "@/server/library/pages";
import { recordUpload } from "@/server/media/access";
import type { TestDb } from "../helpers/db";
import type { DocJson } from "@/lib/doc/types";
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
});

describe("dang trang kem doi bia, ten, nhac", () => {
  const DOI: BookEdit = { title: "Tên mới", cover: "hoa-dao", coverMediaId: null, youtubeId: "dQw4w9WgXcQ" };
  const CU = ["Chuyện chưa kể", "nui-xa", null, null];

  /** Mot bia da tai len nhung chua gan vao cuon nao, qua dung duong that. */
  async function biaChoGan(db: TestDb, ownerId: string, bookId: string | null = null): Promise<string> {
    const id = randomUUID();
    expect(await recordUpload(db, { id, ownerId, bookId, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
    return id;
  }

  /** Ten, bia, nhac va bia anh cua mot cuon, theo dung thu tu cua CU. */
  async function sachHienGio(db: TestDb, bookId: string) {
    const [b] = await db.select().from(books).where(eq(books.id, bookId));
    return [b.title, b.cover, b.youtubeId, b.coverMediaId];
  }

  it("doi ten, bia va nhac trong cung lan dang", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await publishDraft(db, seat1.id, chung, [to("một")], null, new Date(), DOI)).toEqual({ firstPosition: 1, count: 1 });
    expect(await sachHienGio(db, chung)).toEqual(["Tên mới", "hoa-dao", "dQw4w9WgXcQ", null]);
    const [b] = await db.select().from(books).where(eq(books.id, chung));
    expect(b.mode).toBe("chia-se");
  });

  it("khong mo muc gap thi ten, bia, nhac va bia anh deu y nguyen", async () => {
    const { db, seat1, chung } = await haiCuon();
    const bia = await biaChoGan(db, seat1.id);
    await publishDraft(db, seat1.id, chung, [to("một")], null, new Date(), { ...DOI, coverMediaId: bia });
    await publishDraft(db, seat1.id, chung, [to("hai")]);
    expect(await sachHienGio(db, chung)).toEqual(["Tên mới", "hoa-dao", "dQw4w9WgXcQ", bia]);
    expect((await db.select().from(pages)).length).toBe(2);
  });

  it("bia da tai len cua chinh chu duoc gan vao cuon ngay trong lan dang", async () => {
    const { db, seat1, chung } = await haiCuon();
    const bia = await biaChoGan(db, seat1.id);
    expect(await publishDraft(db, seat1.id, chung, [to("một")], null, new Date(), { ...DOI, coverMediaId: bia })).toEqual({ firstPosition: 1, count: 1 });
    expect(await sachHienGio(db, chung)).toEqual(["Tên mới", "hoa-dao", "dQw4w9WgXcQ", bia]);
    expect((await db.select().from(media).where(eq(media.id, bia)))[0].bookId).toBe(chung);
  });

  it("bia khong co that, bia cua nguoi kia, bia cua cuon khac: deu bi tu choi va khong dang to nao", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    const la = [
      randomUUID(),
      await biaChoGan(db, seat2.id),
      await biaChoGan(db, seat1.id, rieng),
    ];
    for (const bia of la) {
      expect(await publishDraft(db, seat1.id, chung, [to("một")], null, new Date(), { ...DOI, coverMediaId: bia }), bia).toBe("invalid-cover");
    }
    expect(await sachHienGio(db, chung)).toEqual(CU);
    expect([await db.select().from(pages), await db.select().from(rounds), await db.select().from(activity)]).toEqual([[], [], []]);
  });

  it("nguoi kia goi thang kem muc doi sach: khong doi duoc gi cua cuon nguoi khac", async () => {
    const { db, seat2, chung } = await haiCuon();
    const bia = await biaChoGan(db, seat2.id);
    expect(await publishDraft(db, seat2.id, chung, [to("chen")], null, new Date(), { ...DOI, coverMediaId: bia })).toBeNull();
    expect(await sachHienGio(db, chung)).toEqual(CU);
    expect((await db.select().from(media).where(eq(media.id, bia)))[0].bookId).toBeNull();
    expect([await db.select().from(pages), await db.select().from(rounds)]).toEqual([[], []]);
  });

  it("to hong thi khong doi sach: ca hai cung mot giao dich", async () => {
    const { db, seat1, chung } = await haiCuon();
    const trong = { type: "doc" as const, content: [{ type: "paragraph" as const }] };
    expect(await publishDraft(db, seat1.id, chung, [trong], null, new Date(), DOI)).toBeNull();
    expect(await sachHienGio(db, chung)).toEqual(CU);
  });

  /*
   * Bang chung that su cho "hong mot phan thi khong co phan nao duoc ghi": mot buoc NAM SAU lenh ghi dong books phai
   * hong that. To duoi day mang ky tu NUL, thu ma jsonb cua Postgres tu choi (dung ly do isStorable ton tai), nen lenh
   * chen to nem loi sau khi ten, bia, nhac va bia anh da duoc ghi trong cung giao dich. To nay khong bao gio den tu
   * actionPublish (checkPublishInput chan tu truoc); no dong vai "buoc sau do hong".
   */
  it("mot buoc sau do hong: khong ten, bia, nhac, bia anh, to, luot hay su kien nao duoc ghi", async () => {
    const { db, seat1, chung } = await haiCuon();
    await saveDraft(db, seat1.id, chung, to("nháp"), 1);
    const bia = await biaChoGan(db, seat1.id);
    await expect(
      publishDraft(db, seat1.id, chung, [to(`Mưa${String.fromCharCode(0)}`)], null, new Date(), { ...DOI, coverMediaId: bia }),
    ).rejects.toThrow();
    expect(await sachHienGio(db, chung)).toEqual(CU);
    expect([await db.select().from(pages), await db.select().from(rounds), await db.select().from(activity)]).toEqual([[], [], []]);
    expect((await db.select().from(media).where(eq(media.id, bia)))[0].bookId).toBeNull();
    expect(await db.select().from(drafts)).toHaveLength(1);
  });

  it("khong ghi them su kien Hoat dong nao", async () => {
    const { db, seat1, chung } = await haiCuon();
    await publishDraft(db, seat1.id, chung, [to("một")], null, new Date(), DOI);
    expect((await db.select().from(activity)).map((e) => e.kind)).toEqual(["dang-trang"]);
  });
});

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
