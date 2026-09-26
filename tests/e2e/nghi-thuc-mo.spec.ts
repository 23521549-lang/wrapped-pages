import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { docSach, dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { conTroKhi, dangKemNiemPhong, khongLo, niemPhongCua } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
/** Doan dai de to dau khoang 300 ky tu: nghi thuc go chung 5,4 giay o nhip 18ms, du de kiem trong luc dang go. */
const DAI = "Mình ngồi tới lúc quán tắt đèn. Anh kể chuyện hồi nhỏ trốn học đi câu cá, em kể chuyện con mèo nhà bà ngoại. Toàn chuyện chẳng đâu vào đâu. Lúc về, anh đi trước em nửa bước, cứ quay lại nhìn như sợ em lạc.";
const LOI_NHAN = "Đoán mãi không ra thì thôi, em mở cho anh.";
const CAU_DO = { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] } as const;

test("tu tra loi dung: aria-busy khi go, khung Da mo trang, con tro nhap nhay them mot chu ky, focus ve sach; giam chuyen dong cung tin hieu do", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);

  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], CAU_DO);
  const [s] = await niemPhongCua(id);
  await docSach(b, id);
  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await khung.getByLabel("Câu trả lời").fill("quán mây");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  await expect(b.locator(".doc__khung")).toBeVisible();
  await expect(b.locator(".sach .con-tro")).toHaveCount(1);
  await expect(b.locator('.sach .giay-noi-dung[aria-busy="true"]')).toHaveCount(1);
  await expect(b.getByRole("region", { name: "Đã mở trang" }))
    .toContainText(`Bạn trả lời đúng. Trang 1 vừa mở, ${tenCuaA} sẽ thấy trong nhật ký gõ cửa.`);
  // Ca trang da nam trong DOM trong luc go (phan chua go chi bi an tai cho).
  await expect(b.locator(".sach")).toContainText(BI_MAT);

  // Bat dung khung hinh go xong: con tro con nhap nhay them mot chu ky --dur-nhay (1 giay), aria-busy da bo.
  // Doc con tro va aria-busy ngay trong khung hinh go xong, phia trang: do tre giua hai lenh cua tien trinh test
  // duoi tai co the qua mot chu ky --dur-nhay, nen dem o lenh rieng thi chap chon.
  const lucGoXong = await b.waitForFunction(
    () =>
      document.querySelector(".sach .chua-go") === null && {
        conTro: document.querySelectorAll(".sach .con-tro").length,
        dangBan: document.querySelectorAll('.sach .giay-noi-dung[aria-busy="true"]').length,
      },
    undefined,
    { polling: "raf", timeout: 20_000 },
  );
  expect(await lucGoXong.jsonValue(), "go xong: con tro con them mot chu ky, het aria-busy").toEqual({ conTro: 1, dangBan: 0 });
  await expect(b.locator(".sach .con-tro")).toHaveCount(0);
  await expect(b.locator(".doc__khung")).toBeFocused();

  // Giam chuyen dong: khong go, khong con tro, van co khung Da mo trang va focus ve sach.
  const id2 = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], CAU_DO);
  const [s2] = await niemPhongCua(id2);
  await b.emulateMedia({ reducedMotion: "reduce" });
  await docSach(b, id2);
  const khung2 = b.getByRole("region", { name: "Câu đố", exact: true });
  await khung2.getByLabel("Câu trả lời").fill("quán mây");
  await khung2.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id2}[?]trang=1&mo=${s2.id}$`));
  expect(await conTroKhi(b, "khung-hien"), "giam chuyen dong thi khong con tro").toBe(0);
  await expect(b.locator(".sach .chua-go")).toHaveCount(0);
  await expect(b.getByRole("region", { name: "Đã mở trang" })).toBeVisible();
  await expect(b.locator(".doc__khung")).toBeFocused();
  await expect(b.locator(".sach")).toContainText(DAI);
});

test("mo= gia tren niem phong duoc tang chia khoa: khong nghi thuc, khong khung Da mo trang, khong ghi khoa nghi thuc", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], CAU_DO);
  const [s] = await niemPhongCua(id);
  await docSach(b, id);
  await khongLo(b, BI_MAT, DAI);

  const cuaToi = a.getByRole("region", { name: "Câu đố của bạn" });
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  await cuaToi.getByLabel(`Lời nhắn cho ${tenCuaB}`).fill(LOI_NHAN);
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  await expect(a.getByRole("region", { name: "Câu đố của bạn" }).locator(".thu-thach__dau .meta")).toContainText(`${tenCuaB} đã mở`);

  // Nguoi kia tu them mo vao URL: trang da mo that nhung khong phai do ho tu mo, nen may chu tra ritual false.
  await b.goto(`/sach/${id}?trang=1&mo=${s.id}`);
  expect(await conTroKhi(b, "khung-hien"), "khong co nghi thuc").toBe(0);
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.getByRole("region", { name: "Được tặng chìa khóa" }).locator(".loi-nhan__chu")).toHaveText(LOI_NHAN);
  await expect(b.getByRole("region", { name: "Đã mở trang" })).toHaveCount(0);
  expect(await b.evaluate((khoa) => sessionStorage.getItem(khoa), `mqce:nghi-thuc:${s.id}`), "khong ghi khoa nghi thuc").toBeNull();
});
