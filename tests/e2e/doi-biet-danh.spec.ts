import { expect, test } from "@playwright/test";
import { resetDb } from "./db";
import { dangNhap, taoCho } from "./ho-tro";

test.beforeEach(async () => {
  await resetDb();
});

test("doi biet danh va gui loi nhan: doi mat khau, an loi nhan chua gui, hien loi nhan da gui", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  let matKhau2 = "";
  let matKhauMoiA = "";

  await test.step("Buoc 1: hoan tat nghi thuc, A va B deu dang nhap", async () => {
    await pageA.goto("/");
    const matKhau1 = await taoCho(pageA, "Nguoi mo dau", "mot loi nhan bi mat cho nguoi kia");

    await pageB.goto("/dang-nhap");
    await dangNhap(pageB, matKhau1);
    matKhau2 = await taoCho(pageB, "Nguoi dap le", "cho nguoi mo dau");

    await pageA.goto("/dang-nhap");
    await dangNhap(pageA, matKhau2);
    await expect(pageA).toHaveURL(/\/ke-sach$/);
  });

  await test.step("Buoc 2: B vao /ke-sach, bam lien ket Cai dat", async () => {
    await pageB.goto("/ke-sach");
    await pageB.getByRole("link", { name: "Cài đặt" }).click();
    await expect(pageB.getByText("Tên này do người kia đặt")).toBeVisible();
  });

  await test.step("Buoc 3: B doi biet danh va loi nhan cho A, qua buoc xac nhan", async () => {
    await pageB.getByLabel("Biệt danh mới cho người kia").fill("Manh");
    await pageB.getByLabel("Lời nhắn bí mật mới").fill("hien nha hom mua");

    // Huy xac nhan: khong duoc gui form, khong co gi doi o phia may chu.
    await pageB.getByRole("button", { name: "Đổi tên" }).click();
    await expect(pageB.getByRole("button", { name: "Xác nhận đổi" })).toBeVisible();
    await pageB.getByRole("button", { name: "Quay lại" }).click();
    await expect(pageB.getByTestId("mat-khau-moi")).toHaveCount(0);
    await pageB.reload();
    await expect(pageB.getByText("hien nha hom mua")).toHaveCount(0);

    // That su doi: dien lai, qua buoc xac nhan, bam xac nhan that.
    await pageB.getByLabel("Biệt danh mới cho người kia").fill("Manh");
    await pageB.getByLabel("Lời nhắn bí mật mới").fill("hien nha hom mua");
    await pageB.getByRole("button", { name: "Đổi tên" }).click();
    await pageB.getByRole("button", { name: "Xác nhận đổi" }).click();

    matKhauMoiA = await pageB.getByTestId("mat-khau-moi").innerText();
    expect(matKhauMoiA).not.toBe(matKhau2);
  });

  await test.step("Buoc 4: B gui loi nhan vua doi, chi dung muc do doi trang thai", async () => {
    const muc = pageB.getByRole("listitem").filter({ hasText: "hien nha hom mua" });
    await expect(muc.getByText("Họ chưa đọc được")).toBeVisible();

    await muc.getByRole("button", { name: "Gửi lời nhắn" }).click();

    await expect(muc.getByText("Đã gửi cho họ")).toBeVisible();
  });

  const contextA2 = await browser.newContext();
  const pageA2 = await contextA2.newPage();

  await test.step("Buoc 5: context moi cua A, mat khau cu bi tu choi, mat khau moi dang nhap duoc", async () => {
    await pageA2.goto("/dang-nhap");
    await dangNhap(pageA2, matKhau2);
    await expect(pageA2.getByText("Mật khẩu không đúng.")).toBeVisible();

    await pageA2.goto("/dang-nhap");
    await dangNhap(pageA2, matKhauMoiA);
    await expect(pageA2).toHaveURL(/\/ke-sach$/);
  });

  await test.step("Buoc 6: A mo /cai-dat, ten moi hien ra, loi nhan chua gui van kin", async () => {
    await pageA2.goto("/cai-dat");

    const tenCuaBan = pageA2.locator("section").filter({ hasText: "Tên của bạn" });
    await expect(tenCuaBan.getByText("Manh")).toBeVisible();

    const hoGuiBan = pageA2.locator("section").filter({ hasText: "Họ gửi bạn" });
    await expect(hoGuiBan.getByText("hien nha hom mua")).toBeVisible();
    await expect(hoGuiBan.getByText("cho nguoi mo dau")).toHaveCount(0);
  });

  await contextA2.close();

  await contextA.close();
  await contextB.close();
});

test("rao chan: chua dang nhap mo /cai-dat thi bi day toi /dang-nhap", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  await pageA.goto("/");
  const matKhau1 = await taoCho(pageA, "Nguoi mo dau", "mot loi nhan bi mat cho nguoi kia");

  await pageB.goto("/dang-nhap");
  await dangNhap(pageB, matKhau1);
  await taoCho(pageB, "Nguoi dap le", "loi nhan thu hai cho nguoi mo dau");

  await pageC.goto("/cai-dat");
  await expect(pageC).toHaveURL(/\/dang-nhap$/);

  await contextA.close();
  await contextB.close();
  await contextC.close();
});

test("rao chan: moi co cho 1, B da dang nhap mo /cai-dat thi bi day toi /khoi-tao", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/");
  const matKhau1 = await taoCho(pageA, "Nguoi mo dau", "mot loi nhan bi mat cho nguoi kia");

  await pageB.goto("/dang-nhap");
  await dangNhap(pageB, matKhau1);
  await expect(pageB).toHaveURL(/\/khoi-tao$/);

  await pageB.goto("/cai-dat");
  await expect(pageB).toHaveURL(/\/khoi-tao$/);

  await contextA.close();
  await contextB.close();
});
