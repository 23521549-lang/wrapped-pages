import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DA_LUU = new RegExp("^Đã lưu lúc [0-9]{2}:[0-9]{2}$");

test("ban nhap cua minh: gio luu, so trang nhap, doan trich, Viet tiep; nguoi kia chi thay trang trong", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Chiều nay anh đi ngang hiệu sách cũ ở góc phố.");
  await expect(a.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });

  await a.goto("/ban-nhap");
  await expect(
    a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Bản nháp" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(a.getByText("1 bản nháp · chỉ mình bạn thấy")).toBeVisible();
  const muc = a.getByRole("listitem").filter({ hasText: "Cuốn không đặt tên" });
  await expect(muc.locator(".chip", { hasText: "Riêng tư" })).toBeVisible();
  await expect(muc.locator(".nhap__m")).toHaveText(new RegExp("^Lưu lúc [0-9]{2}:[0-9]{2} · 1 trang nháp$"));
  await expect(muc).toContainText("Chiều nay anh đi ngang hiệu sách cũ ở góc phố.");
  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }
  await muc.getByRole("link", { name: "Viết tiếp" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));

  await b.goto("/ban-nhap");
  await expect(b.getByRole("heading", { name: "Chưa có bản nháp." })).toBeVisible();
  await expect(b.getByText(`${tenCuaA} không thấy bản nháp của bạn.`)).toBeVisible();
  await expect(b.locator("main")).not.toContainText("Cuốn không đặt tên");
});

test("Trang moi mo ban nhap gan nhat, ke ca khi co cuon moi hon", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const coNhap = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Sáng nay chạy vòng hồ, gió ngược cả đoạn về.");
  await expect(a.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });
  await taoSach(a, "Chuyện chưa kể", "chia-se");

  await a.goto("/ke-sach");
  await a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Trang mới" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${coNhap}/viet$`));
  await expect(a.locator(".viet-chu .ProseMirror")).toContainText("Sáng nay chạy vòng hồ");
});
