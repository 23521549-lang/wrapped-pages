import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { docSach, dongContextCu, haiNguoiDaVao, taiLaiSach, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, gioSau, khongLo, niemPhongCua } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const LOI_NHAN = "Đoán mãi không ra thì thôi, em mở cho anh.";

test("cau do: nguoi kia tra loi sai thay so lan con lai; chu sach thay nhat ky go cua va tang chia khoa", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: ["Trên trời có"] });

  await docSach(b, id);
  const cauDo = b.getByRole("region", { name: "Câu đố", exact: true });
  await expect(cauDo.locator(".thu-thach__dau .meta")).toHaveText(`${tenCuaA} đóng trang 1 bằng một câu đố.`);
  expect((await cauDo.boundingBox())?.width).toBeLessThanOrEqual(640);
  await expect(cauDo.locator(".cau-hoi__chu")).toHaveText("Quán tên gì?");
  await expect(cauDo.locator(".con-lan")).toHaveText("Còn 5 lần");
  await cauDo.getByLabel("Câu trả lời").fill("quán cà phê");
  await cauDo.getByRole("button", { name: "Mở trang" }).click();
  await expect(cauDo.locator(".con-lan")).toHaveText("Chưa đúng. Còn 4 lần");
  await expect(cauDo.getByRole("status")).toHaveText("Chưa đúng. Còn 4 lần");
  await expect(cauDo.locator(".goi-y")).toHaveCount(0);
  // Du lieu lam moi sau action di qua fetch, khong nam trong page.content(): tai lai de soi ban may chu ve that.
  await taiLaiSach(b);
  await expect(cauDo.locator(".con-lan")).toHaveText("Còn 4 lần");
  // Nguoi kia: khong dap an (ca ban goc lan ban chuan hoa), khong chu that, khong goi y chua mo, khong nhat ky.
  await khongLo(b, "Quán Mây", "quan may", BI_MAT, "Trên trời có");
  await expect(b.getByRole("list", { name: "Nhật ký gõ cửa" })).toHaveCount(0);
  await expect(b.getByText("Nhật ký gõ cửa")).toHaveCount(0);
  expect(await tranNgang(b)).toEqual([]);
  await b.setViewportSize({ width: 320, height: 720 });
  await expect(cauDo.getByLabel("Câu trả lời")).toBeVisible();
  expect(await tranNgang(b)).toEqual([]);

  await taiLaiSach(a);
  const cuaToi = a.getByRole("region", { name: "Câu đố của bạn" });
  await expect(cuaToi.locator(".thu-thach__dau .meta")).toHaveText(`Trang 1 · 1 đáp án · 1 gợi ý · ${tenCuaB} chưa mở được`);
  const nhatKy = cuaToi.getByRole("list", { name: "Nhật ký gõ cửa" });
  await expect(nhatKy.getByRole("listitem")).toHaveCount(1);
  await expect(nhatKy).toContainText("“quán cà phê”");
  await expect(nhatKy).toContainText(`${tenCuaB} · hôm nay,`);
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  await cuaToi.getByLabel(`Lời nhắn cho ${tenCuaB}`).fill(LOI_NHAN);
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  await expect(a.getByRole("region", { name: "Câu đố của bạn" }).locator(".thu-thach__dau .meta")).toContainText(`${tenCuaB} đã mở, hôm nay,`);
  await expect(a.getByRole("button", { name: "Tặng chìa khóa" })).toHaveCount(0);

  await taiLaiSach(b);
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.getByRole("region", { name: "Câu đố", exact: true })).toHaveCount(0);
  await expect(b.getByRole("region", { name: "Được tặng chìa khóa" }).locator(".loi-nhan__chu")).toHaveText(LOI_NHAN);
});

test("hen gio: ca hai thay dong ho, khong co nut tang chia khoa, 3000 ngay van vua 320px; trao doi: nguoi kia co loi viet tra loi", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const hen = await taoSach(a, "Thư gửi năm ba mươi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "hen-gio", opensAt: await gioSau(a, 3000 * 86_400_000) });
  const khungA = a.getByRole("region", { name: "Hẹn giờ" });
  await expect(khungA.getByRole("timer")).toBeVisible();
  await expect(khungA.locator(".dem-nguoc__so").first()).toHaveText(/^[0-9]{4}$/);
  await expect(khungA.locator(".con-lan")).toHaveText(/^Mở lúc [0-9]{2}:[0-9]{2}, /);
  await expect(khungA).toContainText("Chính bạn cũng không mở sớm được.");
  await expect(a.getByRole("button", { name: "Tặng chìa khóa" })).toHaveCount(0);

  // Truong hop rong nhat: so ngay 4 chu so o man 320px. Bon o tren mot hang, chu so khong tran ra khoi o cua no
  // (tranNgang chi bat phan tu vuot mep man hinh, khong bat chu so de len o ben canh).
  await a.setViewportSize({ width: 320, height: 720 });
  const oDem = khungA.locator(".dem-nguoc__o");
  await expect(oDem).toHaveCount(4);
  const hinh = await oDem.evaluateAll((ds) =>
    ds.map((o) => {
      const khung = o.getBoundingClientRect();
      const so = o.querySelector(".dem-nguoc__so")?.getBoundingClientRect() ?? khung;
      return { top: Math.round(khung.top), tran: so.left < khung.left - 0.5 || so.right > khung.right + 0.5 };
    }),
  );
  expect(new Set(hinh.map((h) => h.top)).size).toBe(1);
  expect(hinh.filter((h) => h.tran)).toEqual([]);
  expect(await tranNgang(a)).toEqual([]);

  await docSach(b, hen);
  await expect(b.getByRole("region", { name: "Hẹn giờ" }).locator(".thu-thach__dau .meta")).toHaveText(`${tenCuaA} hẹn ngày mở cho trang 1.`);

  const doi = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  await docSach(b, doi);
  const traoDoi = b.getByRole("region", { name: "Trao đổi", exact: true });
  await expect(traoDoi.locator(".cau-hoi__chu")).toHaveText("Hôm đó em nghĩ gì?");
  const [s] = await niemPhongCua(doi);
  await expect(traoDoi.getByRole("link", { name: "Viết trang trả lời" })).toHaveAttribute("href", `/sach/${doi}/tra-loi/${s.id}`);
});
