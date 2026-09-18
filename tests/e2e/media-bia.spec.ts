import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao } from "./kho-sach";
import { anhPng, khongTranNgang } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("bia tu tai len: chon anh, cat bang phim, dung anh nay, luu; the sach ve anh, anh hong thi tranh ve lo ra", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/sach/moi");
  await a.getByLabel("Tên sách").fill("Những bữa sáng");

  await a.getByLabel("Ảnh của bạn, chọn ảnh làm bìa").setInputFiles({
    name: "bia.png", mimeType: "image/png", buffer: await anhPng(a, 800, 600),
  });
  const san = a.getByRole("group", { name: "Khung cắt ảnh bìa" });
  await expect(san).toBeVisible();
  await expect(san).toBeFocused();
  const khung = a.locator(".cat-bia__vien");
  const truoc = await khung.getAttribute("y");
  await a.keyboard.press("ArrowDown");
  await expect.poll(() => khung.getAttribute("y")).not.toBe(truoc);
  await khongTranNgang(a, "form sach dang mo buoc cat");

  await a.getByRole("button", { name: "Dùng ảnh này" }).click();
  const oAnh = a.getByRole("radio", { name: "Ảnh của bạn" });
  await expect(oAnh).toBeChecked();
  await expect(a.getByRole("group", { name: "Khung cắt ảnh bìa" })).toHaveCount(0);
  const biaSrc = await a.locator(".chon img.bia__anh").getAttribute("src");
  expect(biaSrc ?? "").toMatch(new RegExp("^/m/[0-9a-f-]{36}$"));
  await expect(a.getByRole("complementary", { name: "Xem trước trên kệ" }).locator("img.bia__anh")).toBeVisible();

  await a.getByRole("button", { name: "Tạo sách" }).click();
  await a.waitForURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));

  await a.goto("/ke-sach");
  const the = a.locator(".cuon", { hasText: "Những bữa sáng" });
  const anhBia = the.locator("img.bia__anh");
  await expect(anhBia).toHaveAttribute("src", biaSrc ?? "");
  await expect(anhBia).toBeVisible();

  // Anh hong (kho tat, media da bi don, mat mang): img an di, tranh ve cua bia lo ra, khung giu nguyen.
  // Khung bia tren ke la .cuon__bia (ShelfBook.tsx), khong phai .bia: lop "bia--<khoa>" chi la mot modifier tren no.
  await a.route("**/m/*", (route) => route.abort());
  await a.reload();
  await expect(the.locator(".cuon__bia svg")).toBeVisible();
  await expect(the.locator("img.bia__anh")).toBeHidden();
  expect(await a.locator(".cuon .cuon__bia").first().evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(0);
});
