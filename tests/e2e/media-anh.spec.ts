import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangTrang, docSach, dongContextCu, haiNguoiDaVao, nhapCua, taoSach } from "./kho-sach";
import { khongTranNgang, maTaiMedia, themAnh, toCuaKhoi } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("them anh o man viet: luu nhap, dang, man doc tai duoc, nguoi kia cua sach chia se cung tai duoc", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Những bữa sáng", "chia-se");

  const anhId = await themAnh(a, 600, 400);
  await expect(a.getByText(new RegExp("^Đã lưu lúc "))).toBeVisible({ timeout: 15_000 });
  const nhap = await nhapCua(id);
  expect(JSON.stringify(nhap?.content ?? null), "ban nhap giu id anh").toContain(anhId);
  expect(await maTaiMedia(a, anhId), "chu sach tai duoc anh dang trong nhap").toBe(200);
  expect(await maTaiMedia(b, anhId), "nguoi kia chua duoc, anh moi chi o nhap").toBe(404);
  await khongTranNgang(a, "man viet co anh");

  expect(await dangTrang(a)).toBe(1);
  const anhDoc = a.locator(`.sach img[src="/m/${anhId}"]`);
  await expect(anhDoc).toBeVisible();
  await expect(anhDoc).toHaveAttribute("alt", `Ảnh ${tenCuaA} đăng`);
  expect(await maTaiMedia(a, anhId)).toBe(200);
  await khongTranNgang(a, "man doc co anh");

  await docSach(b, id);
  await expect(b.locator(`.sach img[src="/m/${anhId}"]`)).toBeVisible();
  expect(await maTaiMedia(b, anhId), "nguoi kia doc duoc sach chia se nen tai duoc anh").toBe(200);
});

test("ban phim voi khoi anh: Tab toi nut Bo anh, Delete bo khoi dang chon", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Những bữa sáng", "chia-se");

  await themAnh(a, 400, 300);
  const khoi = a.locator(".viet-chu .node-anh");
  await khoi.click();
  await expect(a.locator(".viet-chu .ProseMirror-selectednode")).toHaveCount(1);
  await a.keyboard.press("Tab");
  const boAnh = a.getByRole("button", { name: "Bỏ ảnh" });
  await expect(boAnh).toBeFocused();
  await boAnh.click();
  await expect(khoi).toHaveCount(0);

  await themAnh(a, 400, 300);
  // Bam lech khoi tam: anh moi nam dung cho anh cu, va ProseMirror coi hai lan bam cach nhau duoi 500ms, lech duoi
  // 10px la bam dup (khong chon khoi). Lan bam Bo anh o giua khong tinh, vi nut chan su kien chuot cua editor.
  await khoi.click({ position: { x: 24, y: 24 } });
  await expect(a.locator(".viet-chu .ProseMirror-selectednode")).toHaveCount(1);
  await a.keyboard.press("Delete");
  await expect(khoi).toHaveCount(0);
  await expect(a.getByText("Đã bỏ ảnh.")).toBeVisible();
});

test("cho ngat trung nhau: anh khong vua to dau thi o to sau, va man doc dat dung to do", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Những bữa sáng", "chia-se");
  await a.setViewportSize({ width: 375, height: 900 });

  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Sáng nay mưa nhỏ, anh chụp lại cái sân.");
  const anhId = await themAnh(a, 600, 900);
  // Doan chu, roi anh cao 456px logic khong vua cho con lai, roi doan trong sau anh cung khong vua tiep: 3 to o man
  // viet. Dang chi ra 2 trang vi Editor.prepare goi trimTrailingBlank, bo to cuoi chi co doan trong.
  await expect.poll(() => a.locator(".viet-to").count()).toBe(3);
  expect(await toCuaKhoi(a, ".viet-chu .node-anh"), "to cua anh o man viet").toBe(1);

  expect(await dangTrang(a)).toBe(2);
  await a.goto(`/sach/${id}?trang=1`);
  await expect(a.locator(".sach")).toContainText("Sáng nay mưa nhỏ");
  await expect(a.locator(`.sach img[src="/m/${anhId}"]`)).toHaveCount(0);
  await a.goto(`/sach/${id}?trang=2`);
  await expect(a.locator(`.sach img[src="/m/${anhId}"]`)).toBeVisible();
});
