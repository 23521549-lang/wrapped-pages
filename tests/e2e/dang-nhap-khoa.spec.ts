import { expect, test } from "@playwright/test";
import { resetDb } from "./db";
import { dangNhap, taoCho } from "./ho-tro";
import { UNTRUSTED_MAX_FAILS } from "@/server/identity/rate-limit";

test.beforeEach(async () => {
  await resetDb();
});

const KHOA_CHUNG = "tạm chặn mọi trình duyệt chưa từng đăng nhập ở đây";

test("do mat khau bang cach bo cookie sau moi lan sai: toi nguong chung thi trinh duyet la bi chan, trinh duyet quen van vao duoc", async ({ browser }) => {
  // Mot chuoi dai dang nhap sai, moi lan bam argon2 hai lan tren may chu: rong tay hon muc 30s mac dinh.
  test.setTimeout(120_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextKe = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageKe = await contextKe.newPage();

  let matKhau1 = "";

  await test.step("Buoc 1: A tao cho cho B, B dang nhap mot lan nen trinh duyet cua B thanh quen", async () => {
    await pageA.goto("/");
    await expect(pageA).toHaveURL(/\/khoi-tao$/);
    matKhau1 = await taoCho(pageA, "Nguoi mo dau", "mot loi nhan bi mat");
    await pageB.goto("/dang-nhap");
    await dangNhap(pageB, matKhau1);
    await expect(pageB).not.toHaveURL(/\/dang-nhap$/);
  });

  await test.step("Buoc 2: ke do bo cookie truoc moi lan go sai, van chi duoc sai toi nguong chung", async () => {
    for (let i = 0; i < UNTRUSTED_MAX_FAILS; i++) {
      await contextKe.clearCookies();
      await pageKe.goto("/dang-nhap");
      await dangNhap(pageKe, `sai-sai-sai-${String(i).padStart(2, "0")}`);
      await expect(pageKe.getByText("Mật khẩu không đúng.")).toBeVisible();
    }
    await contextKe.clearCookies();
    await pageKe.goto("/dang-nhap");
    // Go dung di nua cung bi chan: khoa xet truoc mat khau, nen ke do khong biet minh vua trung hay khong.
    await dangNhap(pageKe, matKhau1);
    await expect(pageKe.getByText(KHOA_CHUNG)).toBeVisible();
    await expect(pageKe).toHaveURL(/\/dang-nhap$/);
  });

  await test.step("Buoc 3: B dang xuat roi dang nhap lai tren chinh trinh duyet quen: khong bi khoa", async () => {
    await contextB.clearCookies({ name: "mqce_session" });
    await pageB.goto("/dang-nhap");
    await dangNhap(pageB, "sai-sai-sai-99");
    await expect(pageB.getByText("Mật khẩu không đúng.")).toBeVisible();
    await dangNhap(pageB, matKhau1);
    await expect(pageB).not.toHaveURL(/\/dang-nhap$/);
  });
});
