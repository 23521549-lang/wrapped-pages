import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { CHO_ARGON2_MS, dongContextCu, haiNguoiDaVao, tranNgang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Bon be rong phai khong tran ngang. */
const BE_RONG = [320, 375, 414, 768];

test("cai dat khong tran ngang o moi be rong, ca khi co loi nhan chua gui va dong mat khau moi", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);

  // Luc tao cho ngoi moi nguoi da viet mot loi nhan chua gui: co dong loi nhan kem nut Gui loi nhan.
  await a.goto("/cai-dat");
  await expect(a.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
  await expect(a.locator(".nhan-cu__gui").first()).toBeVisible();
  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `truoc khi doi ten ${width}px`).toEqual([]);
  }

  // Doi ten: dong mat khau moi dung phong tieu de, dai va khong co khoang trang.
  await a.getByLabel("Biệt danh mới cho người kia").fill("Linh Nhi");
  await a.getByLabel("Lời nhắn bí mật mới").fill("hien nha hom mua");
  await a.getByRole("button", { name: "Đổi tên" }).click();
  await a.getByRole("button", { name: "Xác nhận đổi" }).click();
  await expect(a.getByTestId("mat-khau-moi")).toBeVisible({ timeout: CHO_ARGON2_MS });
  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `sau khi doi ten ${width}px`).toEqual([]);
  }
});
