import { test, expect } from "@playwright/test";
import { CHAR_COUNT_SHOW_RATIO } from "@/lib/doc/counter";
import { DOC_LIMITS } from "@/lib/doc/validate";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const CAU = "mua dau thang chin ";

/** Chu dai dung n ky tu, co khoang trang de xuong dong nhu chu that. */
const chu = (n: number) => CAU.repeat(Math.ceil(n / CAU.length)).slice(0, n);

test("bo dem ky tu: an xa tran, hien gan tran, vuot tran thi canh bao thay trang thai luu", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  const max = DOC_LIMITS.maxChars;
  const nguong = Math.ceil(max * CHAR_COUNT_SHOW_RATIO);
  const dau = a.locator(".viet-dau");
  const trangThai = dau.locator("[aria-live]");
  const dem = dau.locator(".dem-chu:not(.dem-chu--tran)");

  await a.locator(".viet-chu .ProseMirror").click();

  // Ngay duoi nguong: tu luu xong (da qua mot luot do) ma bo dem van an.
  await a.keyboard.insertText(chu(nguong - 1));
  await expect(trangThai).toHaveText(/^Đã lưu lúc/, { timeout: 10_000 });
  await expect(dem).toHaveCount(0);

  // Cham nguong: so dem hien canh trang thai luu.
  await a.keyboard.insertText(chu(1));
  await expect(dem).toHaveText("18 000 / 20 000 ký tự");

  // Vuot tran mot ky tu: canh bao chiem cho trang thai luu, so dem an, Dang trang van bam duoc.
  await a.keyboard.insertText(chu(max - nguong + 1));
  await expect(trangThai).toHaveCount(1);
  await expect(trangThai).toContainText("Vượt 20 000 ký tự, nháp không lưu được. Đăng bớt trang rồi viết tiếp.");
  await expect(dem).toHaveCount(0);
  const dang = a.getByRole("button", { name: "Đăng trang" });
  await expect(dang).toBeEnabled();
  await expect(dang).not.toHaveAttribute("aria-disabled", "true");

  // Xoa mot ky tu, dung bang tran: canh bao mat, so dem quay lai, va ban nhap luu duoc.
  await a.keyboard.press("Backspace");
  await expect(dem).toHaveText("20 000 / 20 000 ký tự");
  await expect(trangThai).not.toContainText("Vượt");
  await expect(trangThai).toHaveText(/^Đã lưu lúc/, { timeout: 10_000 });
});
