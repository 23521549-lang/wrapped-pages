import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq, ne } from "drizzle-orm";
import { accounts, activity, books, deNghi, drafts, media, pages, rounds } from "@/server/db/schema";
import { createBook, updateBook } from "@/server/library/books";
import { saveDraft } from "@/server/library/drafts";
import { recordUpload } from "@/server/media/access";
import { deNghiCuaSach, deNghiToiToi, deNghiXoa, rutLai, traLoi, xinViet } from "@/server/viet-cung/de-nghi";
import { seedHai } from "../helpers/seed";
import type { TestDb } from "../helpers/db";
import { dangTen, haiCuon, to, vietCung } from "../helpers/library";

/*
 * De nghi cua sach viet cung (5c muc C, D): moi (chu cuon, o Sach moi va Sua sach), xin (nguoi kia, o man doc), nhan loi,
 * tu choi, rut lai, de nghi xoa roi dong y hay giu lai. Moi cuon nhieu nhat mot de nghi dang cho.
 */

const T = new Date("2026-09-22T02:00:00.000Z");
const sau = (phut: number) => new Date(T.getTime() + phut * 60_000);

/** Cac dong Hoat dong theo thu tu ghi, bo dong tao-sach cua buoc dung du lieu. */
const dong = (db: TestDb) =>
  db.select({ kind: activity.kind, actorId: activity.actorId, detail: activity.detail, shared: activity.shared })
    .from(activity)
    .where(ne(activity.kind, "tao-sach"))
    .orderBy(asc(activity.at));

const deNghiCua = (db: TestDb, bookId: string) =>
  db.select({ loai: deNghi.loai, tuId: deNghi.tuId }).from(deNghi).where(eq(deNghi.bookId, bookId));

const vietCungTu = async (db: TestDb, bookId: string) =>
  (await db.select({ v: books.vietCungTu, mode: books.mode }).from(books).where(eq(books.id, bookId)))[0];

describe("moi viet cung", () => {
  it("tao sach kem loi moi: sach chia se, de nghi moi-viet cua chu, dong moi-viet", async () => {
    const { db, seat1 } = await seedHai();
    const id = await createBook(db, seat1.id, { title: "Những bữa sáng", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null, moi: true }, T);
    expect(await deNghiCua(db, id)).toEqual([{ loai: "moi-viet", tuId: seat1.id }]);
    expect(await dong(db)).toEqual([{ kind: "moi-viet", actorId: seat1.id, detail: null, shared: true }]);
    expect(await vietCungTu(db, id)).toEqual({ v: null, mode: "chia-se" });
  });

  it("sua sach chon viet cung: sach rieng tu thanh chia se va co loi moi; chon lai chia se thi rut loi moi va dong bao", async () => {
    const { db, seat1, rieng } = await haiCuon();
    expect(await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se", moi: true }, T)).toBe("saved");
    expect(await vietCungTu(db, rieng)).toEqual({ v: null, mode: "chia-se" });
    expect(await deNghiCua(db, rieng)).toEqual([{ loai: "moi-viet", tuId: seat1.id }]);
    // Luu lai van chon viet cung: khong gui them loi moi thu hai.
    expect(await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se", moi: true }, sau(1))).toBe("saved");
    expect((await dong(db)).map((d) => d.kind)).toEqual(["moi-viet"]);
    expect(await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se" }, sau(2))).toBe("saved");
    expect(await deNghiCua(db, rieng)).toEqual([]);
    expect(await dong(db)).toEqual([]);
  });

  it("chu chuyen sang rieng tu khi nguoi kia dang xin: loi xin bi rut cung dong bao", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    expect(await xinViet(db, seat2.id, chung, T)).toBe("sent");
    expect(await updateBook(db, seat1.id, chung, { title: "Chuyện chưa kể", mode: "rieng-tu" }, sau(1))).toBe("saved");
    expect(await deNghiCua(db, chung)).toEqual([]);
    expect(await dong(db)).toEqual([]);
  });

  it("chu chon viet cung khi nguoi kia dang xin: la dong y, cuon thanh sach viet cung", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await xinViet(db, seat2.id, chung, T);
    expect(await updateBook(db, seat1.id, chung, { title: "Chuyện chưa kể", mode: "chia-se", moi: true }, sau(1))).toBe("saved");
    expect((await vietCungTu(db, chung)).v).toEqual(sau(1));
    expect(await deNghiCua(db, chung)).toEqual([]);
    expect((await dong(db)).map((d) => [d.kind, d.detail])).toEqual([["xin-viet", null], ["nhan-viet", { tu: "xin-viet" }]]);
  });
});

describe("xin viet cung", () => {
  it("chi nguoi kia, chi sach chia se mot nguoi viet; da co de nghi thi exists", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    expect(await xinViet(db, seat1.id, chung, T)).toBe("not-found");
    expect(await xinViet(db, seat2.id, rieng, T)).toBe("not-found");
    expect(await xinViet(db, seat2.id, "khong-phai-uuid", T)).toBe("not-found");
    expect(await xinViet(db, seat2.id, chung, T)).toBe("sent");
    expect(await xinViet(db, seat2.id, chung, sau(1))).toBe("exists");
    expect(await deNghiCua(db, chung)).toEqual([{ loai: "xin-viet", tuId: seat2.id }]);
    expect(await dong(db)).toEqual([{ kind: "xin-viet", actorId: seat2.id, detail: null, shared: true }]);
    const s = await vietCung();
    expect(await xinViet(s.db, s.seat2.id, s.sach, T)).toBe("not-found");
  });

  it("xin khi chu dang moi minh: la nhan loi", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await updateBook(db, seat1.id, chung, { title: "Chuyện chưa kể", mode: "chia-se", moi: true }, T);
    expect(await xinViet(db, seat2.id, chung, sau(1))).toBe("accepted");
    expect((await vietCungTu(db, chung)).v).toEqual(sau(1));
    expect(await deNghiCua(db, chung)).toEqual([]);
  });
});

describe("tra loi", () => {
  it("nguoi kia nhan loi moi: sach viet cung, xoa de nghi, dong nhan-viet tu moi-viet", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await updateBook(db, seat1.id, chung, { title: "Chuyện chưa kể", mode: "chia-se", moi: true }, T);
    expect(await traLoi(db, seat1.id, chung, true, sau(1))).toBe("not-found");
    expect(await traLoi(db, seat2.id, chung, true, sau(1))).toBe("accepted");
    expect(await vietCungTu(db, chung)).toEqual({ v: sau(1), mode: "chia-se" });
    expect(await deNghiCua(db, chung)).toEqual([]);
    expect((await dong(db)).at(-1)).toEqual({ kind: "nhan-viet", actorId: seat2.id, detail: { tu: "moi-viet" }, shared: true });
    expect(await traLoi(db, seat2.id, chung, true, sau(2))).toBe("not-found");
  });

  it("chu dong y loi xin; tu choi thi dong tu-choi, cuon giu nguyen", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    await xinViet(db, seat2.id, chung, T);
    expect(await traLoi(db, seat1.id, chung, false, sau(1))).toBe("declined");
    expect(await vietCungTu(db, chung)).toEqual({ v: null, mode: "chia-se" });
    expect((await dong(db)).at(-1)).toEqual({ kind: "tu-choi", actorId: seat1.id, detail: { viec: "xin-viet" }, shared: true });
    await xinViet(db, seat2.id, chung, sau(2));
    expect(await traLoi(db, seat1.id, chung, true, sau(3))).toBe("accepted");
    expect((await dong(db)).at(-1)).toMatchObject({ kind: "nhan-viet", actorId: seat1.id, detail: { tu: "xin-viet" } });
    expect(await traLoi(db, seat1.id, rieng, true, sau(4))).toBe("not-found");
  });

  it("nguoi gui khong tu tra loi de nghi cua chinh minh", async () => {
    const { db, seat2, chung } = await haiCuon();
    await xinViet(db, seat2.id, chung, T);
    expect(await traLoi(db, seat2.id, chung, true, sau(1))).toBe("not-found");
    expect(await deNghiCua(db, chung)).toEqual([{ loai: "xin-viet", tuId: seat2.id }]);
  });
});

describe("rut lai", () => {
  it("nguoi gui rut: xoa de nghi va dung dong da bao no; nguoi nhan khong rut duoc", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await xinViet(db, seat2.id, chung, T);
    expect(await rutLai(db, seat1.id, chung)).toBe("not-found");
    expect(await rutLai(db, seat2.id, chung)).toBe("withdrawn");
    expect(await deNghiCua(db, chung)).toEqual([]);
    expect(await dong(db)).toEqual([]);
    expect(await rutLai(db, seat2.id, chung)).toBe("not-found");
  });
});

describe("xoa sach viet cung hai buoc", () => {
  it("de nghi xoa chi sach viet cung; da co de nghi thi exists", async () => {
    const s = await vietCung();
    const motNguoi = await createBook(s.db, s.seat1.id, { title: "Chạy bộ", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null });
    expect(await deNghiXoa(s.db, s.seat1.id, motNguoi, T)).toBe("not-found");
    expect(await deNghiXoa(s.db, s.seat2.id, s.sach, T)).toBe("sent");
    expect(await deNghiXoa(s.db, s.seat1.id, s.sach, sau(1))).toBe("exists");
    expect(await deNghiCua(s.db, s.sach)).toEqual([{ loai: "xoa-sach", tuId: s.seat2.id }]);
    expect((await dong(s.db)).at(-1)).toEqual({ kind: "de-nghi-xoa", actorId: s.seat2.id, detail: null, shared: true });
  });

  it("giu lai: xoa de nghi, dong tu-choi xoa-sach, cuon con nguyen", async () => {
    const s = await vietCung();
    await deNghiXoa(s.db, s.seat2.id, s.sach, T);
    expect(await traLoi(s.db, s.seat1.id, s.sach, false, sau(1))).toBe("declined");
    expect(await deNghiCua(s.db, s.sach)).toEqual([]);
    expect((await dong(s.db)).at(-1)).toMatchObject({ kind: "tu-choi", actorId: s.seat1.id, detail: { viec: "xoa-sach" } });
  });

  it("dong y xoa: xoa han cuon, trang, luot, nhap cua ca hai, media, Hoat dong; nguoi de nghi khong tu dong y", async () => {
    const s = await vietCung();
    await dangTen(s.db, s.seat1.id, s.sach, "Lượt một", "một");
    await dangTen(s.db, s.seat2.id, s.sach, "Lượt hai", "hai");
    await saveDraft(s.db, s.seat1.id, s.sach, to("nháp Linh"), 1);
    await saveDraft(s.db, s.seat2.id, s.sach, to("nháp Mạnh"), 1);
    await recordUpload(s.db, { id: randomUUID(), ownerId: s.seat2.id, bookId: s.sach, kind: "anh", mime: "image/webp", bytes: 10, width: 10, height: 10 });
    await deNghiXoa(s.db, s.seat1.id, s.sach, T);
    expect(await traLoi(s.db, s.seat1.id, s.sach, true, sau(1))).toBe("not-found");
    expect(await traLoi(s.db, s.seat2.id, s.sach, true, sau(1))).toBe("deleted");
    for (const bang of [books, pages, rounds, drafts, media, deNghi, activity]) expect(await s.db.select().from(bang)).toEqual([]);
  });
});

describe("doc de nghi", () => {
  it("deNghiToiToi chi tra de nghi gui toi nguoi xem, moi nhat truoc", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    const cuonManh = await createBook(db, seat2.id, { title: "Chạy bộ mùa thu", mode: "chia-se", cover: "cau-go", youtubeId: null, coverMediaId: null });
    // Manh xin viet cuon cua Linh, Manh moi Linh viet cuon cua Manh: ca hai gui toi Linh. Linh moi Manh viet cuon rieng.
    await xinViet(db, seat2.id, chung, T);
    await updateBook(db, seat2.id, cuonManh, { title: "Chạy bộ mùa thu", mode: "chia-se", moi: true }, sau(1));
    await updateBook(db, seat1.id, rieng, { title: "Cuốn không đặt tên", mode: "chia-se", moi: true }, sau(2));
    expect(await deNghiToiToi(db, seat1.id)).toEqual([
      { bookId: cuonManh, title: "Chạy bộ mùa thu", loai: "moi-viet", luc: sau(1) },
      { bookId: chung, title: "Chuyện chưa kể", loai: "xin-viet", luc: T },
    ]);
    expect(await deNghiToiToi(db, seat2.id)).toEqual([{ bookId: rieng, title: "Cuốn không đặt tên", loai: "moi-viet", luc: sau(2) }]);
  });

  it("deNghiCuaSach: loai va cua ai voi nguoi xem; cuon khong doc duoc thi null", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    expect(await deNghiCuaSach(db, seat2.id, chung)).toBeNull();
    await xinViet(db, seat2.id, chung, T);
    expect(await deNghiCuaSach(db, seat2.id, chung)).toEqual({ loai: "xin-viet", cuaToi: true });
    expect(await deNghiCuaSach(db, seat1.id, chung)).toEqual({ loai: "xin-viet", cuaToi: false });
    expect(await deNghiCuaSach(db, seat2.id, rieng)).toBeNull();
  });
});

describe("mot tai khoan", () => {
  it("chua co nguoi kia: tao sach kem loi moi van tao cuon chia se nhung khong co de nghi", async () => {
    const { db, seat1 } = await seedHai();
    await db.delete(accounts).where(eq(accounts.seat, 2));
    const id = await createBook(db, seat1.id, { title: "Một mình", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null, moi: true }, T);
    expect(await deNghiCua(db, id)).toEqual([]);
  });
});

