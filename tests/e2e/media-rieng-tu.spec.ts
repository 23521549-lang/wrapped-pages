import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangTrang, dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { dangKemNiemPhong, gioSau, luiGioMo, niemPhongCua } from "./niem-phong";
import { maTaiMedia, themAnh } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";

test("route /m: sach rieng tu va media chi nam trong nhap deu la 404 voi nguoi kia", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);

  const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  const anhRieng = await themAnh(a, 400, 300);
  expect(await dangTrang(a)).toBe(1);
  await expect(a.locator(`.sach img[src="/m/${anhRieng}"]`)).toBeVisible();
  expect(await maTaiMedia(a, anhRieng), "chu sach van tai duoc").toBe(200);
  expect(await maTaiMedia(b, anhRieng), "sach rieng tu giong het khong ton tai").toBe(404);
  expect((await b.goto(`/sach/${rieng}`))?.status()).toBe(404);

  await taoSach(a, "Những bữa sáng", "chia-se");
  const anhNhap = await themAnh(a, 400, 300);
  await expect(a.getByText(new RegExp("^Đã lưu lúc "))).toBeVisible({ timeout: 15_000 });
  expect(await maTaiMedia(a, anhNhap), "chu sach xem duoc media trong nhap cua minh").toBe(200);
  expect(await maTaiMedia(b, anhNhap), "media chi nam trong nhap thi nguoi kia khong thay").toBe(404);
});

test("route /m: to cau do mo ra sau khi tra loi dung, to hen gio khoa ca chu sach truoc gio mo", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);

  const chung = await taoSach(a, "Những bữa sáng", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(HE_LO);
  const anhKhoa = await themAnh(a, 400, 300);
  // Chu da go va chen anh san, nen dangKemNiemPhong chi lo phan niem phong va dang.
  await dangKemNiemPhong(a, [], { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] });
  expect(await maTaiMedia(b, anhKhoa), "to cau do chua mo").toBe(404);
  expect(await maTaiMedia(a, anhKhoa), "cau do khong khoa chu sach").toBe(200);

  const [cauDo] = await niemPhongCua(chung);
  await b.goto(`/sach/${chung}`);
  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await khung.getByLabel("Câu trả lời").fill("quán mây");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${chung}[?]trang=1&mo=${cauDo.id}$`));
  expect(await maTaiMedia(b, anhKhoa), "tra loi dung thi tai duoc").toBe(200);

  const hen = await taoSach(a, "Thư gửi năm ba mươi", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(HE_LO);
  const anhHen = await themAnh(a, 400, 300);
  await dangKemNiemPhong(a, [], { kind: "hen-gio", opensAt: await gioSau(a, 86_400_000) });
  expect(await maTaiMedia(a, anhHen), "hen gio khoa ca nguoi viet").toBe(404);
  expect(await maTaiMedia(b, anhHen)).toBe(404);

  const [henGio] = await niemPhongCua(hen);
  await luiGioMo(henGio.id);
  expect(await maTaiMedia(a, anhHen), "toi gio thi chu sach tai duoc").toBe(200);
  expect(await maTaiMedia(b, anhHen), "sach rieng tu van kin voi nguoi kia").toBe(404);
});
