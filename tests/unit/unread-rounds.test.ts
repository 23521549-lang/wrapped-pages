import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { readSheets, rounds } from "@/server/db/schema";
import { createBook } from "@/server/library/books";
import { LUOT_TOI_DA, unreadRounds } from "@/server/library/unread-rounds";
import { SHELF_MARK, type DocJson } from "@/lib/doc/types";
import { publishDraft, saveDraft } from "@/server/library/drafts";
import type { TestDb } from "../helpers/db";
import { dang, haiCuon } from "../helpers/library";
import { luotCua } from "../helpers/round";
import { CAU_DO, henGio } from "../helpers/seal";
import type { SealInput } from "@/lib/seal/types";

/*
 * Cac luot chua doc cua khung sach lon luan phien (spec 5a muc E1): luot cua nguoi kia ma nguoi xem con trang chua doc,
 * va luot cua nguoi xem trong cuon CHIA SE ma nguoi kia con trang chua doc. Moi nhat truoc, toi da LUOT_TOI_DA. Moi luot
 * mang mot doan: doan da chon, hay doan ngau nhien co dinh theo ngay trong luot, hay dong he lo khi luot con khoa voi
 * nguoi xem. Chu cua luot con khoa khong bao gio roi may chu.
 */

const NOW = new Date("2026-09-20T08:00:00.000Z");
const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

/** Dat moc dang cua luot (va cua cac to cua no) de thu tu moi nhat truoc khong phu thuoc toc do chay. */
async function datLuc(db: TestDb, roundId: string, at: Date) {
  await db.update(rounds).set({ publishedAt: at }).where(eq(rounds.id, roundId));
}

async function daDoc(db: TestDb, accountId: string, bookId: string, ...vi: number[]) {
  await db.insert(readSheets).values(vi.map((position) => ({ accountId, bookId, position })));
}

/** Dang cac to (moi to mot doan chu) roi tra id luot vua dang: luot chua to cuoi cua cuon. */
async function dangLuot(db: TestDb, ownerId: string, bookId: string, ...chu: string[]): Promise<string> {
  const r = await dang(db, ownerId, bookId, ...chu);
  return luotCua(db, bookId, r.firstPosition);
}

/** Dang mot to hai doan kem niem phong: doan dau thanh dong he lo, doan sau la chu that chi nam trong to. */
async function dangKhoa(db: TestDb, ownerId: string, bookId: string, seal: SealInput, heLo: string, biMat: string): Promise<string> {
  const doc: DocJson = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: heLo }] },
    { type: "paragraph", content: [{ type: "text", text: biMat }] },
  ] };
  await saveDraft(db, ownerId, bookId, doc, 1);
  const r = await publishDraft(db, ownerId, bookId, [doc], seal);
  if (!r || r === "invalid-cover") throw new Error("khong dang duoc");
  return luotCua(db, bookId, r.firstPosition);
}

/** Bo: seat1 co cuon chia se va rieng tu, seat2 co mot cuon chia se. */
async function bo() {
  const s = await haiCuon();
  const cuaKia = await createBook(s.db, s.seat2.id, { title: "Thư mùa đông", mode: "chia-se", cover: "cau-go", youtubeId: null, coverMediaId: null });
  return { ...s, cuaKia };
}

describe("unreadRounds", () => {
  it("hai phia, moi nhat truoc; cuon rieng tu khong tinh; doc het luot thi luot roi khoi danh sach", async () => {
    const s = await bo();
    const a = await dangLuot(s.db, s.seat1.id, s.chung, "Một chiều mưa", "Hai");
    const r = await dangLuot(s.db, s.seat1.id, s.rieng, "Riêng tư");
    const b = await dangLuot(s.db, s.seat2.id, s.cuaKia, "Thư gửi em");
    await datLuc(s.db, a, phut(-30));
    await datLuc(s.db, r, phut(-20));
    await datLuc(s.db, b, phut(-10));
    const cua1 = async () => (await unreadRounds(s.db, s.seat1.id, NOW)).map((l) => [l.roundId, l.bookId, l.title, l.mine, l.first]);
    expect(await cua1()).toEqual([
      [b, s.cuaKia, "Thư mùa đông", false, 1],
      [a, s.chung, "Chuyện chưa kể", true, 1],
    ]);
    await daDoc(s.db, s.seat2.id, s.chung, 1);
    expect((await cua1()).map((l) => l[0])).toEqual([b, a]);
    await daDoc(s.db, s.seat2.id, s.chung, 2);
    await daDoc(s.db, s.seat1.id, s.cuaKia, 1);
    expect(await cua1()).toEqual([]);
    // Phia seat2: cuon rieng tu cua seat1 khong bao gio hien; luot cua seat2 da duoc seat1 doc het.
    expect(await unreadRounds(s.db, s.seat2.id, NOW)).toEqual([]);
  });

  it("thong tin cua luot: so trang cua cuon, moc dang, doan ngau nhien la chu cua mot to trong luot", async () => {
    const s = await bo();
    await dang(s.db, s.seat2.id, s.cuaKia, "Trang cũ");
    const b = await dangLuot(s.db, s.seat2.id, s.cuaKia, "Sáng nay trời trong", "Chiều về mưa nhẹ");
    await datLuc(s.db, b, phut(-5));
    const luot = (await unreadRounds(s.db, s.seat1.id, NOW)).find((l) => l.roundId === b);
    expect(luot).toMatchObject({ pageCount: 3, publishedAt: phut(-5), locked: false });
    expect([[2, "Sáng nay trời trong"], [3, "Chiều về mưa nhẹ"]]).toContainEqual([luot?.position, luot?.excerpt]);
    // Co dinh trong ngay.
    const lai = (await unreadRounds(s.db, s.seat1.id, NOW)).find((l) => l.roundId === b);
    expect([lai?.position, lai?.excerpt]).toEqual([luot?.position, luot?.excerpt]);
  });

  it("doan da chon cua luot thang doan ngau nhien", async () => {
    const s = await bo();
    const coDau: DocJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [
        { type: "text", text: "Mở đầu. " },
        { type: "text", text: "Câu anh muốn em đọc.", marks: [{ type: SHELF_MARK }] },
      ] }],
    };
    const thuong: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Trang thường" }] }] };
    await saveDraft(s.db, s.seat2.id, s.cuaKia, thuong, 2);
    await publishDraft(s.db, s.seat2.id, s.cuaKia, [thuong, coDau]);
    const [luot] = await unreadRounds(s.db, s.seat1.id, NOW);
    expect([luot.position, luot.excerpt, luot.locked]).toEqual([2, "Câu anh muốn em đọc.", false]);
  });

  it("luot con khoa voi nguoi xem: chi dong he lo, khong chu that; chu sach van thay chu cua minh", async () => {
    const s = await bo();
    const b = await dangKhoa(s.db, s.seat2.id, s.cuaKia, CAU_DO, "Có một điều anh định nói.", "Bí mật tháng mười");
    const [luot] = await unreadRounds(s.db, s.seat1.id, NOW);
    expect([luot.roundId, luot.locked, luot.excerpt, luot.position]).toEqual([b, true, "Có một điều anh định nói.", 1]);
    expect(JSON.stringify(await unreadRounds(s.db, s.seat1.id, NOW))).not.toContain("Bí mật");
    const [cuaMinh] = await unreadRounds(s.db, s.seat2.id, NOW);
    expect([cuaMinh.roundId, cuaMinh.mine, cuaMinh.locked]).toEqual([b, true, false]);
    expect(cuaMinh.excerpt).toContain("Bí mật tháng mười");
  });

  it("hen gio chua toi gio khoa voi ca chu sach: chu sach cung chi thay dong he lo", async () => {
    const s = await bo();
    await dangKhoa(s.db, s.seat1.id, s.chung, henGio(phut(60)), "Mở vào tối nay.", "Chưa tới giờ");
    const [cuaMinh] = await unreadRounds(s.db, s.seat1.id, NOW);
    expect([cuaMinh.mine, cuaMinh.locked, cuaMinh.excerpt]).toEqual([true, true, "Mở vào tối nay."]);
    expect(JSON.stringify(await unreadRounds(s.db, s.seat1.id, NOW))).not.toContain("Chưa tới giờ");
  });

  it(`toi da ${LUOT_TOI_DA} luot, moi nhat truoc`, async () => {
    const s = await bo();
    const ids: string[] = [];
    for (let i = 0; i < LUOT_TOI_DA + 2; i++) {
      const r = await dangLuot(s.db, s.seat2.id, s.cuaKia, `Trang ${i + 1}`);
      await datLuc(s.db, r, phut(-100 + i));
      // Luot sau moi hon: dat len dau, ids la thu tu moi nhat truoc.
      ids.unshift(r);
    }
    expect((await unreadRounds(s.db, s.seat1.id, NOW)).map((l) => l.roundId)).toEqual(ids.slice(0, LUOT_TOI_DA));
  });
});
