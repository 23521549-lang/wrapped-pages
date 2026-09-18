import { expect, test } from "@playwright/test";
import { PASSWORD_SHAPE } from "@/server/identity/password";
import { WORDS } from "@/server/identity/words";
import { resetDb } from "./db";
import { dangNhap, taoCho } from "./ho-tro";

const WORD_SET = new Set<string>(WORDS);

test.beforeEach(async () => {
  await resetDb();
});

test("nghi thuc hai chieu: khoi tao, cho, dang nhap, tu choi tu-vao", async ({ browser }) => {
  // Moi nguoi mot browser.newContext() rieng: mot dau thiet bi rieng (deviceId cookie rieng).
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  let matKhau1 = "";
  let matKhau2 = "";

  await test.step("Buoc 1: A mo web trong, bi day toi /khoi-tao, tao cho 1", async () => {
    await pageA.goto("/");
    await expect(pageA).toHaveURL(/\/khoi-tao$/);

    matKhau1 = await taoCho(pageA, "Nguoi la mo dau", "mot loi nhan bi mat cho nguoi kia");

    expect(matKhau1).toMatch(PASSWORD_SHAPE);
    const parts = matKhau1.split("-");
    for (const w of parts.slice(0, 3)) expect(WORD_SET.has(w)).toBe(true);
    expect(parts[3]).toMatch(/^\d{2}$/);
  });

  await test.step("Buoc 2: A quay lai / thi bi day toi /cho", async () => {
    await pageA.goto("/");
    await expect(pageA).toHaveURL(/\/cho$/);
  });

  await test.step("Buoc 3: A thu mat khau cho 1 tren chinh may minh thi bi tu choi", async () => {
    await pageA.goto("/dang-nhap");
    await dangNhap(pageA, matKhau1);
    await expect(pageA.getByText(/bạn không vào được/)).toBeVisible();
  });

  await test.step("Buoc 4: nguoi la C mo /khoi-tao thi bi day ve /dang-nhap", async () => {
    await pageC.goto("/khoi-tao");
    await expect(pageC).toHaveURL(/\/dang-nhap$/);
  });

  await test.step("Buoc 5: B dang nhap bang mat khau cho 1, tao cho 2 cho A", async () => {
    await pageB.goto("/dang-nhap");
    await dangNhap(pageB, matKhau1);
    await expect(pageB).toHaveURL(/\/khoi-tao$/);

    matKhau2 = await taoCho(pageB, "Nguoi dap le", "loi nhan thu hai cho nguoi mo dau");

    await expect(pageB.getByText("Giờ cả hai đã có tài khoản.")).toBeVisible();
  });

  await test.step("Buoc 6: A dang nhap bang mat khau cho 2 thi toi /ke-sach", async () => {
    await pageA.goto("/dang-nhap");
    await dangNhap(pageA, matKhau2);
    await expect(pageA).toHaveURL(/\/ke-sach$/);
  });

  await test.step("Buoc 7: du hai cho, C van bi day ve /dang-nhap, B da vao thi toi /ke-sach", async () => {
    await pageC.goto("/khoi-tao");
    await expect(pageC).toHaveURL(/\/dang-nhap$/);

    await pageB.goto("/khoi-tao");
    await expect(pageB).toHaveURL(/\/ke-sach$/);
  });

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
