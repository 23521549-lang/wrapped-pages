import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, ghiCamXuc, haiNguoiDaVao } from "./kho-sach";

/*
 * Chon hinh dang Chip (ga con, blob xanh, dai bang) tren trinh duyet that: chon o Cai dat thi tai lai nut goc doi anh
 * theo, doi dang khac thi doi theo; giam chuyen dong thi dung khung tinh; luc mang cam xuc thi nut van hien thu Fluent
 * chu khong hien dang da chon. a la Manh, b la Linh.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Chon mot dang o Cai dat, cho server action luu xong roi moi tai lai. */
async function chonDang(p: Page, ten: string) {
  await p.goto("/cai-dat");
  const o = p.getByRole("radio", { name: ten });
  const daLuu = p.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await o.click();
  await daLuu;
  await expect(o).toBeChecked();
  await p.reload();
}

test("chon dai bang o Cai dat: tai lai nut goc doi anh, doi sang blob thi doi theo", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/cai-dat");
  await expect(a.getByRole("radio", { name: "Gà con" })).toBeChecked();
  await expect(a.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/chip.webp");

  await chonDang(a, "Đại bàng");
  await expect(a.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/daibang.webp");

  await chonDang(a, "Blob xanh");
  await expect(a.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/blob.webp");
});

test("giam chuyen dong: nut goc dung khung tinh cua dai bang", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await chonDang(a, "Đại bàng");
  await a.emulateMedia({ reducedMotion: "reduce" });
  await a.goto("/ke-sach");
  await expect(a.locator(".linh-vat__hinh source")).toHaveAttribute("srcset", "/linh-vat/daibang-tinh.webp");
});

test("luc mang cam xuc thi nut van hien thu Fluent, khong hien dang da chon", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await chonDang(b, "Đại bàng");
  await expect(b.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/daibang.webp");
  await ghiCamXuc("Mạnh", { loai: "yeu", giayTruoc: 5 });
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-lv__chu")).toContainText("Mạnh đang cảm thấy yêu bạn");
  await expect(b.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/gau-bong.webp");
});
