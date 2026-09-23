import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, toDaXemCua, tranNgang } from "./kho-sach";

/*
 * Mo man doc thang toi mot to xa chi tinh dung nhung to that su hien: cac to bi nhay coc van la trang moi tren ke.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("mo thang toi to 5: chi to do duoc tinh, cac to bi nhay coc van la trang moi", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba", "Tờ bốn", "Tờ năm", "Tờ sáu");

  // Man hep: mot khung mot to, nen "to dang hien" dung bang mot to.
  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto(`/sach/${id}?trang=5`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 5 / 6");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([5]);
  expect(await tranNgang(b)).toEqual([]);

  await b.goto("/ke-sach");
  const the = b.locator(".cuon", { hasText: "Chuyện chưa kể" });
  await expect(the.locator(".dh--moi")).toHaveText("5 trang mới");

  // Mo lai khong kem ?trang: to nho nhat chua thay la to 1, khong phai to 6.
  await b.goto(`/sach/${id}`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 1 / 6");
  // Doi tung khung duoc ghi xong roi moi lat tiep: Reader co y chi gui khung dung lai that su, lat lien tay qua mot to
  // thi to do khong duoc tinh.
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1, 5]);
  await b.keyboard.press("ArrowRight");
  await expect(b.locator(".doc__dem")).toHaveText("Trang 2 / 6");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1, 2, 5]);
  await b.keyboard.press("ArrowRight");
  await expect(b.locator(".doc__dem")).toHaveText("Trang 3 / 6");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1, 2, 3, 5]);

  await b.goto("/ke-sach");
  await expect(the.locator(".dh--moi")).toHaveText("2 trang mới");
});

test("man rong mo hai trang ghep: ca hai to cua khung deu duoc tinh", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba", "Tờ bốn", "Tờ năm", "Tờ sáu");

  await b.setViewportSize({ width: 1280, height: 900 });
  await b.goto(`/sach/${id}?trang=5`);
  // Khung (5,6) cua che do hai trang ghep: ca hai to deu that su hien tren man.
  await expect(b.locator(".doc__dem")).toHaveText("Trang 5-6 / 6");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([5, 6]);

  await b.goto("/ke-sach");
  await expect(b.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".dh--moi")).toHaveText("4 trang mới");
});
