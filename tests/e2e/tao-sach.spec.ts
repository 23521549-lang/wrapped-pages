import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("tao sach qua giao dien: the xem truoc doi theo form, xong thi toi man viet", async ({ browser }) => {
  const { a, tenCuaB } = await haiNguoiDaVao(browser);
  await a.getByRole("link", { name: "Tạo sách" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));

  const xemTruoc = a.getByRole("complementary", { name: "Xem trước trên kệ" });
  await a.getByLabel("Tên sách").fill("Chuyện chưa kể");
  await expect(xemTruoc).toContainText("Chuyện chưa kể");
  await expect(xemTruoc).toContainText(`${tenCuaB} sẽ thấy cuốn này trên kệ.`);
  await a.getByRole("radio", { name: "Riêng tư", exact: true }).check();
  await expect(xemTruoc).toContainText(`${tenCuaB} không thấy cuốn này, kể cả tên.`);
  await expect(xemTruoc.locator(".chip", { hasText: "Riêng tư" })).toBeVisible();
  await a.getByRole("radio", { name: "Chia sẻ", exact: true }).check();
  await a.getByRole("radio", { name: "Bìa khóm trúc" }).check();
  await expect(xemTruoc.locator(".book__cover")).toHaveClass(new RegExp("bia--khom-truc"));

  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  await a.getByRole("button", { name: "Tạo sách" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
});

test("ten trong thi bao loi ngay o o ten va khong gui form", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/sach/moi");
  await a.getByRole("button", { name: "Tạo sách" }).click();
  await expect(a.getByText("Sách cần có tên. Viết vài chữ, đổi lại sau cũng được.")).toBeVisible();
  await expect(a.getByLabel("Tên sách")).toHaveAttribute("aria-invalid", "true");
  await expect(a.getByLabel("Tên sách")).toBeFocused();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));
});

test("sach rieng tu chi chu thay; chi chu sua duoc; Trang moi mo cuon vua sua", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const chung = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");

  await a.goto("/ke-sach");
  await expect(a.getByText("2 cuốn")).toBeVisible();
  await expect(a.locator(".book", { hasText: "Cuốn không đặt tên" }).locator(".chip", { hasText: "Riêng tư" })).toBeVisible();
  await expect(a.locator(".book", { hasText: "Chuyện chưa kể" })).toContainText("0 trang");
  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  await b.goto("/ke-sach");
  await expect(b.getByText("1 cuốn")).toBeVisible();
  await expect(b.locator(".grid")).toContainText("Chuyện chưa kể");
  await expect(b.locator("main")).not.toContainText("Cuốn không đặt tên");
  expect((await b.goto(`/sach/${chung}/sua`))?.status()).toBe(404);
  expect((await b.goto(`/sach/${rieng}/sua`))?.status()).toBe(404);

  await a.goto(`/sach/${chung}/sua`);
  await expect(a.getByLabel("Tên sách")).toHaveValue("Chuyện chưa kể");
  await expect(a.getByRole("radio", { name: "Chia sẻ", exact: true })).toBeChecked();
  await a.getByLabel("Tên sách").fill("Mưa đầu tháng chín");
  await a.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${chung}$`));

  await b.goto("/ke-sach");
  await expect(b.locator(".grid")).toContainText("Mưa đầu tháng chín");

  // Chua co ban nhap nao, nen /viet chon cuon co hoat dong gan nhat: cuon vua sua.
  await a.goto("/viet");
  await expect(a).toHaveURL(new RegExp(`/sach/${chung}/viet$`));
});
