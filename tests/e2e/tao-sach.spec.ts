import { test, expect } from "@playwright/test";
import { COVER_LABEL } from "@/components/book/CoverArt";
import { COVERS } from "@/lib/book";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, nhacCua, taoSach, tranNgang } from "./kho-sach";
import { giaYoutube } from "./youtube-gia";

/** Ma video mau, dung cho o Nhac nen cua form tao sach. */
const MA = "5qap5aO4i9A";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("tao sach qua giao dien: the xem truoc doi theo form, xong thi toi man viet", async ({ browser }) => {
  const { a, tenCuaB } = await haiNguoiDaVao(browser);
  await a.getByRole("link", { name: "Tạo sách" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));

  const xemTruoc = a.getByRole("complementary", { name: "Xem trước trên kệ" });
  await a.getByLabel("Tên sách").fill("Chuyện chưa kể");
  await expect(xemTruoc).toContainText("Chuyện chưa kể");
  await expect(xemTruoc).toContainText(`${tenCuaB} sẽ thấy cuốn này trên kệ.`);
  await a.getByRole("radio", { name: "Riêng tư", exact: true }).check();
  await expect(xemTruoc).toContainText(`${tenCuaB} không thấy cuốn này, kể cả tên.`);
  await expect(xemTruoc.locator(".chip", { hasText: "Riêng tư" })).toBeVisible();
  await a.getByRole("radio", { name: "Chia sẻ", exact: true }).check();
  await a.getByRole("radio", { name: "Bìa khóm trúc" }).check();
  await expect(xemTruoc.locator(".book__cover")).toHaveClass(new RegExp("bia--khom-truc"));

  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  await a.getByRole("button", { name: "Tạo sách" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
});

/*
 * O Nhac nen chi con tren form TAO sach: phan quyet B2 da bo no khoi man Sua sach, va bai nhac-nen-form.spec.ts lai
 * man do nen da bi xoa. Phan phu cua no doi sang /sach/moi o day, khong thieu cho nao: link sai bi chan, chip "Da nhan
 * video", link dung duoc luu, va de trong la cuon khong co nhac. Rieng phep "mo lai form, o nhac dien lai link ngan"
 * khong con man nao lam duoc (khong duong giao dien nao sua nhac sau khi tao, xem phan quyet B12), nen thay bang phep
 * manh hon cung y: may chu chi giu 11 ky tu ma video, khong giu ca duong link nguoi dung dan vao.
 */
test("o nhac nen luc tao sach: link sai bi chan, link dung luu ra ma video, de trong la cuon khong nhac", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  // Man doc cua cuon co nhac se tao trinh phat: API YouTube gia, khong goi mang that.
  await giaYoutube(a);
  await a.goto("/sach/moi");
  await a.getByLabel("Tên sách").fill("Chuyện chưa kể");
  const nhac = a.getByLabel("Nhạc nền");
  const taoNut = a.getByRole("button", { name: "Tạo sách" });
  await expect(nhac).toHaveValue("");
  await expect(a.getByText("Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.")).toBeVisible();

  // Link sai: bao loi luc roi o; bam Tao sach thi khong gui form, focus ve o nhac.
  await nhac.fill(`https://youtube.com.evil.test/watch?v=${MA}`);
  await nhac.blur();
  await expect(a.getByText("Link YouTube chưa đúng.")).toBeVisible();
  await expect(nhac).toHaveAttribute("aria-invalid", "true");
  await taoNut.click();
  await expect(nhac).toBeFocused();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));

  // Link dung: chip Da nhan video thay cho dong loi, va o man hep khong tran ngang.
  await nhac.fill(`https://www.youtube.com/watch?v=${MA}&t=42`);
  await expect(a.getByText("Đã nhận video")).toBeVisible();
  await expect(a.getByText("Link YouTube chưa đúng.")).toHaveCount(0);
  await expect(nhac).toHaveAttribute("aria-invalid", "false");
  await a.setViewportSize({ width: 375, height: 812 });
  expect(await tranNgang(a), "tran ngang o 375px").toEqual([]);
  await a.setViewportSize({ width: 1280, height: 900 });

  await taoNut.click();
  await expect(a).toHaveURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
  const coNhac = new URL(a.url()).pathname.split("/")[2];
  expect(await nhacCua(coNhac), "may chu chi giu ma video, khong giu ca duong link").toBe(MA);
  await a.goto(`/sach/${coNhac}`);
  await expect(a.getByRole("complementary", { name: "Nhạc nền" })).toBeVisible();

  // De trong o nhac (taoSach khong cham o do): cuon khong co o nhac nao, man doc khong co the nhac.
  const khongNhac = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  expect(await nhacCua(khongNhac)).toBeNull();
  await a.goto(`/sach/${khongNhac}`);
  await expect(a.locator(".nhac-the")).toHaveCount(0);
});

test("ten trong thi bao loi ngay o o ten va khong gui form", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/sach/moi");
  await a.getByRole("button", { name: "Tạo sách" }).click();
  await expect(a.getByText("Sách cần có tên. Viết vài chữ, đổi lại sau cũng được.")).toBeVisible();
  await expect(a.getByLabel("Tên sách")).toHaveAttribute("aria-invalid", "true");
  await expect(a.getByLabel("Tên sách")).toBeFocused();
  await expect(a).toHaveURL(new RegExp("/sach/moi$"));
});

test("sach rieng tu chi chu thay; chi chu sua duoc; Trang moi mo cuon vua sua", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const chung = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");

  await a.goto("/ke-sach");
  await expect(a.locator(".ke-dau__phu")).toHaveText("2 cuốn");
  await expect(a.locator(".cuon", { hasText: "Cuốn không đặt tên" }).locator(".dh--rieng")).toHaveText("Riêng tư");
  await expect(a.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".cuon__phu")).toContainText("Chưa có trang");
  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  await b.goto("/ke-sach");
  await expect(b.locator(".ke-dau__phu")).toHaveText("1 cuốn");
  await expect(b.getByRole("region", { name: `Kệ của ${tenCuaA}` })).toContainText("Chuyện chưa kể");
  await expect(b.locator("main")).not.toContainText("Cuốn không đặt tên");
  expect((await b.goto(`/sach/${chung}/sua`))?.status()).toBe(404);
  expect((await b.goto(`/sach/${rieng}/sua`))?.status()).toBe(404);

  await a.goto(`/sach/${chung}/sua`);
  await expect(a.getByLabel("Tên sách")).toHaveValue("Chuyện chưa kể");
  await expect(a.getByRole("radio", { name: "Chia sẻ", exact: true })).toBeChecked();
  await a.getByLabel("Tên sách").fill("Mưa đầu tháng chín");
  await a.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${chung}$`));

  await b.goto("/ke-sach");
  await expect(b.getByRole("region", { name: `Kệ của ${tenCuaA}` })).toContainText("Mưa đầu tháng chín");

  // Chua co ban nhap nao, nen /viet chon cuon co hoat dong gan nhat: cuon vua sua.
  await a.goto("/viet");
  await expect(a).toHaveURL(new RegExp(`/sach/${chung}/viet$`));
});

/*
 * Phan quyet B2 cua dot 24.09: "o bia va o nhac ROI KHOI phan tren cua Sua sach, chuyen han xuong hai muc danh sach.
 * Ly do: giu ca hai la hai duong ghi cho cung mot gia tri." Vi vay bai nay khong con nua doi bia o man Sua sach; tam
 * bia chon luc tao phai theo cuon qua ke, man doc va sau khi tai lai trang.
 */
test("bia moi: chon khi tao, giu sau khi tai lai, ve tren ke; ca muoi o bia deu chon duoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/sach/moi");
  await a.getByLabel("Tên sách").fill("Mái nhà cũ");
  await a.getByRole("radio", { name: "Chia sẻ", exact: true }).check();
  await a.getByRole("radio", { name: "Bìa cầu gỗ qua suối" }).check();
  await a.getByRole("button", { name: "Tạo sách" }).click();
  await expect(a).toHaveURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
  const id = new URL(a.url()).pathname.split("/")[2];

  await a.goto("/ke-sach");
  const cuon = a.locator(".cuon", { hasText: "Mái nhà cũ" });
  await expect(cuon.locator(".cuon__bia.bia--cau-go svg")).toHaveCount(1);
  // Cuon chua co trang: man doc ve bia o khung trong.
  await a.goto(`/sach/${id}`);
  await expect(a.locator(".trong__hinh.bia--cau-go svg")).toHaveCount(1);
  await a.reload();
  await expect(a.locator(".trong__hinh.bia--cau-go svg")).toHaveCount(1);
  await a.goto("/ke-sach");
  await expect(cuon.locator(".cuon__bia.bia--cau-go svg")).toHaveCount(1);
  await expect(cuon.locator(".bia--meo-mai")).toHaveCount(0);

  // Muoi o theo dung thu tu COVERS, o nao cung chon duoc va the xem truoc doi theo.
  await a.goto("/sach/moi");
  const xemTruoc = a.getByRole("complementary", { name: "Xem trước trên kệ" });
  expect(COVERS).toHaveLength(10);
  for (const c of COVERS) {
    const o = a.getByRole("radio", { name: COVER_LABEL[c], exact: true });
    await o.check();
    await expect(o).toBeChecked();
    await expect(xemTruoc.locator(".book__cover")).toHaveClass(new RegExp(`bia--${c}`));
  }
});
