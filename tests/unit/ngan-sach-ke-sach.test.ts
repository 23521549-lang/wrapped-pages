import { describe, it, expect } from "vitest";
import { demCauLenh } from "../helpers/db";
import { haiCuon, dang } from "../helpers/library";
import { createBook } from "@/server/library/books";
import { unreadRounds } from "@/server/library/unread-rounds";
import { coverSlots, coverSlotsNhieu } from "@/server/library/timeline";

/*
 * NGAN SACH TRUY VAN cua khung sach lon tren man Ke sach. Dem SO CAU LENH SQL that gui xuong database, cung cach
 * cover-shelf.test.ts da khoa listShelf o 8 cau. Day la phep do chac chan: khong phu thuoc may, khong phu thuoc do tre
 * mang, khong phu thuoc man hinh co hien hay khong.
 *
 * Vi sao can: khung sach lon (dot nam 5a) hien toi SAU luot chua doc, va moi luot can dong thoi gian bia cua cuon no.
 * Doc tung cuon mot la N+1: do duoc 24 cau lenh cho sau cuon, tuc 44% toan bo viec hoi database cua ca man (ca man la
 * 54 cau). Tai lieu thiet ke muc 17b do hieu nang ngay 27/09, TRUOC dot nam, nen cho nay chua lan nao duoc dem.
 *
 * Bai nay khoa dung mot dieu: so cau lenh KHONG duoc tang theo so cuon. Mot ngay nao do ai do quay lai vong
 * `map(id => coverSlots(db, id))` thi bai nay do ngay.
 */

const NOW = new Date("2026-09-20T08:00:00.000Z");

/** Mot ke that: sau cuon chia se cua nguoi kia deu co luot da dang, nen khung sach lon co du sau luot chua doc. */
async function keThat() {
  const s = await haiCuon();
  for (let i = 0; i < 5; i += 1) {
    const id = await createBook(
      s.db, s.seat2.id, { title: `Cuốn ${i}`, mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null }, NOW,
    );
    await dang(s.db, s.seat2.id, id, `Trang của cuốn ${i}`);
  }
  // s.chung la cuon cua seat1, nen chinh seat1 dang vao do (publishDraft tu choi nguoi khong phai nguoi viet).
  await dang(s.db, s.seat1.id, s.chung, "Trang của cuốn chung");
  return s;
}

/** Cac cuon ma khung sach lon se phai doc dong thoi gian bia, dung nhu man Ke sach tinh. */
async function cuonCuaKhung(s: Awaited<ReturnType<typeof keThat>>): Promise<string[]> {
  const chuaDoc = await unreadRounds(s.db, s.seat1.id, NOW);
  return [...new Set(chuaDoc.map((l) => l.bookId))];
}

describe("ngan sach truy van cua khung sach lon", () => {
  it("doc bia cho ca khung ton dung bang doc cho MOT cuon: khong tang theo so cuon", async () => {
    const s = await keThat();
    const cacCuon = await cuonCuaKhung(s);
    expect(cacCuon.length).toBeGreaterThanOrEqual(5);

    const motCuon = await demCauLenh(() => coverSlotsNhieu(s.db, [cacCuon[0]]));
    const caKhung = await demCauLenh(() => coverSlotsNhieu(s.db, cacCuon));
    expect(caKhung).toBe(motCuon);
    // Mot anh chup (mo, dong) cong ba cau doc: cuon, luot, o bia. Con so nay la ngan sach, dung noi no len.
    expect(caKhung).toBeLessThanOrEqual(6);
  });

  it("coverSlots mot cuon tra ve y het coverSlotsNhieu cua dung cuon do", async () => {
    const s = await keThat();
    const cuon = (await cuonCuaKhung(s))[0];
    expect(await coverSlots(s.db, cuon)).toEqual((await coverSlotsNhieu(s.db, [cuon])).get(cuon));
  });

  it("danh sach rong hay ma khong phai uuid thi tra ve rong, khong nem loi", async () => {
    const s = await keThat();
    expect((await coverSlotsNhieu(s.db, [])).size).toBe(0);
    expect((await coverSlotsNhieu(s.db, ["khong-phai-uuid"])).size).toBe(0);
  });
});
