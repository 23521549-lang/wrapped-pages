import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, tranNgang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("ke trong: thanh dieu huong, loi moi tao sach, nut Trang moi toi man tao sach", async ({ browser }) => {
  const { a, tenCuaA } = await haiNguoiDaVao(browser);
  const nav = a.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(nav.getByRole("link", { name: "Kệ sách" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Bản nháp" })).not.toHaveAttribute("aria-current");
  await expect(nav).toContainText(tenCuaA);
  await expect(a.getByRole("heading", { level: 1, name: "Kệ sách" })).toBeVisible();
  await expect(a.getByText("Chưa có cuốn nào")).toBeVisible();
  await expect(a.getByRole("heading", { name: "Kệ còn trống." })).toBeVisible();
  await expect(a.getByRole("link", { name: "Tạo sách" })).toHaveAttribute("href", "/sach/moi");

  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  await nav.getByRole("link", { name: "Trang mới" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));
});

test("Cai dat nam tren thanh dieu huong va danh dau dung muc", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Cài đặt" }).click();
  await expect(b).toHaveURL(new RegExp("/cai-dat$"));
  await expect(
    b.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Cài đặt" }),
  ).toHaveAttribute("aria-current", "page");
});

test("nguoi la mo ke sach hoac Trang moi thi bi dua toi dang nhap", async ({ browser }) => {
  await haiNguoiDaVao(browser);
  const c = await (await browser.newContext()).newPage();
  await c.goto("/ke-sach");
  await expect(c).toHaveURL(new RegExp("/dang-nhap$"));
  await c.goto("/viet");
  await expect(c).toHaveURL(new RegExp("/dang-nhap$"));
});
