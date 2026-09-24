import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { dang, haiCuon } from "../helpers/library";
import { seedHai } from "../helpers/seed";
import { bookCovers, books, bookTracks, media } from "@/server/db/schema";
import { createBook, findOwnBook, findReadableBook, updateBook } from "@/server/library/books";
import { listShelf } from "@/server/library/shelf";
import { markRead } from "@/server/library/pages";
import { recordUpload } from "@/server/media/access";
import { isUuid } from "@/lib/uuid";

describe("isUuid", () => {
  it("chi nhan dung dang UUID", () => {
    expect(isUuid("0b8f3c2e-4d1a-4f6b-9c3d-2e1f0a9b8c7d")).toBe(true);
    expect(isUuid("khong-phai-uuid")).toBe(false);
    expect(isUuid("' or 1=1 --")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("quyen tren mot cuon sach", () => {
  it("nguoi kia doc duoc sach chia se, khong tim thay sach rieng tu", async () => {
    const { db, seat1, seat2, chung, rieng } = await haiCuon();
    expect((await findReadableBook(db, seat2.id, chung))?.title).toBe("Chuyện chưa kể");
    expect(await findReadableBook(db, seat2.id, rieng)).toBeNull();
    expect((await findReadableBook(db, seat1.id, rieng))?.title).toBe("Cuốn không đặt tên");
  });

  it("chi chu sach lay duoc cuon de ghi, ke ca voi sach chia se", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    expect(await findOwnBook(db, seat2.id, chung)).toBeNull();
    expect((await findOwnBook(db, seat1.id, chung))?.id).toBe(chung);
  });

  it("ma sach sai dang thi tra null chu khong lam vo truy van", async () => {
    const { db, seat1 } = await haiCuon();
    expect(await findReadableBook(db, seat1.id, "khong-phai-uuid")).toBeNull();
    expect(await findOwnBook(db, seat1.id, "' or 1=1 --")).toBeNull();
    expect(await updateBook(db, seat1.id, "x", { title: "A", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null })).toBe("not-found");
  });

  it("nguoi kia khong sua duoc sach, sach giu nguyen", async () => {
    const { db, seat2, chung } = await haiCuon();
    expect(await updateBook(db, seat2.id, chung, { title: "Bị sửa", mode: "rieng-tu", cover: "khom-truc", youtubeId: "5qap5aO4i9A", coverMediaId: null })).toBe("not-found");
    const [row] = await db.select().from(books).where(eq(books.id, chung));
    expect(row).toMatchObject({ title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: null });
  });

  it("chu sach doi duoc ten, che do, bia va nhac nen", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect(await updateBook(db, seat1.id, chung, { title: "Mưa đầu tháng chín", mode: "rieng-tu", cover: "trang-nuoc", youtubeId: "5qap5aO4i9A", coverMediaId: null })).toBe("saved");
    const [row] = await db.select().from(books).where(eq(books.id, chung));
    expect(row).toMatchObject({ title: "Mưa đầu tháng chín", mode: "rieng-tu", cover: "trang-nuoc", youtubeId: "5qap5aO4i9A" });
  });

  it("tao sach kem nhac nen, sua voi youtubeId null thi bo nhac", async () => {
    const { db, seat1 } = await haiCuon();
    const id = await createBook(db, seat1.id, { title: "Có nhạc", mode: "chia-se", cover: "nui-xa", youtubeId: "5qap5aO4i9A", coverMediaId: null });
    expect((await findOwnBook(db, seat1.id, id))?.youtubeId).toBe("5qap5aO4i9A");
    expect(await updateBook(db, seat1.id, id, { title: "Có nhạc", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: null })).toBe("saved");
    expect((await findOwnBook(db, seat1.id, id))?.youtubeId).toBeNull();
  });
});

describe("ke sach", () => {
  it("co sach cua minh o ca hai che do va sach chia se cua nguoi kia", async () => {
    const { db, seat1, seat2 } = await haiCuon();
    await createBook(db, seat2.id, { title: "Sổ tay chạy bộ", mode: "chia-se", cover: "khom-truc", youtubeId: null, coverMediaId: null });
    expect((await listShelf(db, seat1.id)).map((b) => b.title).sort())
      .toEqual(["Chuyện chưa kể", "Cuốn không đặt tên", "Sổ tay chạy bộ"].sort());
  });

  it("sach rieng tu cua nguoi kia khong xuat hien, ke ca ten", async () => {
    const { db, seat1, seat2, rieng } = await haiCuon();
    await dang(db, seat1.id, rieng, "Chỉ mình em biết chuyện này");
    const shelf = await listShelf(db, seat2.id);
    expect(shelf.map((b) => b.title)).toEqual(["Chuyện chưa kể"]);
    const json = JSON.stringify(shelf);
    expect(json).not.toContain("Cuốn không đặt tên");
    expect(json).not.toContain("Chỉ mình em biết chuyện này");
  });

  it("dem so to va so to moi chua doc cua nguoi kia; sach cua minh khong co to moi", async () => {
    const { db, seat1, seat2, chung } = await haiCuon();
    await dang(db, seat1.id, chung, "một", "hai", "ba");
    const cuaNguoiKia = (await listShelf(db, seat2.id)).find((b) => b.id === chung)!;
    // Doan trich den tu luot dang moi nhat (spec 2026-09-22 muc 10): ba to nam trong cung mot luot va do la luot moi
    // nhat, nen ca ba deu la ung vien cua phep bat tham theo ngay, khong con phu thuoc nguoi kia da xem to nao.
    expect(cuaNguoiKia).toMatchObject({ pageCount: 3, newCount: 3, mine: false, ownerNickname: "Linh" });
    expect(cuaNguoiKia.excerpt).toBe(["một", "hai", "ba"][cuaNguoiKia.excerptPosition - 1]);
    await markRead(db, seat2.id, chung, [1, 2]);
    expect((await listShelf(db, seat2.id)).find((b) => b.id === chung)!.newCount).toBe(1);
    expect((await listShelf(db, seat1.id)).find((b) => b.id === chung)!).toMatchObject({ newCount: 0, mine: true });
  });

  it("cuon co to dang gan nhat nam dau ke; doan trich la chu cua dung to excerptPosition", async () => {
    const { db, seat1, chung, rieng } = await haiCuon();
    await dang(db, seat1.id, rieng, "cũ");
    await dang(db, seat1.id, chung, "đầu", "Em tới sớm hơn giờ hẹn bốn mươi phút");
    const shelf = await listShelf(db, seat1.id);
    // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
    expect(shelf[0].id).toBe(chung);
    expect(shelf[0].excerpt).toBe(["đầu", "Em tới sớm hơn giờ hẹn bốn mươi phút"][shelf[0].excerptPosition - 1]);
    expect(shelf[1]).toMatchObject({ id: rieng, excerpt: "cũ", excerptPosition: 1 });
  });

  it("cuon chua co to nao van len ke, khong co doan trich", async () => {
    const { db, seat1, chung } = await haiCuon();
    expect((await listShelf(db, seat1.id)).find((b) => b.id === chung)).toMatchObject({
      // Doan trich la to co chu chon theo ngay (spec 2026-09-22 muc 7), khong con la to cuoi.
      pageCount: 0, newCount: 0, excerptPosition: 0, excerptLocked: false, lastPublishedAt: null, excerpt: null,
    });
  });
});

describe("createBook dung o mo dau", () => {
  it("cuon moi co dung mot o bia mo dau mang tranh da chon, va khong co o nhac khi khong nhap nhac", async () => {
    const { db, seat1 } = await seedHai();
    const id = await createBook(db, seat1.id, { title: "Chuyện chưa kể", mode: "chia-se", cover: "hoa-dao", youtubeId: null, coverMediaId: null });
    expect(await db.select({ b: bookCovers.bookId, r: bookCovers.roundId, c: bookCovers.cover, m: bookCovers.coverMediaId }).from(bookCovers))
      .toEqual([{ b: id, r: null, c: "hoa-dao", m: null }]);
    expect(await db.select().from(bookTracks)).toEqual([]);
  });

  it("nhap nhac luc tao sach thi co them mot o nhac mo dau", async () => {
    const { db, seat1 } = await seedHai();
    const id = await createBook(db, seat1.id, { title: "Có nhạc", mode: "chia-se", cover: "nui-xa", youtubeId: "5qap5aO4i9A", coverMediaId: null });
    expect(await db.select({ b: bookTracks.bookId, r: bookTracks.roundId, y: bookTracks.youtubeId }).from(bookTracks))
      .toEqual([{ b: id, r: null, y: "5qap5aO4i9A" }]);
  });

  it("bia anh khong dung duoc: khong tao cuon nao, va khong o nao duoc ghi", async () => {
    const { db, seat1 } = await seedHai();
    expect(await createBook(db, seat1.id, { title: "Hỏng", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: randomUUID() })).toBeNull();
    expect(await db.select().from(books)).toEqual([]);
    expect(await db.select().from(bookCovers)).toEqual([]);
    expect(await db.select().from(bookTracks)).toEqual([]);
  });

  it("bia anh dung duoc: o mo dau mang id anh do va anh duoc gan vao cuon", async () => {
    const { db, seat1 } = await seedHai();
    const bia = randomUUID();
    expect(await recordUpload(db, { id: bia, ownerId: seat1.id, bookId: null, kind: "bia", mime: "image/webp", bytes: 1024, width: 1200, height: 720 })).toBe(true);
    const id = await createBook(db, seat1.id, { title: "Có bìa ảnh", mode: "chia-se", cover: "nui-xa", youtubeId: null, coverMediaId: bia });
    expect(await db.select({ m: bookCovers.coverMediaId }).from(bookCovers)).toEqual([{ m: bia }]);
    expect((await db.select({ b: media.bookId }).from(media)).map((r) => r.b)).toEqual([id]);
  });
});
