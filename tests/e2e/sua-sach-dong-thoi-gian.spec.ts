import { expect, test } from "@playwright/test";
import { resetDb } from "./db";
import { biaCua, dangTrang, datNhac, dongContextCu, haiNguoiDaVao, nhacCua, taoSach } from "./kho-sach";

/*
 * Hai muc dong thoi gian cua man Sua sach. Day la cho duy nhat sua duoc mot o da co, nen ca hai muc deu la duong ghi
 * that, khong phai trang tri.
 */

const MA = "dQw4w9WgXcQ";

/*
 * Bang bia nam trong mot khung cuon cao 300px (yeu cau so 13 cua chu du an: kho anh nhieu thi thu gon lai), nen mot o
 * co the dang nam ngoai phan thay duoc cua khung. Keo o vao tam nhin roi bam vao chinh cai nhan bao no, dung nhu nguoi
 * dung lam: o radio that nam kin duoi nhan, khong ai bam thang vao no.
 */
async function chonBiaVe(dong: import("@playwright/test").Locator, khoa: string, ten: string): Promise<void> {
  const nhan = dong.locator(`label.swatch:has(input[value="${khoa}"]:not([data-anh]))`);
  await nhan.scrollIntoViewIfNeeded();
  await nhan.click();
  await expect(dong.getByRole("radio", { name: ten })).toBeChecked();
}

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

/** Tao mot cuon va dang hai luot, moi luot mot to. Tra ma sach. */
async function haiLuot(page: import("@playwright/test").Page, ten: string): Promise<string> {
  const id = await taoSach(page, ten, "chia-se");
  await page.locator(".viet-chu .ProseMirror").click();
  await page.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(page);
  await page.goto(`/sach/${id}/viet`);
  await page.locator(".viet-chu .ProseMirror").click();
  await page.keyboard.insertText("Lượt thứ hai.");
  await dangTrang(page);
  return id;
}

test("doi bia cua mot luot cu: the tren ke khong doi, vi ke lay bia moi nhat", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");

  // Dat mot o bia cho luot thu hai qua trang Viet tiep thi phai dang them mot luot nua; thay vao do dien thang o TRONG
  // cua luot thu hai ngay tren man Sua sach, dung duong ma muc nay sinh ra.
  await a.goto(`/sach/${id}/sua`);
  const dong = a.locator(".o-ds").first().getByRole("listitem");
  await expect(dong).toHaveCount(3);

  // Dong cuoi la luot thu hai, dang trong.
  await expect(dong.last()).toContainText("Chưa có bìa");
  await dong.last().getByRole("button", { name: /Thêm bìa/ }).click();
  await chonBiaVe(dong.last(), "khom-truc", "Bìa khóm trúc");
  await dong.last().getByRole("button", { name: "Lưu" }).click();
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa", "khom-truc"]);

  await a.goto("/ke-sach");
  await expect(a.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".bia--khom-truc")).toBeVisible();

  // Doi o MO DAU (bia cu nhat): ke van ve bia moi nhat, khong doi.
  await a.goto(`/sach/${id}/sua`);
  const dong2 = a.locator(".o-ds").first().getByRole("listitem");
  await dong2.first().getByRole("button", { name: /Đổi bìa này/ }).click();
  await chonBiaVe(dong2.first(), "trang-nuoc", "Bìa trăng trên nước");
  await dong2.first().getByRole("button", { name: "Lưu" }).click();
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["trang-nuoc", "khom-truc"]);

  await a.goto("/ke-sach");
  await expect(a.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".bia--khom-truc")).toBeVisible();
});

test("bo mot o bia, va bi chan khi chi con mot o", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");

  await a.goto(`/sach/${id}/sua`);
  const dong = a.locator(".o-ds").first().getByRole("listitem");
  // Moi co mot o bia (o mo dau): khong dong nao cho bo.
  await expect(a.locator(".o-ds").first().getByRole("button", { name: /Bỏ ô này/ })).toHaveCount(0);

  // Dien them mot o cho luot thu hai roi bo no di.
  await dong.last().getByRole("button", { name: /Thêm bìa/ }).click();
  await chonBiaVe(dong.last(), "khom-truc", "Bìa khóm trúc");
  await dong.last().getByRole("button", { name: "Lưu" }).click();
  await expect.poll(async () => (await biaCua(id)).length).toBe(2);

  const bo = a.locator(".o-ds").first().getByRole("button", { name: /Bỏ ô này/ });
  await expect(bo).toHaveCount(2);
  await bo.last().click();
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa"]);
  // Con dung mot o: nut bo bien mat tren ca hai dong.
  await expect(a.locator(".o-ds").first().getByRole("button", { name: /Bỏ ô này/ })).toHaveCount(0);
});

test("go nhac tu mot luot: man doc khong con khung nhac nen", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");
  await datNhac(id, MA);
  await a.goto(`/sach/${id}`);
  await expect(a.getByRole("heading", { name: "Nhạc nền" })).toBeVisible();

  await a.goto(`/sach/${id}/sua`);
  const nhac = a.locator(".o-ds").nth(1).getByRole("listitem");
  await expect(nhac).toHaveCount(3);
  await expect(nhac.first()).toContainText(`https://youtu.be/${MA}`);
  await nhac.last().getByRole("button", { name: /Gỡ nhạc từ lượt này/ }).click();
  await expect(nhac.last()).toContainText("Gỡ nhạc nền");

  // O mo dau van giu ma cu (lich su khong bi viet lai), nhung nhac hien hanh la o moi nhat, tuc khong con nhac.
  expect(await nhacCua(id)).toBe(MA);
  await a.goto(`/sach/${id}`);
  await expect(a.getByRole("heading", { name: "Nhạc nền" })).toHaveCount(0);
});

test("cuon cua nguoi kia: hai muc dong thoi gian khong toi duoc", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const r = await b.goto(`/sach/${id}/sua`);
  expect(r?.status()).toBe(404);
});
