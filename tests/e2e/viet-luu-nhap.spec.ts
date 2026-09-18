import { test, expect } from "@playwright/test";
import { DOC_LIMITS } from "@/lib/doc/validate";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, nhapCua, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("go chu, 3 giay sau tu luu, tai lai trang van con nguyen", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  await a.keyboard.insertText("Em tới sớm hơn giờ hẹn bốn mươi phút.");
  await expect(a.getByText(/^Đã lưu lúc \d{2}:\d{2}$/)).toBeVisible({ timeout: 10_000 });
  await a.reload();
  await expect(giay).toContainText("Em tới sớm hơn giờ hẹn bốn mươi phút.");
});

test("go roi roi man viet ngay bang lien ket, chua toi 3 giay, chu van duoc luu", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Câu cuối cùng trước khi rời đi.");
  // Lan luu duy nhat la lan luu not luc Editor go ra khoi trang (chua toi 3 giay).
  const daLuu = a.waitForResponse((r) => r.request().method() === "POST" && "next-action" in r.request().headers());
  await a.getByRole("link", { name: "Về sách" }).click();
  await daLuu;
  await a.goto(`/sach/${id}/viet`);
  await expect(a.locator(".viet-chu .ProseMirror")).toContainText("Câu cuối cùng trước khi rời đi.");
});

test("nguoi kia mo man viet cua sach chia se thi nhan 404", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const res = await b.goto(`/sach/${id}/viet`);
  expect(res?.status()).toBe(404);
});

/**
 * Tai lieu ma TipTap co the tao ra (mot doan chu binh thuong) nhung cleanDoc PHAI tu choi: vuot tran
 * DOC_LIMITS.maxChars. Di qua giao dien that (khong goi actionSaveDraft truc tiep, khong mock) de
 * chung minh actionSaveDraft thuc su goi cleanDoc, dung chieu phep kiem (!clean), va tu choi TRUOC
 * khi cham database - chu khong chi giao dien bao loi suong.
 */
test("noi dung vuot tran 20 000 ky tu bi tu choi, database khong bi cham", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  const quaTran = "a".repeat(DOC_LIMITS.maxChars + 1);
  // Ban nhap luu gan nhat TRUOC khi vuot tran (null vi chua go gi ca): doi chieu voi sau khi vuot tran.
  const truoc = await nhapCua(id);
  // Lan tu luu 3 giay sau van gui ban nhap vuot tran len may chu: chi doi response de dong bo thoi diem, KHONG
  // doc than response - CDP getResponseBody khong dang tin cho response gzip cua RSC Server Action (da chan
  // doan: replay dung request qua APIRequestContext giai ma dung, chi rieng page.waitForResponse().text() sai).
  const daGui = a.waitForResponse((r) => r.request().method() === "POST" && "next-action" in r.request().headers());
  await a.keyboard.insertText(quaTran);
  // Canh bao cua bo dem chiem cho trang thai luu, noi ro vi sao nhap khong luu duoc.
  await expect(a.locator(".viet-dau [aria-live]")).toContainText("Vượt 20 000 ký tự, nháp không lưu được");
  await daGui;
  // Bao dam that su cua test (kiem qua database thay vi doc phan hoi): actionSaveDraft tu choi
  // TRUOC khi cham database, nen ban nhap luu gan nhat khong doi so voi truoc lan gui vuot tran nay.
  expect(await nhapCua(id)).toEqual(truoc);
  await expect(a.getByText(/^Đã lưu lúc/)).toHaveCount(0);
  // Tai lai: neu database thuc su bi cham, trang se con noi dung vuot tran do. Phai la trang trong.
  await a.reload();
  await expect(a.locator(".viet-chu .ProseMirror")).not.toContainText("a".repeat(50));
});
