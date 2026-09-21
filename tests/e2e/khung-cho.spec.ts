import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/**
 * Giu lai yeu cau chuyen man (RSC, khong phai tai truoc) toi duong dan cho toi khi goi tha(). Yeu cau tai truoc van
 * di thang, nen khung giu cho da tai truoc hien duoc trong luc may chu "cham".
 */
async function giuChuyenMan(page: Page, duong: string): Promise<() => void> {
  let tha!: () => void;
  const cho = new Promise<void>((r) => { tha = r; });
  await page.route((url) => url.pathname === duong, async (route) => {
    const h = route.request().headers();
    if (h.rsc && !h["next-router-prefetch"]) await cho;
    await route.continue();
  });
  return tha;
}

/** Nap lai man hien tai va doi moi yeu cau (ke ca tai truoc lien ket) xong. */
async function napLaiVaDoiTaiTruoc(page: Page): Promise<void> {
  await page.reload();
  await page.waitForLoadState("networkidle");
}

test("bam sang man cham: khung giu cho hien ngay, co dong trang thai, roi trang that thay vao", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await napLaiVaDoiTaiTruoc(a);
  const tha = await giuChuyenMan(a, "/ban-nhap");

  await a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Bản nháp" }).click();
  await expect(a.getByRole("status")).toHaveText("Đang mở bản nháp…");
  await expect(a.locator("[aria-busy='true']")).toBeVisible();
  await expect(a.locator(".nav [aria-current]")).toHaveText("Bản nháp");
  // Khung khong mang main hay tieu de: trang that chua toi.
  await expect(a.locator("main")).toHaveCount(0);

  tha();
  await expect(a.getByRole("heading", { level: 1, name: "Bản nháp" })).toBeVisible();
  await expect(a.locator("[aria-busy='true']")).toHaveCount(0);
});

test("man doc co cong: bam cuon tren ke thi khung giu cho hien truoc khi may chu tra xong", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Một trang đã đăng.");
  await a.goto("/ke-sach");
  await napLaiVaDoiTaiTruoc(a);
  const tha = await giuChuyenMan(a, `/sach/${id}`);

  await a.locator(".ngan").getByRole("link", { name: /Chuyện chưa kể/ }).click();
  await expect(a.getByRole("status")).toHaveText("Đang mở sách…");

  tha();
  await expect(a.getByRole("heading", { level: 1, name: "Chuyện chưa kể" })).toBeVisible();
  await expect(a.locator("[aria-busy='true']")).toHaveCount(0);
});
