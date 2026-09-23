import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangTrang, dongContextCu, haiNguoiDaVao, taoSach, toDaXemCua, tranNgang } from "./kho-sach";

/*
 * Nguoi viet boi den mot cau roi chon lam doan tren ke; khung sach cua nguoi kia hien dung doan do va bam vao mo dung
 * to chua no, khong bien cac to truoc thanh da doc.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DOAN = "Chiều nay trời rất trong.";

test("chon doan luc viet: khung sach hien dung doan do, bam vao mo dung to", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");

  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Tờ đầu tiên.");
  await a.keyboard.press("Enter");
  await a.keyboard.insertText(DOAN);

  // Boi den ca doan cuoi bang ba lan bam, roi chon lam doan tren ke.
  await a.locator(".viet-chu .ProseMirror p").last().click({ clickCount: 3 });
  const nut = a.getByRole("button", { name: "Chọn làm đoạn trên kệ" });
  await expect(nut).toBeEnabled();
  await nut.click();
  await expect(a.getByRole("button", { name: "Bỏ đoạn trên kệ" })).toBeVisible();
  await expect(a.locator(".viet-chu .doan-ke")).toHaveText(DOAN);
  expect(await tranNgang(a)).toEqual([]);

  await dangTrang(a);

  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto("/ke-sach");
  const khung = b.getByRole("article", { name: "Một trang trong sách" });
  await expect(khung).toContainText(DOAN);
  // Doan da chon thang cuoc: doan trich khong phai ca to (to nay con cau "To dau tien.").
  await expect(khung).not.toContainText("Tờ đầu tiên.");
  await expect(khung).toContainText(`${tenCuaA} vừa viết`);
  await khung.getByRole("link", { name: `Đọc Chuyện chưa kể tại trang 1` }).click();
  await expect(b.locator(".doc__dem")).toHaveText("Trang 1 / 1");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1]);
});

test("bo chon thi khung sach quay lai bat tham; doan cua luot cu khong con duoc giu", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");

  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(DOAN);
  await a.locator(".viet-chu .ProseMirror p").last().click({ clickCount: 3 });
  await a.getByRole("button", { name: "Chọn làm đoạn trên kệ" }).click();
  await a.getByRole("button", { name: "Bỏ đoạn trên kệ" }).click();
  await expect(a.locator(".viet-chu .doan-ke")).toHaveCount(0);
  await dangTrang(a);

  await b.goto("/ke-sach");
  await expect(b.getByRole("article", { name: "Một trang trong sách" })).toContainText(DOAN);

  // Luot moi khong co dau chon: khung lay chu cua luot moi, khong giu doan cua luot cu.
  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt sau, chữ khác hẳn.");
  await dangTrang(a);
  await b.goto("/ke-sach");
  const khung = b.getByRole("article", { name: "Một trang trong sách" });
  await expect(khung).toContainText("Lượt sau, chữ khác hẳn.");
  await expect(khung).not.toContainText(DOAN);
});
