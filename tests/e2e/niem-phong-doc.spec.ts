import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, gioSau, khongLo } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";

test("nguoi kia chi thay dong he lo va vach nhoe, chu that khong co trong trang; chu sach doc duoc va thay dau", async ({ browser }) => {
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], {
    kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: ["Trên trời có"],
  });

  await expect(a.locator(".sach")).toContainText(BI_MAT);
  await expect(a.locator(".sach .dau-niem")).toHaveText("Đang niêm phong bằng câu đố");
  await expect(a.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 1 trang · ${tenCuaB} đọc được`);

  await b.goto(`/sach/${id}`);
  await expect(b.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 1 trang · 1 trang đang khóa`);
  await expect(b.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await expect(b.locator(".sach .giay-noi-dung p").first()).toHaveText(HE_LO);
  await expect(b.locator(".sach .nhoe__dong").first()).toBeVisible();
  expect(await b.content()).toContain(HE_LO);
  await khongLo(b, BI_MAT, "quan may", "Quán Mây", "Trên trời có");
  expect(await tranNgang(b)).toEqual([]);

  await b.setViewportSize({ width: 320, height: 720 });
  await expect(b.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  expect(await tranNgang(b)).toEqual([]);
});

test("hen gio khoa ca chu sach, ke ca tren sach rieng tu", async ({ browser }) => {
  const { a, tenCuaA } = await haiNguoiDaVao(browser);
  await taoSach(a, "Thư gửi năm ba mươi", "rieng-tu");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "hen-gio", opensAt: await gioSau(a, 86_400_000) });
  await expect(a.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 1 trang · Chỉ mình bạn đọc · 1 trang đang khóa`);
  await expect(a.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  // dangKemNiemPhong ket thuc bang chuyen trang phia trinh duyet: tai lai de soi ban may chu ve that (ca RSC payload).
  await a.reload();
  await expect(a.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await khongLo(a, BI_MAT);
});
