import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { bookCovers, books, media, seals } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { setDraftTrim } from "@/server/library/drafts";
import { bindMedia, canViewMedia, recordUpload, type UploadRecord } from "@/server/media/access";
import type { ParagraphNode } from "@/lib/doc/types";
import { mediaStoreKey } from "@/lib/media/key";
import { PEAK_COUNT } from "@/lib/media/kinds";
import type { MediaNode } from "@/lib/media/node";
import type { TestDb } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotCua, themLuot } from "../helpers/round";

const NOW = new Date("2026-09-16T08:00:00.000Z");
const ms = (n: number) => new Date(NOW.getTime() + n);
const phut = (n: number) => ms(n * 60_000);
const SONG = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 7) % 101);

type Bo = Awaited<ReturnType<typeof haiCuon>>;
type Khoi = ParagraphNode | MediaNode;

const anh = (ownerId: string, bookId: string): UploadRecord => ({
  id: randomUUID(), ownerId, bookId, kind: "anh", mime: "image/webp", bytes: 2048, width: 1200, height: 900,
});
const ghiAm = (ownerId: string, bookId: string): UploadRecord => ({
  id: randomUUID(), ownerId, bookId, kind: "ghi-am", mime: "audio/webm", bytes: 4096, durationMs: 42_000, peaks: SONG,
});
const bia = (ownerId: string, bookId: string | null): UploadRecord => ({
  id: randomUUID(), ownerId, bookId, kind: "bia", mime: "image/jpeg", bytes: 1024, width: 1200, height: 720,
});

/** Ghi dong media qua dung duong that; tra id. */
async function tai(db: TestDb, record: UploadRecord): Promise<string> {
  if (!(await recordUpload(db, record))) throw new Error("khong ghi duoc media");
  return record.id;
}

const doan = (chu: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text: chu }] });
const khoiAnh = (id: string): MediaNode => ({ type: "anh", attrs: { id, w: 1, h: 1 } });

// DocJson chua co khoi media (chua co trong union), nen to va nhap co media duoc ghi thang jsonb bang SQL; moi to la mot
// luot rieng.
async function to(db: TestDb, bookId: string, position: number, ...content: Khoi[]) {
  await themLuot(db, bookId, position, [{ type: "doc", content }]);
}
async function nhap(db: TestDb, bookId: string, ...content: Khoi[]) {
  await db.execute(sql`insert into drafts (book_id, content) values (${bookId}, ${JSON.stringify({ type: "doc", content })}::jsonb)`);
}

/** Niem phong ghi thang vao bang, phu dung luot cua mot to. Hen gio mo sau NOW 30 phut. */
async function niemPhong(db: TestDb, bookId: string, position: number, kind: "cau-do" | "hen-gio") {
  const cot = kind === "hen-gio" ? { kind, opensAt: phut(30) } : { kind, question: "Ở đâu?", answers: ["ben xe"] };
  const [row] = await db.insert(seals).values({ bookId, roundId: await luotCua(db, bookId, position), teaser: "", ...cot }).returning({ id: seals.id });
  return row.id;
}

/**
 * Dat mot anh vao o bia MO DAU cua mot cuon, ghi thang vao bang: cac ca duoi day can ca nhung trang thai ma
 * setCoverEntry khong bao gio tao ra. createBook da chen san o mo dau nen day phai la UPDATE; mot
 * `insert ... onConflictDoNothing` se lang le khong ghi gi va lam moi bai duoi day xanh gia. Doc lai ngay sau khi ghi
 * chinh la cai chan do: mot lan dung rong khong the loi qua ma khong ai thay.
 */
async function oBia(db: TestDb, bookId: string, cover: "nui-xa" | "hoa-dao", coverMediaId: string | null) {
  const da = await db
    .update(bookCovers)
    .set({ cover, coverMediaId })
    .where(and(eq(bookCovers.bookId, bookId), isNull(bookCovers.roundId)))
    .returning({ id: bookCovers.id });
  if (da.length === 0) await db.insert(bookCovers).values({ bookId, roundId: null, cover, coverMediaId });
  const o = await db.select({ c: bookCovers.coverMediaId }).from(bookCovers).where(and(eq(bookCovers.bookId, bookId), isNull(bookCovers.roundId)));
  expect(o).toEqual([{ c: coverMediaId }]);
}

/** Ket qua canViewMedia cua chu sach (seat1) va nguoi kia (seat2), gon thanh id hoac null. */
async function aiThay(s: Bo, id: string, luc: Date = NOW) {
  return [(await canViewMedia(s.db, s.seat1.id, id, luc))?.id ?? null, (await canViewMedia(s.db, s.seat2.id, id, luc))?.id ?? null];
}

describe("recordUpload", () => {
  it("ghi dong voi key tinh bang mediaStoreKey: anh, ghi am vao sach cua minh, ke ca rieng tu; bia cho gan o tien to cho", async () => {
    const s = await haiCuon();
    const records = [anh(s.seat1.id, s.rieng), ghiAm(s.seat1.id, s.chung), bia(s.seat1.id, null)];
    for (const r of records) expect(await recordUpload(s.db, r)).toBe(true);
    const rows = await s.db.select().from(media);
    expect(rows.map((r) => [r.id, r.kind, r.bookId, r.storeKey]).sort()).toEqual([
      [records[0].id, "anh", s.rieng, mediaStoreKey(s.rieng, records[0].id, "image/webp")],
      [records[1].id, "ghi-am", s.chung, mediaStoreKey(s.chung, records[1].id, "audio/webm")],
      [records[2].id, "bia", null, mediaStoreKey(null, records[2].id, "image/jpeg")],
    ].sort());
    expect(rows.find((r) => r.kind === "ghi-am")).toMatchObject({ durationMs: 42_000, peaks: SONG, width: null, height: null, bytes: 4096 });
  });

  it("sach cua nguoi kia, sach khong ton tai hay id sach sai dang: khong ghi va tra false", async () => {
    const s = await haiCuon();
    for (const bookId of [s.chung, randomUUID(), "khong-phai-uuid"]) {
      expect(await recordUpload(s.db, anh(s.seat2.id, bookId))).toBe(false);
    }
    expect(await recordUpload(s.db, bia(s.seat2.id, s.rieng))).toBe(false);
    expect(await s.db.select().from(media)).toEqual([]);
  });
});

describe("bindMedia", () => {
  it("ghi de thuoc tinh tu bang, bo thuoc tinh la, giu nguyen khoi khac va thu tu", async () => {
    const s = await haiCuon();
    const a = await tai(s.db, anh(s.seat1.id, s.chung));
    const g = await tai(s.db, ghiAm(s.seat1.id, s.chung));
    const noiDoi = { id: a, w: 9999, h: 1, src: "https://ngoai.example/anh.webp" };
    const doc = {
      type: "doc" as const,
      content: [doan("Mở đầu"), { type: "anh" as const, attrs: noiDoi }, { type: "ghi-am" as const, attrs: { id: g, ms: 1, peaks: [] } }, doan("Kết")],
    };
    expect(await bindMedia(s.db, s.seat1.id, s.chung, doc)).toEqual({
      type: "doc",
      content: [
        doan("Mở đầu"), { type: "anh", attrs: { id: a, w: 1200, h: 900 } }, { type: "ghi-am", attrs: { id: g, ms: 42_000, peaks: SONG } }, doan("Kết"),
      ],
    });
  });

  it("tai lieu khong co media thi tra ban sao nguyen ven", async () => {
    const s = await haiCuon();
    const doc = { type: "doc" as const, content: [doan("Chỉ có chữ")] };
    const bound = await bindMedia(s.db, s.seat1.id, s.chung, doc);
    expect(bound).toEqual(doc);
    expect(bound?.content).not.toBe(doc.content);
  });

  it("id dang nam trong nhap hien tai gan lai duoc o moi lan tu luu; chu trong to da dang trung id khong chan", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await nhap(s.db, s.chung, khoiAnh(id));
    await to(s.db, s.chung, 1, doan(id), doan(`/m/${id}`));
    expect(await bindMedia(s.db, s.seat1.id, s.chung, { type: "doc", content: [khoiAnh(id)] })).toEqual({
      type: "doc", content: [{ type: "anh", attrs: { id, w: 1200, h: 900 } }],
    });
  });

  type Muon = [string, (s: Bo) => Promise<{ ownerId: string; bookId: string; content: object[] }>];

  it.each<Muon>([
    ["id media cua nguoi kia", async (s) => {
      const cuaKia = await createBook(s.db, s.seat2.id, { title: "Của người kia", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
      const id = await tai(s.db, anh(s.seat2.id, cuaKia));
      return { ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(id)] };
    }],
    ["id media cua cuon khac cung chu", async (s) => ({
      ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(await tai(s.db, anh(s.seat1.id, s.rieng)))],
    })],
    ["nguoi kia gan id cua chu vao sach cua chu", async (s) => ({
      ownerId: s.seat2.id, bookId: s.chung, content: [khoiAnh(await tai(s.db, anh(s.seat1.id, s.chung)))],
    })],
    ["id ghi am dat trong khoi anh", async (s) => ({
      ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(await tai(s.db, ghiAm(s.seat1.id, s.chung)))],
    })],
    ["id bia dat trong khoi anh", async (s) => ({
      ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(await tai(s.db, bia(s.seat1.id, s.chung)))],
    })],
    ["id da nam trong mot to da dang khong khoa cua cuon", async (s) => {
      const id = await tai(s.db, anh(s.seat1.id, s.chung));
      await to(s.db, s.chung, 1, doan("Đã đăng"), khoiAnh(id));
      return { ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(id)] };
    }],
    ["id thu hai da nam trong to hen gio con khoa: chep sang nhap moi de lo truoc gio mo", async (s) => {
      const moi = await tai(s.db, anh(s.seat1.id, s.chung));
      const daKhoa = await tai(s.db, anh(s.seat1.id, s.chung));
      await to(s.db, s.chung, 1, khoiAnh(daKhoa));
      await niemPhong(s.db, s.chung, 1, "hen-gio");
      return { ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(moi), khoiAnh(daKhoa)] };
    }],
    ["id khong co dong", async (s) => ({ ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(randomUUID())] })],
    ["id khong phai uuid", async (s) => ({ ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh("khong-phai-uuid")] })],
    ["khoi media thieu attrs", async (s) => ({ ownerId: s.seat1.id, bookId: s.chung, content: [{ type: "ghi-am" }] })],
    ["mot khoi sai giua hai khoi dung", async (s) => {
      const dung = await tai(s.db, anh(s.seat1.id, s.chung));
      return { ownerId: s.seat1.id, bookId: s.chung, content: [khoiAnh(dung), khoiAnh(randomUUID()), khoiAnh(dung)] };
    }],
    ["id sach sai dang", async (s) => ({
      ownerId: s.seat1.id, bookId: "khong-phai-uuid", content: [khoiAnh(await tai(s.db, anh(s.seat1.id, s.chung)))],
    })],
  ])("tu choi ca tai lieu: %s", async (_ten, dung) => {
    const s = await haiCuon();
    const { ownerId, bookId, content } = await dung(s);
    expect(await bindMedia(s.db, ownerId, bookId, { type: "doc", content: [doan("chữ"), ...(content as { type: string }[])] })).toBeNull();
  });
});

describe("canViewMedia", () => {
  it("to da dang khong khoa cua sach chia se: ca hai tai duoc, chi nhan cot route can", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, doan("Mưa"), khoiAnh(id));
    const want = { id, kind: "anh", mime: "image/webp", bytes: 2048, storeKey: mediaStoreKey(s.chung, id, "image/webp") };
    expect(await canViewMedia(s.db, s.seat1.id, id, NOW)).toEqual(want);
    expect(await canViewMedia(s.db, s.seat2.id, id, NOW)).toEqual(want);
  });

  it("sach rieng tu: nguoi kia null ke ca media o to da dang; sach chuyen sang rieng tu thi mat quyen ngay", async () => {
    const s = await haiCuon();
    const rieng = await tai(s.db, ghiAm(s.seat1.id, s.rieng));
    await to(s.db, s.rieng, 1, khoiAnh(rieng));
    expect(await aiThay(s, rieng)).toEqual([rieng, null]);
    const chung = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, khoiAnh(chung));
    expect(await aiThay(s, chung)).toEqual([chung, chung]);
    await s.db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, s.chung));
    expect(await aiThay(s, chung)).toEqual([chung, null]);
  });

  it("to trong cau do chua mo: nguoi kia null, chu sach duoc; mo roi thi nguoi kia duoc", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, doan("Mở"));
    await to(s.db, s.chung, 2, doan("Khóa"), khoiAnh(id));
    const sealId = await niemPhong(s.db, s.chung, 2, "cau-do");
    expect(await aiThay(s, id)).toEqual([id, null]);
    await s.db.update(seals).set({ openedAt: phut(-1) }).where(eq(seals.id, sealId));
    expect(await aiThay(s, id)).toEqual([id, id]);
  });

  it("hen gio khoa ca chu sach: ca hai null toi truoc opensAt mot ms, ca hai tai duoc tu dung opensAt", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, ghiAm(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, khoiAnh(id));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    expect(await aiThay(s, id, ms(30 * 60_000 - 1))).toEqual([null, null]);
    expect(await aiThay(s, id, phut(30))).toEqual([id, id]);
  });

  it("media cua to hen gio con khoa van kin voi chu sach du nhap hien tai cung chua id do", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, khoiAnh(id));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    await nhap(s.db, s.chung, khoiAnh(id));
    expect(await aiThay(s, id)).toEqual([null, null]);
  });

  it("cung media o mot to hen gio con khoa va mot to mo: chi can mot to mo, voi ca hai", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, khoiAnh(id));
    await to(s.db, s.chung, 2, khoiAnh(id));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    expect(await aiThay(s, id)).toEqual([id, id]);
  });

  it("chua to da dang nao chua media (chi trong nhap, hay tai len chua luu): chi chu sach", async () => {
    const s = await haiCuon();
    const trongNhap = await tai(s.db, anh(s.seat1.id, s.chung));
    await nhap(s.db, s.chung, doan("Nháp"), khoiAnh(trongNhap));
    const chuaGan = await tai(s.db, ghiAm(s.seat1.id, s.chung));
    expect(await aiThay(s, trongNhap)).toEqual([trongNhap, null]);
    expect(await aiThay(s, chuaGan)).toEqual([chuaGan, null]);
  });

  it("jsonpath chay that tren PGlite: chi khop attrs.id cua khoi cap cao nhat, chu trung id khong khop", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, doan(id), { type: "paragraph", content: [{ type: "text", text: `/m/${id}` }] });
    expect(await aiThay(s, id)).toEqual([id, null]);
    const res = await s.db.execute(sql`select jsonb_path_exists('{"content":[{"type":"anh","attrs":{"id":"y"}}]}'::jsonb, '$.content[*] ? (@.attrs.id == $ids[*])', '{"ids":["x","y"]}'::jsonb) as co`);
    expect(res.rows).toEqual([{ co: true }]);
  });

  it("anh trong o bia: chu sach duoc, nguoi kia duoc khi sach chia se, ke ca khi id do nam trong to hen gio con khoa", async () => {
    const s = await haiCuon();
    const biaChung = await tai(s.db, bia(s.seat1.id, s.chung));
    const biaRieng = await tai(s.db, bia(s.seat1.id, s.rieng));
    const choGan = await tai(s.db, bia(s.seat1.id, null));
    await oBia(s.db, s.chung, "nui-xa", biaChung);
    await oBia(s.db, s.rieng, "nui-xa", biaRieng);
    await to(s.db, s.chung, 1, khoiAnh(biaChung));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    expect(await aiThay(s, biaChung)).toEqual([biaChung, biaChung]);
    expect(await aiThay(s, biaRieng)).toEqual([biaRieng, null]);
    expect(await aiThay(s, choGan)).toEqual([choGan, null]);
  });

  it("anh bia CHUA o nao chon: chu sach van xem duoc (do la kho anh cua ho), nguoi kia thi khong", async () => {
    const s = await haiCuon();
    const trongKho = await tai(s.db, bia(s.seat1.id, s.chung));
    expect(await aiThay(s, trongKho)).toEqual([trongKho, null]);
  });

  it("anh bia nam trong mot o CU (khong phai o moi nhat) thi nguoi kia van xem duoc", async () => {
    const s = await haiCuon();
    const cu = await tai(s.db, bia(s.seat1.id, s.chung));
    const moi = await tai(s.db, bia(s.seat1.id, s.chung));
    await oBia(s.db, s.chung, "nui-xa", cu);
    const luot = await themLuot(s.db, s.chung, 1, [{ type: "doc", content: [doan("Một")] }]);
    await s.db.insert(bookCovers).values({ bookId: s.chung, roundId: luot, cover: "hoa-dao", coverMediaId: moi });
    expect(await aiThay(s, cu)).toEqual([cu, cu]);
    expect(await aiThay(s, moi)).toEqual([moi, moi]);
  });

  it("anh bi bo khoi moi o: nguoi kia mat quyen ngay lan doc sau, chu sach thi khong", async () => {
    const s = await haiCuon();
    const anhBia = await tai(s.db, bia(s.seat1.id, s.chung));
    await oBia(s.db, s.chung, "nui-xa", anhBia);
    expect(await aiThay(s, anhBia)).toEqual([anhBia, anhBia]);
    await oBia(s.db, s.chung, "nui-xa", null);
    expect(await aiThay(s, anhBia)).toEqual([anhBia, null]);
  });

  it("o cua cuon KHAC chon anh nay: khong mo duoc quyen, ca khi cuon cua chinh anh la cuon chia se", async () => {
    const s = await haiCuon();
    const cuaRieng = await tai(s.db, bia(s.seat1.id, s.rieng));
    await oBia(s.db, s.chung, "nui-xa", cuaRieng);
    expect(await aiThay(s, cuaRieng)).toEqual([cuaRieng, null]);

    const khac = await createBook(s.db, s.seat1.id, { title: "Cuốn khác", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    const cuaChung = await tai(s.db, bia(s.seat1.id, s.chung));
    await oBia(s.db, khac, "nui-xa", cuaChung);
    expect(await aiThay(s, cuaChung)).toEqual([cuaChung, null]);
  });

  it("cuon chuyen sang rieng tu: nguoi kia mat quyen xem bia ngay lan doc sau", async () => {
    const s = await haiCuon();
    const anhBia = await tai(s.db, bia(s.seat1.id, s.chung));
    await oBia(s.db, s.chung, "nui-xa", anhBia);
    expect(await aiThay(s, anhBia)).toEqual([anhBia, anhBia]);
    await s.db.update(books).set({ mode: "rieng-tu" }).where(eq(books.id, s.chung));
    expect(await aiThay(s, anhBia)).toEqual([anhBia, null]);
  });

  // setDraftTrim gan anh bia vao cuon NGAY luc nguoi viet chon, tu truoc khi dang: day la duong duy nhat cho mot anh
  // thuoc ve cuon ma chua thuoc ve o bia nao. Phai kin voi nguoi kia cho toi luc no thanh o that.
  it("bia moi chon cho luot sap dang: da thuoc cuon nhung chua vao o nao, chi chu sach thay", async () => {
    const s = await haiCuon();
    const choGan = bia(s.seat1.id, null);
    await tai(s.db, choGan);
    expect(await setDraftTrim(s.db, s.seat1.id, s.chung, { cover: "nui-xa", coverMediaId: choGan.id, youtubeId: null, dropTrack: false })).toBe("saved");
    expect(await aiThay(s, choGan.id)).toEqual([choGan.id, null]);
  });

  it("dong kind = 'anh' bi dat vao mot o bia (cot khong co CHECK rang buoc kind): khong duoc loi tat, van xet to va niem phong, nen ca chu sach cung null khi to con khoa", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await to(s.db, s.chung, 1, khoiAnh(id));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    await oBia(s.db, s.chung, "nui-xa", id);
    expect(await aiThay(s, id)).toEqual([null, null]);
  });

  it("ghi am cua chu sach khong bao gio di qua nhanh bia, ke ca khi bi dat vao mot o", async () => {
    const s = await haiCuon();
    const g = await tai(s.db, ghiAm(s.seat1.id, s.chung));
    await oBia(s.db, s.chung, "nui-xa", g);
    expect(await aiThay(s, g)).toEqual([g, null]);
    await to(s.db, s.chung, 1, khoiAnh(g));
    await niemPhong(s.db, s.chung, 1, "hen-gio");
    expect(await aiThay(s, g)).toEqual([null, null]);
  });

  // Nhanh tat cua bia bo qua han luat to va niem phong, nen no chi an toan chung nao KHONG duong ghi nao dua duoc mot
  // dong kind = 'bia' len mot to da dang. bindMedia la cua duy nhat vao pages.content; bai nay canh chinh cai cua do,
  // de neu ai do noi long no sau nay thi do ngay tai day chu khong am tham mo lai lo hong.
  it("bat bien cua nhanh tat bia: bindMedia khong bao gio cho mot dong kind = 'bia' len mot to", async () => {
    const s = await haiCuon();
    const anhBia = await tai(s.db, bia(s.seat1.id, s.chung));
    const thuong = await tai(s.db, anh(s.seat1.id, s.chung));
    await oBia(s.db, s.chung, "nui-xa", anhBia);
    expect(await bindMedia(s.db, s.seat1.id, s.chung, { type: "doc", content: [khoiAnh(anhBia)] })).toBeNull();
    expect(await bindMedia(s.db, s.seat1.id, s.chung, { type: "doc", content: [khoiAnh(thuong)] })).toEqual({
      type: "doc", content: [{ type: "anh", attrs: { id: thuong, w: 1200, h: 900 } }],
    });
  });

  it("id khong phai uuid hay khong co dong: null voi ca hai", async () => {
    const s = await haiCuon();
    for (const id of ["khong-phai-uuid", "", randomUUID()]) {
      expect([await canViewMedia(s.db, s.seat1.id, id, NOW), await canViewMedia(s.db, s.seat2.id, id, NOW)]).toEqual([null, null]);
    }
  });

  it("doc qua readSnapshot: khong nhan mot giao dich dang chay", async () => {
    const s = await haiCuon();
    const id = await tai(s.db, anh(s.seat1.id, s.chung));
    await s.db.transaction(async (tx) => {
      await expect(canViewMedia(tx, s.seat1.id, id, NOW)).rejects.toThrow("readSnapshot");
    });
  });
});
