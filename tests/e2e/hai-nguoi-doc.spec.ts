import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangTrang, dongContextCu, haiNguoiDaVao, taoSach, vietTranTrang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DA_LUU = new RegExp("^Đã lưu lúc [0-9]{2}:[0-9]{2}$");

/** The cua mot cuon tren ke dang mo. */
const theSach = (page: Page, ten: string) => page.locator(".cuon", { hasText: ten });

test("A viet va dang; B thay trang moi, doc tu to chua doc, lat het thi het dau; rieng tu va nhap khong lo", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  let id = "";
  let soTo = 0;

  await test.step("A viet mot trang tran sang to sau roi dang vao sach chia se", async () => {
    id = await taoSach(a, "Chuyện chưa kể", "chia-se");
    await vietTranTrang(a);
    soTo = await dangTrang(a);
    expect(soTo).toBeGreaterThanOrEqual(2);
    await expect(a.locator(".doc__dem")).toContainText(`/ ${soTo}`);
  });

  await test.step("B thay cuon do tren ke, co cham xanh va dong so trang moi", async () => {
    await b.goto("/ke-sach");
    await expect(theSach(b, "Chuyện chưa kể").locator(".cham")).toHaveCount(1);
    await expect(theSach(b, "Chuyện chưa kể").locator(".dh--moi")).toHaveText(`${soTo} trang mới`);
    await expect(b.getByRole("article", { name: "Trang gần nhất" })).toContainText(`${tenCuaA} vừa viết`);
  });

  await test.step("B mo sach o to 1, chua lat da quay lai: con dung so to chua thay", async () => {
    await theSach(b, "Chuyện chưa kể").getByRole("link", { name: "Chuyện chưa kể" }).click();
    await expect(b.locator(".doc__dem")).toHaveText(`Trang 1 / ${soTo}`);
    await b.goBack();
    await expect(theSach(b, "Chuyện chưa kể").locator(".dh--moi")).toHaveText(`${soTo - 1} trang mới`);
  });

  await test.step("B mo lai thi bat dau o to dau chua doc, lat toi to cuoi, quay lai ke thi het dau", async () => {
    await theSach(b, "Chuyện chưa kể").getByRole("link", { name: "Chuyện chưa kể" }).click();
    // To 2 la to dau chua doc; o che do hai trang no nam ben trai cua khung thu hai (src/lib/flip.ts).
    await expect(b.locator(".doc__dem")).toHaveText(soTo >= 3 ? `Trang 2-3 / ${soTo}` : `Trang 2 / ${soTo}`);
    const sau = b.getByRole("button", { name: "Trang sau" });
    while ((await sau.getAttribute("aria-disabled")) !== "true") {
      const nhan = await b.locator(".doc__dem").innerText();
      await b.keyboard.press("ArrowRight");
      await expect(b.locator(".doc__dem")).not.toHaveText(nhan);
    }
    await expect(b.locator(".doc__dem")).toContainText(`${soTo} / ${soTo}`);
    await b.goBack();
    await expect(b).toHaveURL(new RegExp("/ke-sach$"));
    await expect(theSach(b, "Chuyện chưa kể").locator(".dh--moi")).toHaveCount(0);
    await expect(theSach(b, "Chuyện chưa kể").locator(".cham")).toHaveCount(0);
  });

  await test.step("sach rieng tu va ban nhap cua A khong lo o dau voi B", async () => {
    const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
    await a.locator(".viet-chu .ProseMirror").click();
    await a.keyboard.insertText("Có những chuyện anh chưa biết kể thế nào cho đúng.");
    await expect(a.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });
    await a.goto(`/sach/${id}/viet`);
    await a.locator(".viet-chu .ProseMirror").click();
    await a.keyboard.insertText("Nháp chưa đăng của cuốn chia sẻ.");
    await expect(a.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });
    await a.goto("/ban-nhap");
    await expect(a.getByText("2 bản nháp · chỉ mình bạn thấy")).toBeVisible();

    await b.goto("/ke-sach");
    await expect(b.getByRole("heading", { level: 1, name: "Kệ sách" })).toBeVisible();
    await expect(b.locator("main")).not.toContainText("Cuốn không đặt tên");
    await expect(b.locator("main")).not.toContainText("Nháp chưa đăng");
    expect((await b.goto(`/sach/${rieng}`))?.status()).toBe(404);
    await b.goto(`/sach/${id}`);
    await expect(b.locator(".doc__dem")).toBeVisible();
    await expect(b.locator("main")).not.toContainText("Nháp chưa đăng");
    await b.goto("/ban-nhap");
    await expect(b.getByRole("heading", { name: "Chưa có bản nháp." })).toBeVisible();
    await expect(b.locator("main")).not.toContainText("Cuốn không đặt tên");
    await expect(b.locator("main")).not.toContainText("Chuyện chưa kể");
    for (const duong of [`/sach/${id}/viet`, `/sach/${id}/sua`, `/sach/${rieng}/viet`, `/sach/${rieng}/sua`]) {
      expect((await b.goto(duong))?.status(), duong).toBe(404);
    }
  });
});
