import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { activity, pages, readSheets, rounds } from "@/server/db/schema";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import {
  editRound, ownRoundExists, readRoundForEdit, roundOfPosition, type RoundEditResult,
} from "@/server/library/edit-round";
import { roundsOfBook } from "@/server/library/rounds";
import { canViewMedia, type UploadRecord } from "@/server/media/access";
import { MemoryStore } from "@/server/media/memory";
import { saveUpload } from "@/server/media/save-upload";
import type { MediaStore } from "@/server/media/store";
import { sealsOfBook } from "@/server/seal/seals";
import { giftKey, submitReply } from "@/server/seal/unlock";
import type { DocJson, ParagraphNode } from "@/lib/doc/types";
import { MAX_SHEETS_PER_PUBLISH } from "@/lib/doc/validate";
import type { MediaNode } from "@/lib/media/node";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";
import { CAU_DO, dangNiemPhong, henGio, TRAO_DOI } from "../helpers/seal";

const GIO = 60 * 60_000;
/** Moc sua co dinh cho ca tep, sau moc dang that (published_at lay gio may luc chay) nen CHECK rounds_edited_at qua. */
const T = new Date(Date.now() + GIO);
const TEP = new Uint8Array([1, 2, 3, 4]);

type Bo = Awaited<ReturnType<typeof haiCuon>>;

const doan = (chu: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text: chu }] });
const tai = (...content: DocJson["content"]): DocJson => ({ type: "doc", content });
const khoiAnh = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1, h: 1 } });
const anhThat = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1200, h: 900 } });

async function taiAnh(db: TestDb, store: MediaStore, ownerId: string, bookId: string): Promise<string> {
  const record: UploadRecord = { id: randomUUID(), ownerId, bookId, kind: "anh", mime: "image/webp", bytes: TEP.length, width: 1200, height: 900 };
  expect(await saveUpload(db, store, record, TEP.slice())).toBe("saved");
  return record.id;
}

/** Chu gon cua mot to: doan thanh chu, khoi khac thanh ten loai, noi bang "|". */
function chuCua(doc: DocJson): string {
  return doc.content
    .map((b) => (b.type === "paragraph" ? (b.content ?? []).map((x) => (x.type === "text" ? x.text : "")).join("") : b.type))
    .join("|");
}

/** Moi to cua mot cuon theo vi tri: [vi tri, so thu tu luot, chu gon]. */
async function banDo(db: TestDb, bookId: string): Promise<[number, number, string][]> {
  const thuTu = new Map((await roundsOfBook(db, bookId)).map((r) => [r.id, r.ordinal]));
  const rows = await db
    .select({ position: pages.position, roundId: pages.roundId, content: pages.content })
    .from(pages)
    .where(eq(pages.bookId, bookId))
    .orderBy(asc(pages.position));
  return rows.map((r) => [r.position, thuTu.get(r.roundId) ?? 0, chuCua(r.content)]);
}

/** Id va moc phien ban cua luot thu ordinal, doc qua dung duong man sua dung. */
async function moc(s: Bo, ordinal: number, bookId = s.chung): Promise<{ id: string; base: Date }> {
  const r = await readRoundForEdit(s.db, s.seat1.id, bookId, ordinal);
  if (!r) throw new Error("khong thay luot");
  return { id: r.id, base: new Date(r.version) };
}

/** Sua luot thu ordinal cua cuon chung bang cac to mot doan chu. */
async function sua(s: Bo, ordinal: number, chu: string[], now: Date = T): Promise<RoundEditResult> {
  const { id, base } = await moc(s, ordinal);
  return editRound(s.db, s.seat1.id, s.chung, id, chu.map(to), base, now);
}

/** Cac to mot nguoi da xem tren cuon chung, tang dan. Loc ca accountId: cuon co the co dong cua ca hai nguoi. */
const daXem = async (s: Bo, ai: string = s.seat2.id) =>
  (await s.db
    .select({ p: readSheets.position })
    .from(readSheets)
    .where(and(eq(readSheets.bookId, s.chung), eq(readSheets.accountId, ai)))
    .orderBy(asc(readSheets.position))).map((r) => r.p);

/** Danh dau mot nguoi da xem cac to cho san cua cuon chung (khong qua markRead). */
const datDaXem = async (s: Bo, ai: string, ...vi: number[]) => {
  await s.db.insert(readSheets).values(vi.map((position) => ({ accountId: ai, bookId: s.chung, position })));
};

/** Moi dong pages va rounds, theo id: de chung minh khong ghi gi. */
async function chup(db: TestDb) {
  return [await db.select().from(pages).orderBy(asc(pages.id)), await db.select().from(rounds).orderBy(asc(rounds.id))];
}

describe("editRound: doi so to", () => {
  it("tang so to cua luot giua: to sau doi theo, to da xem sau luot cong theo, niem phong phu dung luot, Hoat dong khong doi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await dangNiemPhong(s.db, s.seat1.id, s.chung, CAU_DO, "C1", "C2");
    // To 4 va 5 nam SAU luot sap dai them: nhanh "position > last thi cong delta" voi delta duong chay o day. To 1 nam
    // truoc luot nen phai dung yen.
    await datDaXem(s, s.seat2.id, 1, 4, 5);
    const hoatDong = await s.db.select().from(activity).orderBy(asc(activity.id));
    expect(await sua(s, 2, ["B1", "B2", "B3", "B4"])).toEqual({ status: "saved", first: 2 });
    expect(await banDo(s.db, s.chung)).toEqual([
      [1, 1, "A"], [2, 2, "B1"], [3, 2, "B2"], [4, 2, "B3"], [5, 2, "B4"], [6, 3, "C1"], [7, 3, "C2"],
    ]);
    expect(await daXem(s)).toEqual([1, 6, 7]);
    const [niem] = await sealsOfBook(s.db, s.chung);
    expect([niem.firstPosition, niem.lastPosition]).toEqual([6, 7]);
    const sau = await s.db.select().from(activity).orderBy(asc(activity.id));
    expect(sau.filter((r) => r.kind !== "sua-trang")).toEqual(hoatDong);
    expect(sau.filter((r) => r.kind === "sua-trang").map((r) => [r.roundId, r.bookId])).toEqual([[(await moc(s, 2)).id, s.chung]]);
  });

  it("giam so to cua luot dau: to sau lui lai, to da xem sau luot tru theo", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2", "A3");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await datDaXem(s, s.seat2.id, 4, 5);
    expect(await sua(s, 1, ["A1 A2 A3"])).toEqual({ status: "saved", first: 1 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "A1 A2 A3"], [2, 2, "B1"], [3, 2, "B2"]]);
    expect(await daXem(s)).toEqual([2, 3]);
  });

  it("to da xem trong luot bi cat bot thi mat, to sau luot lui dung delta", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2", "A3");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await datDaXem(s, s.seat2.id, 1, 2, 3, 5);
    expect(await sua(s, 1, ["A1 A2 A3"])).toEqual({ status: "saved", first: 1 });
    expect(await daXem(s, s.seat2.id)).toEqual([1, 3]);
  });

  it("to da xem cua luot bi thu gon chi mat nhung to khong con; to truoc luot khong doi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2", "B3");
    await datDaXem(s, s.seat2.id, 1, 2, 3, 4);
    await sua(s, 2, ["B1 B2 B3"]);
    expect(await daXem(s)).toEqual([1, 2]);
    await sua(s, 2, ["B1 B2 B3", "C", "D"]);
    expect(await daXem(s)).toEqual([1, 2]);
  });

  it("to da xem cua ca hai nguoi: to sau luot lui theo delta, to trong phan bi cat thi mat", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2", "A3");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    // seat2 da xem hai to cuoi cuon (sau luot 1); seat1 da xem to 1 va to 2, to 2 nam trong phan sap bi cat.
    await datDaXem(s, s.seat2.id, 4, 5);
    await datDaXem(s, s.seat1.id, 1, 2);
    expect(await sua(s, 1, ["A1 A2 A3"])).toEqual({ status: "saved", first: 1 });
    expect(await daXem(s, s.seat2.id)).toEqual([2, 3]);
    expect(await daXem(s, s.seat1.id)).toEqual([1]);
  });

  it("giu so to o luot cuoi: vi tri giu nguyen, edited_at cua luot la now", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    expect(await sua(s, 2, ["B1", "B2 đã sửa"])).toEqual({ status: "saved", first: 2 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "A"], [2, 2, "B1"], [3, 2, "B2 đã sửa"]]);
    expect((await roundsOfBook(s.db, s.chung)).map((r) => r.editedAt)).toEqual([null, T]);
  });

  it("giu so to: cac to da xem cua ca hai nguoi khong mat va khong xe dich dong nao", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A");
    await dang(s.db, s.seat1.id, s.chung, "B1", "B2");
    await dang(s.db, s.seat1.id, s.chung, "C");
    await datDaXem(s, s.seat2.id, 1, 2, 3, 4);
    await datDaXem(s, s.seat1.id, 2);
    expect(await sua(s, 2, ["B1 đã sửa", "B2"])).toEqual({ status: "saved", first: 2 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "A"], [2, 2, "B1 đã sửa"], [3, 2, "B2"], [4, 3, "C"]]);
    expect([await daXem(s, s.seat2.id), await daXem(s, s.seat1.id)]).toEqual([[1, 2, 3, 4], [2]]);
  });

  it("to moi mang round_id va published_at cua luot; dau noi tiep o to dau bi bo", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2");
    const [luot] = await roundsOfBook(s.db, s.chung);
    const { id, base } = await moc(s, 1);
    const coDau: DocJson = { type: "doc", content: [{ type: "paragraph", noiTiep: true, content: [{ type: "text", text: "A1 mới" }] }] };
    await editRound(s.db, s.seat1.id, s.chung, id, [coDau, to("A2"), to("Ba")], base, T);
    const cacTo = await s.db.select().from(pages).where(eq(pages.bookId, s.chung)).orderBy(asc(pages.position));
    expect(cacTo.map((t) => [t.roundId, t.publishedAt.getTime()])).toEqual([1, 2, 3].map(() => [luot.id, luot.publishedAt.getTime()]));
    expect(cacTo[0].content).toEqual(to("A1 mới"));
  });

  it("sau khi sua, lan dang ke tiep noi sau to cuoi moi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2", "A3");
    await sua(s, 1, ["A1 A2 A3"]);
    expect(await dang(s.db, s.seat1.id, s.chung, "B")).toEqual({ firstPosition: 2, count: 1 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "A1 A2 A3"], [2, 2, "B"]]);
  });
});

describe("editRound: luat sua", () => {
  it("unchanged: noi dung y het (khac thu tu khoa) thi khong ghi gi, edited_at van null", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
    const truoc = await chup(s.db);
    const daoKhoa = { content: [{ content: [{ text: "Hai", type: "text" }], type: "paragraph" }], type: "doc" } as unknown as DocJson;
    const { id, base } = await moc(s, 1);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Một"), daoKhoa], base, T)).toEqual({ status: "unchanged", first: 1 });
    expect(await chup(s.db)).toEqual(truoc);
  });

  it("to trong o cuoi bi bo; toan to trong hay qua MAX_SHEETS_PER_PUBLISH to thi invalid", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
    const { id, base } = await moc(s, 1);
    const trong: DocJson = { type: "doc", content: [{ type: "paragraph" }] };
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [trong, trong], base, T)).toBe("invalid");
    const nhieu = Array.from({ length: MAX_SHEETS_PER_PUBLISH + 1 }, (_, i) => to(`tờ ${i}`));
    expect(await editRound(s.db, s.seat1.id, s.chung, id, nhieu, base, T)).toBe("invalid");
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Một Hai"), trong, trong], base, T)).toEqual({ status: "saved", first: 1 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "Một Hai"]]);
  });

  it.each<[string, (s: Bo, luot: string, luotRieng: string) => [string, string, string]]>([
    ["nguoi kia sua sach chia se", (s, luot) => [s.seat2.id, s.chung, luot]],
    ["sach khong ton tai", (s, luot) => [s.seat1.id, randomUUID(), luot]],
    ["luot khong ton tai", (s) => [s.seat1.id, s.chung, randomUUID()]],
    ["luot cua cuon khac", (s, _luot, luotRieng) => [s.seat1.id, s.chung, luotRieng]],
    ["bookId rac", (s, luot) => [s.seat1.id, "rac", luot]],
    ["roundId rac", (s) => [s.seat1.id, s.chung, "rac"]],
  ])("not-found (%s): khong dong nao doi", async (_ten, lay) => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    await dang(s.db, s.seat1.id, s.rieng, "Riêng");
    const { id, base } = await moc(s, 1);
    const [luotRieng] = await roundsOfBook(s.db, s.rieng);
    const truoc = await chup(s.db);
    const [ai, sach, luot] = lay(s, id, luotRieng.id);
    expect(await editRound(s.db, ai, sach, luot, [to("Chiếm")], base, T)).toBe("not-found");
    expect(await chup(s.db)).toEqual(truoc);
  });

  it("cau do con dong voi nguoi kia: chu sach viet them duoc, niem phong van con nguyen", async () => {
    const s = await haiCuon();
    await dangNiemPhong(s.db, s.seat1.id, s.chung, CAU_DO, "Khóa");
    const [niem] = await sealsOfBook(s.db, s.chung);
    const [luot] = await roundsOfBook(s.db, s.chung);
    expect(await editRound(s.db, s.seat1.id, s.chung, luot.id, [to("Khóa này mở ra rồi")], luot.publishedAt, T)).toEqual({ status: "saved", first: 1 });
    expect(await banDo(s.db, s.chung)).toEqual([[1, 1, "Khóa này mở ra rồi"]]);
    const [sau] = await sealsOfBook(s.db, s.chung);
    expect(sau).toEqual(niem);
    expect(await giftKey(s.db, s.seat1.id, niem.id, "", T)).toMatchObject({ status: "opened" });
  });

  it("trao doi chua co trang tra loi: chu sach sua chinh ta duoc", async () => {
    const s = await haiCuon();
    await dangNiemPhong(s.db, s.seat1.id, s.chung, TRAO_DOI, "Khóa cửa sỏ");
    const [niem] = await sealsOfBook(s.db, s.chung);
    const [luot] = await roundsOfBook(s.db, s.chung);
    expect(await editRound(s.db, s.seat1.id, s.chung, luot.id, [to("Khóa cửa sổ")], luot.publishedAt, T)).toEqual({ status: "saved", first: 1 });
    expect(await submitReply(s.db, s.seat2.id, niem.id, to("Trả lời"), T)).toMatchObject({ status: "opened" });
  });

  it("hen gio chua toi gio: chu sach van sua duoc (chu du an cho sua ca trang niem phong)", async () => {
    const s = await haiCuon();
    const mo = new Date(Date.now() + 2 * GIO);
    await dangNiemPhong(s.db, s.seat1.id, s.chung, henGio(mo), "Hẹn");
    const [luot] = await roundsOfBook(s.db, s.chung);
    expect(await editRound(s.db, s.seat1.id, s.chung, luot.id, [to("Hẹn gặp lại")], luot.publishedAt, T)).toEqual({ status: "saved", first: 1 });
  });

  it("deleted: xoa mot chu, doi han mot chu, hay bo ca to cu thi tu choi va khong ghi gi", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Sáng nay trời mưa", "Anh nhớ không");
    const { id, base } = await moc(s, 1);
    const truoc = await chup(s.db);
    for (const cacTo of [["Sáng nay mưa", "Anh nhớ không"], ["Sáng nay trời nắng", "Anh nhớ không"], ["Sáng nay trời mưa"]]) {
      expect(await editRound(s.db, s.seat1.id, s.chung, id, cacTo.map(to), base, T), cacTo.join("|")).toBe("deleted");
    }
    expect(await chup(s.db)).toEqual(truoc);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Sáng nay trời mưa to"), to("Anh nhớ không?")], base, T))
      .toEqual({ status: "saved", first: 1 });
  });

  it("stale: moc cu thi tu choi; hai lan sua noi nhau voi moc dung deu qua va moc tang moi lan", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const { id, base } = await moc(s, 1);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Một hai")], base, T)).toEqual({ status: "saved", first: 1 });
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Một hai ba")], base, T)).toBe("stale");
    const lan2 = await moc(s, 1);
    expect(lan2.base.getTime()).toBe(T.getTime());
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Một hai ba")], lan2.base, T)).toEqual({ status: "saved", first: 1 });
    expect((await moc(s, 1)).base.getTime()).toBe(T.getTime() + 1);
  });

  it("moc phien ban khong doc duoc: stale ngay, khong cham database (base.toISOString se nem RangeError)", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const { id } = await moc(s, 1);
    const truoc = await chup(s.db);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [to("Hai")], new Date("rác"), T)).toBe("stale");
    expect(await chup(s.db)).toEqual(truoc);
  });

  it("edited_at khong som hon published_at du dong ho truyen vao lui ve truoc", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một");
    const { id, base } = await moc(s, 1);
    await editRound(s.db, s.seat1.id, s.chung, id, [to("Một hai")], base, new Date(0));
    const [luot] = await roundsOfBook(s.db, s.chung);
    expect(luot.editedAt?.getTime()).toBe(luot.publishedAt.getTime() + 1);
  });
});

describe("editRound: media", () => {
  it("giu anh dang co tren luot va gan anh vua tai; bo mot anh cu thi deleted, khong ghi gi", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const giu = await taiAnh(s.db, store, s.seat1.id, s.chung);
    const giu2 = await taiAnh(s.db, store, s.seat1.id, s.chung);
    await publishDraft(s.db, s.seat1.id, s.chung, [tai(doan("Một"), khoiAnh(giu)), tai(khoiAnh(giu2))]);
    const moi = await taiAnh(s.db, store, s.seat1.id, s.chung);
    const { id, base } = await moc(s, 1);
    const truoc = await chup(s.db);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [tai(doan("Một"), khoiAnh(giu), khoiAnh(moi))], base, T)).toBe("deleted");
    expect(await chup(s.db)).toEqual(truoc);
    expect(await editRound(s.db, s.seat1.id, s.chung, id, [tai(doan("Một"), khoiAnh(giu), khoiAnh(moi)), tai(khoiAnh(giu2))], base, T))
      .toEqual({ status: "saved", first: 1 });
    const [to1] = await s.db.select({ content: pages.content }).from(pages).where(eq(pages.bookId, s.chung)).orderBy(asc(pages.position));
    expect(to1.content).toEqual(tai(doan("Một"), anhThat(giu), anhThat(moi)));
    expect((await canViewMedia(s.db, s.seat2.id, giu2, T))?.id).toBe(giu2);
    expect((await canViewMedia(s.db, s.seat2.id, moi, T))?.id).toBe(moi);
  });

  it("id cua luot khac, id dang nam trong nhap, id cua cuon khac: invalid-media, khong ghi gi", async () => {
    const s = await haiCuon();
    const store = new MemoryStore();
    const luotKhac = await taiAnh(s.db, store, s.seat1.id, s.chung);
    await publishDraft(s.db, s.seat1.id, s.chung, [tai(khoiAnh(luotKhac))]);
    await dang(s.db, s.seat1.id, s.chung, "Hai");
    const trongNhap = await taiAnh(s.db, store, s.seat1.id, s.chung);
    expect(await saveDraft(s.db, s.seat1.id, s.chung, tai(khoiAnh(trongNhap)), 1)).toBeInstanceOf(Date);
    const cuonKhac = await taiAnh(s.db, store, s.seat1.id, s.rieng);
    const { id, base } = await moc(s, 2);
    const truoc = await chup(s.db);
    for (const la of [luotKhac, trongNhap, cuonKhac]) {
      expect(await editRound(s.db, s.seat1.id, s.chung, id, [tai(doan("Hai"), khoiAnh(la))], base, T), la).toBe("invalid-media");
    }
    expect(await chup(s.db)).toEqual(truoc);
  });
});

describe("doc luot cho man sua", () => {
  it("readRoundForEdit: tra cac to va moc; luot niem phong con dong cung tra noi dung cho chu sach, kem co niemPhong", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
    await dangNiemPhong(s.db, s.seat1.id, s.chung, henGio(new Date(Date.now() + GIO)), "BÍ MẬT HẸN GIỜ");
    const mot = await readRoundForEdit(s.db, s.seat1.id, s.chung, 1);
    expect(mot).toMatchObject({ ordinal: 1, first: 1, sheets: [to("Một"), to("Hai")], bookTitle: "Chuyện chưa kể", editedAt: null, niemPhong: false });
    expect(mot?.version).toBe(mot?.publishedAt.toISOString());
    const hai = await readRoundForEdit(s.db, s.seat1.id, s.chung, 2);
    expect(hai).toMatchObject({ ordinal: 2, first: 3, sheets: [to("BÍ MẬT HẸN GIỜ")], niemPhong: true });
    const sai: [string, string, number][] = [[s.seat2.id, s.chung, 1], [s.seat1.id, s.chung, 3], [s.seat1.id, s.chung, 0], [s.seat1.id, "rac", 1]];
    for (const [ai, sach, so] of sai) expect(await readRoundForEdit(s.db, ai, sach, so)).toBeNull();
  });

  it("roundOfPosition va ownRoundExists", async () => {
    const s = await haiCuon();
    await dang(s.db, s.seat1.id, s.chung, "A1", "A2");
    await dang(s.db, s.seat1.id, s.chung, "B");
    expect(await roundOfPosition(s.db, s.seat1.id, s.chung, 2)).toEqual({ ordinal: 1, sheet: 2 });
    expect(await roundOfPosition(s.db, s.seat1.id, s.chung, 3)).toEqual({ ordinal: 2, sheet: 1 });
    expect(await roundOfPosition(s.db, s.seat1.id, s.chung, 4)).toBeNull();
    expect(await roundOfPosition(s.db, s.seat2.id, s.chung, 1)).toBeNull();
    expect(await ownRoundExists(s.db, s.seat1.id, s.chung, 2)).toBe(true);
    expect(await ownRoundExists(s.db, s.seat1.id, s.chung, 3)).toBe(false);
    expect(await ownRoundExists(s.db, s.seat2.id, s.chung, 1)).toBe(false);
    expect(await ownRoundExists(s.db, s.seat1.id, "rac", 1)).toBe(false);
  });
});
