import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn. ";

/**
 * So to sau khi bo xep trang on dinh. Dem ngay sau khi go xong co the roi vao luc bo xep trang con dang dung
 * them to, nen doi phong chu nap xong (phong nap tre lam xep lai), roi doc so to, so dau ngat trang va
 * dau man viet CUNG MOT LUOT trong mot page.evaluate (doc cac gia tri lien quan trong cung mot
 * khung hinh) - doc rieng tung gia tri bang cac lenh locator tach biet co the roi vao hai ban ve khac nhau
 * cua bo xep trang duoi tai may (soToOnDinh tung tra 3 to trong khi .ngat-trang da len 4 to).
 * Lap toi khi so dau ngat dung bang so to tru mot, dau man viet khop so to, va da co it nhat hai to.
 */
async function soToOnDinh(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let soTo = 0;
  await expect(async () => {
    const { sheets, breaks, header } = await page.evaluate(() => ({
      sheets: document.querySelectorAll(".viet-to").length,
      breaks: document.querySelectorAll(".ngat-trang").length,
      header: document.querySelector(".viet-dau")?.textContent ?? "",
    }));
    expect(sheets).toBeGreaterThanOrEqual(2);
    expect(breaks).toBe(sheets - 1);
    expect(header).toContain(`${sheets} trang`);
    soTo = sheets;
  }).toPass({ timeout: 15_000 });
  return soTo;
}

test("viet qua mot to thi chu tran sang to sau, dung o dinh vung chu", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }

  const tos = a.locator(".viet-to");
  const soTo = await soToOnDinh(a);

  const ngat = a.locator(".ngat-trang");
  await expect(ngat).toHaveCount(soTo - 1);
  for (let i = 0; i < soTo - 1; i++) {
    const kd = (await ngat.nth(i).boundingBox())!;
    const to = (await tos.nth(i + 1).boundingBox())!;
    const k = to.width / 360;
    // Day khoi dem = dinh vung chu cua to sau (dinh to + padding tren 36px, da thu phong).
    expect(Math.abs(kd.y + kd.height - (to.y + 36 * k))).toBeLessThan(2);
  }
});

/**
 * Rao view.composing: doi decoration ngat trang giua luc bo go dang ghep chu (Telex dung dau) se lam hong
 * chu dang go. Phat that su hai su kien CompositionEvent tren DOM cua ProseMirror - day la cach
 * prosemirror-view tu dat/xoa co view.composing (khong phu thuoc IME that cua he dieu hanh), nen day la
 * phep thu trung dich, khong phai gia lap suong.
 */
test("dang ghep chu thi hoan xep trang lai; xep xong luc bo go ket thuc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  const editor = a.locator(".viet-chu .ProseMirror");
  await editor.click();

  const ngat = a.locator(".ngat-trang");
  await expect(ngat).toHaveCount(0);

  await editor.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));

  // Du chu de tran qua nhieu to neu xep trang chay ngay - dung de kiem tra viec do co bi hoan lai hay khong.
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }

  // Van dang "ghep chu": du da qua rat lau so voi CHO_MS (120ms) cua usePagedLayout, xep trang van chua chay.
  await a.waitForTimeout(400);
  await expect(ngat).toHaveCount(0);
  await expect(a.locator(".viet-dau")).toContainText("1 trang");

  await editor.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));

  const soTo = await soToOnDinh(a);
  await expect(ngat).toHaveCount(soTo - 1);
});
