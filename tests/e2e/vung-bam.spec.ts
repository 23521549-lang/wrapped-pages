import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangNhap, taoCho } from "./ho-tro";
import { batMayHong, GOC_MAY_HONG } from "./may-hong";
import { CHO_ARGON2_MS, dangToThang, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, niemPhongCua } from "./niem-phong";
import { BE_RONG, BE_RONG_CHAM, doMan, doMoiManChinh, vungBamNho, type Man, type MienTru } from "./vung-bam";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/**
 * Cong dung chung cho vung bam 44px o be rong cam ung va khong tran ngang o bon
 * be rong tren moi man cua web. Bon man chinh (ke sach, man doc, man viet, cai dat)
 * di qua doMoiManChinh; cac man con lai di qua doMan: tao sach, sua sach, ban nhap, cho, trang 404, trang
 * tra loi, dang nhap (context moi, chua co phien), o test rieng tren web trong: khoi tao va man da xong o ca
 * hai luot, va o test rieng tren may chu co database khong toi duoc (may-hong.ts): trang loi. /viet khong co man rieng: no chi chuyen huong. Mot cuon co it nhat mot trang da dang
 * (dangToThang) de the "Trang gan nhat" xuat hien tren ke sach - khong co no thi doMoiManChinh khong
 * tim duoc duong toi man doc/man viet, va mot cong chay tren ke rong la mot cong luon xanh.
 *
 * Cac lan goi tranNgang rai rac trong nhung spec khac (doc-sach, viet-tran-trang, cai-dat, ...) van
 * giu nguyen: chung kiem nhung trang thai rieng ma buoc chung o day khong dung duoc (hop thoai dang
 * mo, dang cat anh, dang co loi) - bo chung di la lam mong phu, khong phai don dep.
 */

/**
 * Mien tru vung bam (moi mien tru co ten va ly do). Moi mien tru van do: phan tu duoc thay
 * bang vung bam that cua no, va vung do phai du 44px.
 *
 * Cuon sach tren ke khong can mien tru: ca cuon (bia, ten, dong phu, dau hieu) nam trong chinh lien ket
 * `.cuon__lien` (ShelfBook.tsx), nen hop cua <a> la vung bam that va duoc do thang.
 * - .the-chon input: nut radio 20px trong the chon (BookForm.tsx "Ai doc duoc", SealPicker.tsx). Radio
 *   nam TRONG `<label class="the-chon">`, nen bam bat ky dau tren nhan cung chon radio (kich hoat nhan
 *   goc cua HTML; `.the-chon{ cursor: pointer; padding: var(--space-md) }` ve ca nhan thanh mot the bam).
 */
const MIEN_TRU_VUNG_BAM: MienTru[] = [
  { phanTu: ".the-chon input", vungBam: "label.the-chon" },
];

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const DA_LUU = new RegExp("^Đã lưu lúc [0-9]{2}:[0-9]{2}$");

const tenSach = (p: Page) => expect(p.getByLabel("Tên sách")).toBeVisible();

test("vung bam 44px o be rong cam ung, va khong tran ngang o ca bon be rong, tren moi man cua nguoi da vao va man dang nhap", async ({ browser }) => {
  test.setTimeout(480_000);
  const { a, b } = await haiNguoiDaVao(browser);

  // Cuon co trang da dang cho doMoiManChinh, va mot ban nhap de /ban-nhap co mot muc that thay vi man trong.
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Chiều nay anh đi ngang hiệu sách cũ ở góc phố.");
  await expect(a.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });

  // Cuon thu hai co mot niem phong trao doi, de nguoi kia co trang tra loi.
  const idThu = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  const [s] = await niemPhongCua(idThu);

  await a.setViewportSize({ width: BE_RONG_CHAM, height: 900 });
  await doMoiManChinh(a, (p) => vungBamNho(p, MIEN_TRU_VUNG_BAM));
  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    await doMoiManChinh(a, (p) => tranNgang(p));
  }

  const manCuaA: Man[] = [
    { ten: "tao sach", duong: "/sach/moi", daVe: tenSach },
    { ten: "sua sach", duong: `/sach/${id}/sua`, daVe: tenSach },
    {
      ten: "ban nhap",
      duong: "/ban-nhap",
      daVe: (p) => expect(p.getByRole("listitem").filter({ hasText: "Chuyện chưa kể" })).toBeVisible(),
    },
    { ten: "cho", duong: "/cho", daVe: (p) => expect(p.getByRole("heading", { level: 1, name: "Đang chờ" })).toBeVisible() },
    {
      ten: "trang 404",
      duong: "/khong-co-trang-nay",
      daVe: (p) => expect(p.getByRole("heading", { level: 1, name: "Không thấy trang này" })).toBeVisible(),
    },
  ];
  for (const man of manCuaA) await doMan(a, man, MIEN_TRU_VUNG_BAM);

  await doMan(b, {
    ten: "trang tra loi",
    duong: `/sach/${idThu}/tra-loi/${s.id}`,
    daVe: async (p) => {
      await expect(p.getByRole("heading", { level: 1, name: "Trang trả lời" })).toBeVisible();
      await expect(p.locator(".viet-chu .ProseMirror")).toBeVisible();
    },
  }, MIEN_TRU_VUNG_BAM);

  // Context moi, chua co phien: nguoi da vao mo /dang-nhap se bi day ve ke sach.
  const khach = await (await browser.newContext()).newPage();
  try {
    await doMan(khach, {
      ten: "dang nhap",
      duong: "/dang-nhap",
      daVe: (p) => expect(p.getByLabel("Mật khẩu người kia gửi cho bạn")).toBeVisible(),
    }, MIEN_TRU_VUNG_BAM);
  } finally {
    await khach.context().close();
  }
});

test("vung bam 44px va khong tran ngang tren khoi tao va man da xong, o ca luot mo dau va luot dap le", async ({ browser }) => {
  // Hai man nay chi mo duoc tren web con thieu tai khoan, nen di tren database vua xoa, khong qua haiNguoiDaVao.
  test.setTimeout(240_000);
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  try {
    const a = await ca.newPage();
    const b = await cb.newPage();
    const khoiTao = (p: Page) => expect(p.getByLabel("Biệt danh bạn đặt cho người kia")).toBeVisible();
    const daXong = (p: Page) => expect(p.getByTestId("mat-khau")).toBeVisible();

    await a.goto("/");
    await expect(a).toHaveURL(new RegExp("/khoi-tao$"));
    await doMan(a, { ten: "khoi tao, luot mo dau", duong: "/khoi-tao", daVe: khoiTao }, MIEN_TRU_VUNG_BAM);
    const matKhauCuaB = await taoCho(a, "Linh", "gui nguoi thu hai");
    await expect(a).toHaveURL(new RegExp("/khoi-tao/xong$"), { timeout: CHO_ARGON2_MS });
    await doMan(a, { ten: "da xong, luot mo dau", duong: "/khoi-tao/xong", daVe: daXong }, MIEN_TRU_VUNG_BAM);

    await b.goto("/dang-nhap");
    await dangNhap(b, matKhauCuaB.trim());
    await expect(b).toHaveURL(new RegExp("/khoi-tao$"), { timeout: CHO_ARGON2_MS });
    await doMan(b, { ten: "khoi tao, luot dap le", duong: "/khoi-tao", daVe: khoiTao }, MIEN_TRU_VUNG_BAM);
    await taoCho(b, "Mạnh", "gui nguoi mo dau");
    await expect(b.getByText("Giờ cả hai đã có tài khoản.")).toBeVisible({ timeout: CHO_ARGON2_MS });
    await doMan(b, {
      ten: "da xong, luot dap le",
      duong: "/khoi-tao/xong",
      daVe: (p) => expect(p.getByRole("link", { name: "Vào kệ sách" })).toBeVisible(),
    }, MIEN_TRU_VUNG_BAM);
  } finally {
    await ca.close();
    await cb.close();
  }
});

test("vung bam 44px va khong tran ngang tren trang loi (database khong toi duoc)", async ({ page }) => {
  test.setTimeout(120_000);
  const may = await batMayHong();
  try {
    await doMan(page, {
      ten: "trang loi",
      duong: `${GOC_MAY_HONG}/`,
      daVe: (p) => expect(p.getByRole("button", { name: "Thử lại" })).toBeVisible(),
    }, MIEN_TRU_VUNG_BAM);
  } finally {
    await may.dung();
  }
});
