import type { Page } from "@playwright/test";

/** Tao cho ngoi qua SeatForm (dang o /khoi-tao). Tra ve mat khau moi sinh (data-testid="mat-khau"). */
export async function taoCho(page: Page, nickname: string, secret: string): Promise<string> {
  await page.getByLabel("Biệt danh bạn đặt cho người kia").fill(nickname);
  await page.getByLabel("Lời nhắn bí mật gửi họ").fill(secret);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  return page.getByTestId("mat-khau").innerText();
}

/** Dang nhap qua LoginForm (dang o /dang-nhap). */
export async function dangNhap(page: Page, password: string): Promise<void> {
  await page.getByLabel("Mật khẩu người kia gửi cho bạn").fill(password);
  await page.getByRole("button", { name: "Vào", exact: true }).click();
}
