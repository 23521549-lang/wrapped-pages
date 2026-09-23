import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datNhac, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";

/*
 * Doi bia, ten, nhac ngay o buoc dang trang: khong mo thi khong doi gi, mo ra thi doi cung luc voi lan dang, va cuon
 * chua co to nao thi khong co muc do.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const MUC = "Đổi bìa, tên, nhạc";
const NHAC = "5qap5aO4i9A";

test("cuon da co to: mo muc gap, doi ten va bia, dang mot lan la doi ca hai", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một");

  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Tờ hai.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  const nutMuc = hoi.getByRole("button", { name: MUC });
  await expect(nutMuc).toHaveAttribute("aria-expanded", "false");
  await nutMuc.click();
  await expect(nutMuc).toHaveAttribute("aria-expanded", "true");

  const oTen = hoi.getByLabel("Tên sách");
  await expect(oTen).toHaveValue("Chuyện chưa kể");
  await oTen.fill("Mùa đi qua sân");
  await hoi.getByRole("radio", { name: "Bìa cành hoa đào" }).check();
  expect(await tranNgang(a)).toEqual([]);

  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=2$`));
  await expect(a.getByRole("heading", { name: "Mùa đi qua sân" })).toBeVisible();

  // Bia moi that su duoc ghi, khong chi cai ten.
  await a.goto(`/sach/${id}/sua`);
  await expect(a.getByRole("radio", { name: "Bìa cành hoa đào" })).toBeChecked();

  await b.goto("/ke-sach");
  await expect(b.locator(".cuon", { hasText: "Mùa đi qua sân" })).toHaveCount(1);
  // Dong Hoat dong chi co dung mot su kien dang trang (dangToThang chen thang vao database nen khong sinh su kien),
  // tuc doi bia, ten, nhac khong them loai su kien nao.
  await expect(b.locator("section.hoat-dong").getByRole("listitem")).toHaveCount(1);
});

test("khong mo muc gap thi khong doi gi; cuon chua co to thi khong co muc do", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await datNhac(id, NHAC);

  // Cuon chua co to nao: buoc dang giu nguyen chieu dai, khong co muc gap.
  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Tờ một.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  await expect(a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: MUC })).toHaveCount(0);
  await a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=1$`));

  // Cuon da co to: co muc gap, nhung khong mo thi ten giu nguyen.
  await a.goto(`/sach/${id}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Tờ hai.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi.getByRole("button", { name: MUC })).toHaveAttribute("aria-expanded", "false");
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=2$`));
  await expect(a.getByRole("heading", { name: "Chuyện chưa kể" })).toBeVisible();

  // Ca ba o deu nguyen: ten, bia va nhac nen.
  await a.goto(`/sach/${id}/sua`);
  await expect(a.getByLabel("Tên sách")).toHaveValue("Chuyện chưa kể");
  await expect(a.getByRole("radio", { name: "Bìa núi xa" })).toBeChecked();
  await expect(a.getByLabel("Nhạc nền")).toHaveValue(`https://youtu.be/${NHAC}`);
});
