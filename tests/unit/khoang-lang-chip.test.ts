import { describe, expect, it } from "vitest";
import { chipTin, secretHistory } from "@/server/db/schema";
import { dungNguCanh } from "@/server/chip/ngu-canh";
import { chaoChip, docTroChuyen } from "@/server/chip/tro-chuyen";
import { loiDanChip } from "@/lib/chip";
import { setMood } from "@/server/mood/moods";
import { thaCamXuc } from "@/server/cam-xuc/cam-xuc";
import { guiThu } from "@/server/thu/thu";
import { dang, haiCuon } from "../helpers/library";

const NOW = new Date("2026-10-01T02:00:00.000Z"); // 09:00 gio Viet Nam
const SAU = (giay: number) => new Date(NOW.getTime() + giay * 1000);

/*
 * Khoang Lang tren Chip (task 12): ngu canh chi con viec cua minh, loi dan khong neu ten doi phuong, lich su cu co nhac
 * ten doi phuong thi an khi hien (Q4b), loi chao khong tom tat viec doi phuong.
 */
async function dungNgucanh() {
  const s = await haiCuon();
  await dang(s.db, s.seat1.id, s.chung, "Sáng nay trời mưa phùn, mình đi ăn phở.");
  await setMood(s.db, s.seat1.id, "mua-phun", "Nhớ cậu một chút thôi.", NOW);
  await guiThu(s.db, s.seat1.id, "2026-09", "Thư của Linh tháng chín.", NOW);
  return s;
}

describe("Khoang Lang: ngu canh Chip", () => {
  it("tat co (kiem soat duong): ngu canh co ten + tam trang + thu cua doi phuong", async () => {
    const s = await dungNgucanh();
    const ngu = await dungNguCanh(s.db, s.seat2.id, "Mạnh", "Linh", "Kệ sách", [], SAU(60));
    expect(ngu).toContain("Linh");
    expect(ngu).toContain("Mưa phùn");
    expect(ngu).toContain("Nhớ cậu một chút thôi.");
    expect(ngu).toContain("Linh đã gửi");
  });

  it("bat co: ngu canh khong ten doi phuong, khong tam trang/thu doi phuong; viec cua minh con", async () => {
    const s = await dungNgucanh();
    const ngu = await dungNguCanh(s.db, s.seat2.id, "Mạnh", "Linh", "Kệ sách", ["mở sách Chuyện chưa kể"], SAU(60), true);
    expect(ngu).toContain("Mạnh đang mở trang: Kệ sách.");
    expect(ngu).toContain("mở sách Chuyện chưa kể");
    expect(ngu).not.toContain("Linh");
    expect(ngu).not.toContain("Nhớ cậu một chút thôi.");
    expect(ngu).toContain("Chưa ai đang giữ tâm trạng nào.");
  });
});

describe("Khoang Lang: loi dan Chip", () => {
  it("tat co (kiem soat duong): loi dan goi ten doi phuong, noi hai nguoi", () => {
    const dan = loiDanChip("Mạnh", "Linh", "ngữ cảnh");
    expect(dan).toContain("Mạnh và Linh");
    expect(dan).toContain("gọi người kia là Linh");
  });

  it("bat co: loi dan khong ten doi phuong, khong noi hai nguoi, dan khong nhac ai khac", () => {
    const dan = loiDanChip("Mạnh", "Linh", "ngữ cảnh", true);
    expect(dan).not.toContain("Linh");
    expect(dan).not.toContain("hai người");
    expect(dan).toContain("Mạnh");
  });
});

describe("Khoang Lang: lich su tro chuyen (Q4b)", () => {
  async function dungTin() {
    const s = await haiCuon();
    await s.db.insert(chipTin).values([
      { accountId: s.seat2.id, vai: "nguoi", noiDung: "Linh vừa viết trang mới", luc: NOW },
      { accountId: s.seat2.id, vai: "chip", noiDung: "Chào Mạnh nha", luc: SAU(1) },
      { accountId: s.seat2.id, vai: "nguoi", noiDung: "Kể Chíp nghe chuyện hôm nay", luc: SAU(2) },
    ]);
    return s;
  }

  it("tat co (kiem soat duong): tin nhac ten doi phuong van hien", async () => {
    const s = await dungTin();
    expect((await docTroChuyen(s.db, s.seat2.id)).map((t) => t.noiDung)).toEqual([
      "Linh vừa viết trang mới", "Chào Mạnh nha", "Kể Chíp nghe chuyện hôm nay",
    ]);
  });

  it("bat co: tin nhac ten doi phuong an, tin sach con; du lieu goc khong doi", async () => {
    const s = await dungTin();
    expect((await docTroChuyen(s.db, s.seat2.id, 60, true, "Linh")).map((t) => t.noiDung)).toEqual([
      "Chào Mạnh nha", "Kể Chíp nghe chuyện hôm nay",
    ]);
    // Khong xoa du lieu: tat co thi tin lai hien.
    expect((await docTroChuyen(s.db, s.seat2.id)).map((t) => t.noiDung)).toHaveLength(3);
  });

  it("bat co: tin nhac biet danh CU cua doi phuong cung an", async () => {
    const s = await dungTin();
    await s.db.insert(secretHistory).values({ accountId: s.seat1.id, secretCipher: "x", nickname: "Linh cũ" });
    await s.db.insert(chipTin).values({ accountId: s.seat2.id, vai: "nguoi", noiDung: "Linh cũ thích hoa đào", luc: SAU(3) });
    expect((await docTroChuyen(s.db, s.seat2.id, 60, true, "Linh")).map((t) => t.noiDung)).toEqual([
      "Chào Mạnh nha", "Kể Chíp nghe chuyện hôm nay",
    ]);
  });
});

describe("Khoang Lang: chao Chip", () => {
  it("bat co, vang 3 ngay: chao ve roi nhung khong tom tat viec doi phuong, khong nut xem", async () => {
    const s = await haiCuon();
    await chaoChip(s.db, s.seat2.id, "Mạnh", "Linh", NOW, true);
    const sau3Ngay = new Date(NOW.getTime() + 3 * 86_400_000);
    await setMood(s.db, s.seat1.id, "mua-phun", null, new Date(sau3Ngay.getTime() - 3_600_000));
    await thaCamXuc(s.db, s.seat1.id, "nho", new Date(sau3Ngay.getTime() - 1_800_000));
    const loi = await chaoChip(s.db, s.seat2.id, "Mạnh", "Linh", sau3Ngay, true);
    expect(loi).toEqual({ loai: "quay-lai", cau: "**Mạnh** về rồi! 3 ngày rồi đó.", nut: null });
  });
});
