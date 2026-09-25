import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, docSach, dongContextCu, haiNguoiDaVao, taoSach, toDaXemCua, tranNgang } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("nguoi kia: the co trang moi, mo o to dau chua thay, lat het, quay lai thi het dau trang moi", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba");

  await b.goto("/ke-sach");
  const the = b.locator(".cuon", { hasText: "Chuyện chưa kể" });
  await expect(the.locator(".dh--moi")).toHaveText("3 trang mới");
  await expect(the.locator(".cham")).toHaveCount(1);
  const ganNhat = b.getByRole("article", { name: "Một trang trong sách" });
  await expect(ganNhat).toContainText("Chuyện chưa kể");
  await expect(ganNhat.getByRole("link", { name: "Viết tiếp" })).toHaveCount(0);
  // Nut "Đọc tiếp" cua khung sach lon mo thang to cua doan trich, khong qua tam bia (chu du an chot 26/09).
  await ganNhat.getByRole("link", { name: "Đọc tiếp" }).click();

  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  await expect(b.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 3 trang`);
  await expect(b.getByRole("link", { name: "Sửa sách" })).toHaveCount(0);
  const dem = b.locator(".doc__dem");
  // Sach mo hai trang ghep (1,2), (3,4): to mot nam ngay trang trai, khong de trang trai dau trong.
  await expect(dem).toHaveText("Trang 1-2 / 3");
  await expect(b.locator(".sach .to-giay--trai")).toContainText("Tờ một");
  await expect(b.locator(".sach .to-giay--phai")).toContainText("Tờ hai");
  await expect(b.getByRole("button", { name: "Trang trước" })).toHaveAttribute("aria-disabled", "true");
  expect(await tranNgang(b)).toEqual([]);

  await b.keyboard.press("ArrowRight");
  await expect(dem).toHaveText("Trang 3 / 3");
  await expect(b.locator(".sach")).toContainText("Tờ ba");
  await expect(b.getByRole("button", { name: "Trang sau" })).toHaveAttribute("aria-disabled", "true");
  await b.keyboard.press("ArrowLeft");
  await expect(dem).toHaveText("Trang 1-2 / 3");
  await b.keyboard.press("ArrowRight");
  await expect(dem).toHaveText("Trang 3 / 3");

  // DOI HANH VI CO Y: mot khung chi tinh la da doc khi nguoi doc DUNG lai tren no du CHO_MS (600ms), va luat do dung
  // o moi duong roi man doc - roi man khong con gui ho khung con dang hen nua. Nen phai dung lai that tren khung cuoi
  // truoc khi quay lai. Doi DUNG DONG trong read_sheets thay vi doi gio.
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1, 2, 3]);

  await b.goBack();
  await expect(b).toHaveURL(new RegExp("/ke-sach$"));
  await expect(the.locator(".dh--moi")).toHaveCount(0);
  await expect(the.locator(".cham")).toHaveCount(0);
});

test("chu sach: Viet tiep va Sua sach, mo dung ?trang, man hep mot trang, giam chuyen dong van lat", async ({ browser }) => {
  const { a, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba");
  await a.setViewportSize({ width: 375, height: 800 });
  await a.emulateMedia({ reducedMotion: "reduce" });

  await a.goto(`/sach/${id}?trang=2`);
  await expect(a.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 3 trang · ${tenCuaB} đọc được`);
  await expect(a.getByRole("link", { name: "Viết tiếp" })).toHaveAttribute("href", `/sach/${id}/viet-tiep`);
  await expect(a.getByRole("link", { name: "Sửa sách" })).toHaveAttribute("href", `/sach/${id}/sua`);
  const dem = a.locator(".doc__dem");
  await expect(dem).toHaveText("Trang 2 / 3");
  expect(await tranNgang(a)).toEqual([]);

  // Gan mot MutationObserver de phan biet lat that (mot ".la" duoc chen) voi mo chong khong lat.
  await a.evaluate(() => {
    const w = window as unknown as { coLa: boolean };
    w.coLa = false;
    new MutationObserver(() => {
      if (document.querySelector(".la")) w.coLa = true;
    }).observe(document.body, { childList: true, subtree: true });
  });

  await a.getByRole("button", { name: "Trang sau" }).click();
  await expect(dem).toHaveText("Trang 3 / 3");
  // Bam hai lan lien: lan hai duoc hen va chay ngay sau lan dau.
  const truoc = a.getByRole("button", { name: "Trang trước" });
  await truoc.click();
  await truoc.click();
  await expect(dem).toHaveText("Trang 1 / 3");
  // Giam chuyen dong phai mo chong, khong duoc lat 3D nhu binh thuong.
  expect(await a.evaluate(() => (window as unknown as { coLa: boolean }).coLa)).toBe(false);
});

test("sach rieng tu cua nguoi kia va ma rac la 404; cuon chua co to thi hien loi nhan trong", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  const chung = await taoSach(a, "Chuyện chưa kể", "chia-se");

  expect((await b.goto(`/sach/${rieng}`))?.status()).toBe(404);
  expect((await b.goto("/sach/khong-phai-ma-sach"))?.status()).toBe(404);

  await docSach(b, chung);
  await expect(b.getByRole("heading", { name: "Chưa có trang nào." })).toBeVisible();
  await expect(b.getByText(`${tenCuaA} chưa đăng trang nào trong cuốn này.`)).toBeVisible();
  await expect(b.getByRole("link", { name: "Viết trang đầu" })).toHaveCount(0);

  await docSach(a, rieng);
  await expect(a.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 0 trang · Chỉ mình bạn đọc`);
  await expect(a.getByRole("link", { name: "Viết trang đầu" })).toHaveAttribute("href", `/sach/${rieng}/viet-tiep`);
});
