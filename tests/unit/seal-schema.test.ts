import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { books, sealAttempts, sealReplies, seals } from "@/server/db/schema";
import { viPham } from "../helpers/db";
import { dang, haiCuon, to } from "../helpers/library";

async function coSach() {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Một", "Hai");
  return s;
}

type SealInsert = typeof seals.$inferInsert;

const cauDo = (bookId: string): SealInsert => ({
  bookId, firstPosition: 1, lastPosition: 2, kind: "cau-do",
  question: "Ở đâu?", answers: ["ben xe"], hints: ["Có xe"], teaser: "Một",
});
const henGio = (bookId: string): SealInsert => ({
  bookId, firstPosition: 1, lastPosition: 1, kind: "hen-gio", opensAt: new Date("2030-01-01T00:00:00.000Z"), teaser: "",
});
const traoDoi = (bookId: string): SealInsert => ({
  bookId, firstPosition: 1, lastPosition: 1, kind: "trao-doi", question: "Nghĩ gì?", teaser: "",
});

describe("bang seals", () => {
  it("nhan dung hinh ca ba loai", async () => {
    const { db, chung } = await coSach();
    await db.insert(seals).values(cauDo(chung));
    await db.insert(seals).values({ ...traoDoi(chung), firstPosition: 3, lastPosition: 3 });
    await db.insert(seals).values({ ...henGio(chung), firstPosition: 4, lastPosition: 5 });
    expect(await db.select().from(seals)).toHaveLength(3);
  });

  it("nhan dung bien tren cua moi gioi han", async () => {
    const { db, chung } = await coSach();
    await db.insert(seals).values({
      ...cauDo(chung),
      question: "a".repeat(200),
      answers: ["a", "b", "c", "d", "e"],
      hints: ["1", "2", "3"],
      giftNote: "a".repeat(200),
      teaser: "a".repeat(81),
    });
    expect(await db.select().from(seals)).toHaveLength(1);
  });

  // Moi hang chi sai dung mot luat; "loai la" phai bo ca dap an va goi y de khong vap seals_dap_an truoc.
  it.each([
    ["loai la", { kind: "mat-khau", answers: [], hints: [] }, "seals_kind"],
    ["vi tri dau nho hon 1", { firstPosition: 0 }, "seals_range"],
    ["vi tri cuoi truoc vi tri dau", { firstPosition: 2, lastPosition: 1 }, "seals_range"],
    ["khong dap an", { answers: [] }, "seals_dap_an"],
    ["qua 5 dap an", { answers: ["a", "b", "c", "d", "e", "f"] }, "seals_dap_an"],
    ["qua 3 goi y", { hints: ["1", "2", "3", "4"] }, "seals_goi_y"],
    ["thieu cau hoi", { question: null }, "seals_thu_thach"],
    ["co gio mo", { opensAt: new Date() }, "seals_thu_thach"],
    ["cau hoi rong", { question: "" }, "seals_cau_hoi"],
    ["cau hoi qua 200 ky tu", { question: "a".repeat(201) }, "seals_cau_hoi"],
    ["loi nhan qua 200 ky tu", { giftNote: "a".repeat(201) }, "seals_loi_nhan"],
    ["dong he lo qua dai", { teaser: "a".repeat(82) }, "seals_he_lo"],
  ])("tu choi cau do sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const { db, chung } = await coSach();
    await viPham(db.insert(seals).values({ ...cauDo(chung), ...sua } as SealInsert), rangBuoc);
  });

  it.each([
    ["thieu gio mo", { opensAt: null }, "seals_hen_gio"],
    ["co cau hoi", { question: "Ở đâu?" }, "seals_hen_gio"],
    ["co dap an", { answers: ["a"] }, "seals_dap_an"],
    ["co goi y", { hints: ["a"] }, "seals_goi_y"],
    ["da duoc mo som", { openedAt: new Date() }, "seals_hen_gio"],
    ["co loi nhan tang chia khoa", { giftNote: "Cho em" }, "seals_hen_gio"],
  ])("tu choi hen gio sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const { db, chung } = await coSach();
    await viPham(db.insert(seals).values({ ...henGio(chung), ...sua } as SealInsert), rangBuoc);
  });

  it.each([
    ["co dap an", { answers: ["a"] }, "seals_dap_an"],
    ["co goi y", { hints: ["a"] }, "seals_goi_y"],
    ["thieu cau hoi", { question: null }, "seals_thu_thach"],
    ["co gio mo", { opensAt: new Date() }, "seals_thu_thach"],
  ])("tu choi trao doi sai hinh: %s", async (_ten, sua, rangBuoc) => {
    const { db, chung } = await coSach();
    await viPham(db.insert(seals).values({ ...traoDoi(chung), ...sua } as SealInsert), rangBuoc);
  });

  it("hai niem phong khong duoc bat dau cung mot vi tri trong mot cuon", async () => {
    const { db, chung } = await coSach();
    await db.insert(seals).values(cauDo(chung));
    await viPham(db.insert(seals).values({ ...traoDoi(chung), firstPosition: 1 }), "seals_book_first_idx");
  });

  it("xoa sach thi xoa theo niem phong, cac lan thu va trang tra loi", async () => {
    const { db, seat2, chung } = await coSach();
    const [s] = await db.insert(seals).values(cauDo(chung)).returning({ id: seals.id });
    await db.insert(sealAttempts).values({ sealId: s.id, accountId: seat2.id, guess: "sai", correct: false });
    await db.insert(sealReplies).values({ sealId: s.id, accountId: seat2.id, content: to("Trả lời") });
    await db.delete(books).where(eq(books.id, chung));
    expect(await db.select().from(seals)).toHaveLength(0);
    expect(await db.select().from(sealAttempts)).toHaveLength(0);
    expect(await db.select().from(sealReplies)).toHaveLength(0);
  });

  it("mot niem phong co nhieu nhat mot trang tra loi", async () => {
    const { db, seat2, chung } = await coSach();
    const [s] = await db.insert(seals).values(traoDoi(chung)).returning({ id: seals.id });
    await db.insert(sealReplies).values({ sealId: s.id, accountId: seat2.id, content: to("Một") });
    await viPham(db.insert(sealReplies).values({ sealId: s.id, accountId: seat2.id, content: to("Hai") }), "seal_replies_pkey");
  });

  it("chuoi da go luu toi da 200 ky tu", async () => {
    const { db, seat2, chung } = await coSach();
    const [s] = await db.insert(seals).values(cauDo(chung)).returning({ id: seals.id });
    await db.insert(sealAttempts).values({ sealId: s.id, accountId: seat2.id, guess: "a".repeat(200), correct: false });
    await viPham(
      db.insert(sealAttempts).values({ sealId: s.id, accountId: seat2.id, guess: "a".repeat(201), correct: false }),
      "seal_attempts_guess",
    );
  });
});
