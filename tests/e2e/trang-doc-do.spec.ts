import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, docSach, dongContextCu, haiNguoiDaVao, taoSach, viTriDocDo as viTri } from "./kho-sach";

/*
 * Trang dang doc do (spec 5a muc F): man doc luu trang dang dung khi khung dung yen khoang 1,2 giay, theo tai khoan,
 * voi ca sach cua nguoi kia lan sach cua minh. Lan sau mo sach (khong kem ?trang) thi mo dung trang do.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("mo sach lan sau dung trang dang doc do, moi nguoi mot vi tri, ca sach cua minh", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba", "Tờ bốn", "Tờ năm");

  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto(`/sach/${id}?trang=4`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 4 / 5");
  await expect.poll(() => viTri(id, tenCuaB), { timeout: 10_000 }).toBe(4);
  // Mo lai qua tam bia, khong kem ?trang: dung trang dang doc do, khong phai to dau chua doc (to 1).
  await docSach(b, id);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 4 / 5");

  // Chu sach co vi tri rieng.
  await a.setViewportSize({ width: 375, height: 900 });
  await a.goto(`/sach/${id}?trang=2`);
  await expect(a.locator(".doc__dem")).toHaveText("Trang 2 / 5");
  await expect.poll(() => viTri(id, tenCuaA), { timeout: 10_000 }).toBe(2);
  await docSach(a, id);
  await expect(a.locator(".doc__dem")).toHaveText("Trang 2 / 5");
  expect(await viTri(id, tenCuaB)).toBe(4);

  // Lat sang trang ke va dung lai thi vi tri doi theo.
  await b.keyboard.press("ArrowRight");
  await expect(b.locator(".doc__dem")).toHaveText("Trang 5 / 5");
  await expect.poll(() => viTri(id, tenCuaB), { timeout: 10_000 }).toBe(5);
});
