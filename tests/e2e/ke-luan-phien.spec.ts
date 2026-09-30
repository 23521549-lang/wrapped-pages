import { test, expect, type Locator, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, toDaXemCua, tranNgang } from "./kho-sach";

/*
 * Khung sach lon luan phien (spec 5a muc E): tu hai luot chua doc tro len thi khung doi luot moi 15 giay, moi luot mang
 * nhan "Bạn chưa đọc" (luot cua nguoi kia) hay "{tên} chưa đọc" (luot cua minh nguoi kia chua doc het) va dong dem.
 * Doc xong mot luot thi con mot: khung hien luot do, khong luan phien, khong dong dem.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const khung = (p: Page): Locator => p.getByRole("article", { name: "Một trang trong sách" });

test("hai luot chua doc luan phien 15 giay; chu sach thay nhan cham rong; doc xong mot luot thi con mot", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt một, tờ một.");
  await dangToThang(id, "Lượt hai, tờ hai.");

  await b.setViewportSize({ width: 1280, height: 900 });
  await b.goto("/ke-sach");
  const k = khung(b);
  await expect(k.locator(".vua-viet__dem")).toHaveText("Lượt chưa đọc 1 / 2");
  await expect(k.locator(".vua-viet__nhan")).toHaveText("Bạn chưa đọc");
  // Moi nhat truoc, lan ve dau hien du chu (khong go).
  await expect(k.locator(".vua-viet__chu")).toHaveText("Lượt hai, tờ hai.");
  await expect(k.getByRole("link", { name: "Đọc tiếp" })).toHaveAttribute("href", `/sach/${id}`);
  expect(await tranNgang(b)).toEqual([]);
  // 15 giay sau: sang luot ke, trang phai go tung chu (ban day du nam trong chu an), roi con lai chu thuong.
  await expect(k.locator(".vua-viet__dem")).toHaveText("Lượt chưa đọc 2 / 2", { timeout: 20_000 });
  await expect(k.locator(".vua-viet__chu")).toHaveText("Lượt một, tờ một.", { timeout: 10_000 });
  await expect(k.locator(".vua-viet__chu .con-tro")).toHaveCount(0, { timeout: 10_000 });

  // Chu sach: ca hai luot cua minh nguoi kia chua doc, nhan cham rong va nut Viet tiep.
  await a.setViewportSize({ width: 1280, height: 900 });
  await a.goto("/ke-sach");
  await expect(khung(a).locator(".vua-viet__nhan")).toHaveText(`${tenCuaB} chưa đọc`);
  await expect(khung(a).locator(".vua-viet__nhan .cham--rong")).toHaveCount(1);
  await expect(khung(a).getByRole("link", { name: "Viết tiếp" })).toHaveAttribute("href", `/sach/${id}/viet-tiep`);

  // Nguoi kia doc to 2 (luot hai) tren man hep: mot khung mot to, nen chi luot hai duoc doc xong.
  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto(`/sach/${id}?trang=2`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 2 / 2");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([2]);
  await b.setViewportSize({ width: 1280, height: 900 });
  await b.goto("/ke-sach");
  await expect(k.locator(".vua-viet__nhan")).toHaveText("Bạn chưa đọc");
  await expect(k.locator(".vua-viet__chu")).toHaveText("Lượt một, tờ một.");
  await expect(k.locator(".vua-viet__dem")).toHaveCount(0);
});
