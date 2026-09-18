import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn. ";

test("dang trang: hoi xac nhan dung so trang va nguoi doc, roi mo man doc o to dau", async ({ browser }) => {
  const { a, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }
  await expect.poll(() => a.locator(".viet-to").count()).toBeGreaterThanOrEqual(2);
  const soTo = await a.locator(".viet-to").count();

  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi).toContainText(`Đăng ${soTo} trang vào Chuyện chưa kể? ${tenCuaB} sẽ đọc được.`);
  await hoi.getByRole("button", { name: "Đăng" }).click();

  await expect(a).toHaveURL(new RegExp(`/sach/${id}\\?trang=1$`));
  await expect(a.getByText(`Trang 1 / ${soTo}`).or(a.getByText(`Trang 1-2 / ${soTo}`))).toBeVisible();
});

test("trang trong thi khong hoi ma bao chua co gi de dang", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  // Khong dung getByRole("alert") tran: __next-route-announcer__ cua Next cung mang role="alert"
  // sau lan dieu huong toi man viet, gay vi pham strict mode (hai phan tu cung khop).
  await expect(a.locator(".dang").getByRole("alert")).toHaveText("Trang còn trống, chưa có gì để đăng.");
});

/*
 * Sau khi dang thanh cong, ban nhap KHONG duoc song lai. Truoc khi
 * sua, cleanup luc thoat component (redirect toi man doc) goi lai autosave.flush() vo dieu kien va
 * ghi mot dong drafts moi cho dung cuon vua dang - quay lai man viet thi thay chu cu con nguyen nhu
 * chua tung dang. Khong ep tai hien dung khe ho gia (go trong luc actionPublish dang chay): fix
 * khoa vung soan thao (setEditable(false)) ngay khi bat dau gui nen khe ho gan nhu khong con, kiem
 * tra trang thai SAU KHI dang xong da du de bat duoc hoi quy.
 */
test("dang xong roi quay lai man viet cua dung cuon: ban nhap khong song lai", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Nhật ký buổi chiều", "rieng-tu");
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  await a.keyboard.insertText("Đoạn văn này sẽ được đăng thành trang thật.");
  // Cho tu luu chay it nhat mot lan, de chac chan co mot ban nhap that trong database truoc khi dang -
  // neu khong co ban nhap nao tu dau thi test khong chung minh duoc gi ca.
  await expect(a.getByText(/^Đã lưu lúc \d{2}:\d{2}$/)).toBeVisible({ timeout: 10_000 });

  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await hoi.getByRole("button", { name: "Đăng" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}\\?trang=1$`));

  // Quay lai dung man viet cua cuon vua dang: phai la trang trong, khong con dong chu cu.
  await a.goto(`/sach/${id}/viet`);
  await expect(giay).not.toContainText("Đoạn văn này sẽ được đăng thành trang thật.");
  // Khong co ban nhap nao (initialSavedAt null) thi khong hien thanh trang thai luu.
  await expect(a.getByText(/^Đã lưu lúc/)).toHaveCount(0);
});

/*
 * Hai lop bao ve: tu luc hop xac nhan mo, vung soan thao phai bi khoa ngay (lop 1)
 * nen nguoi dung khong the go them duoc nua - cai ho thay trong hop chac chan la cai se duoc dang. Lop 2
 * (publish() chay lai prepare() sau beforePublish() va dang chinh ket qua moi, khong dung "ask" da chup
 * tu luc mo hop) la dan an toan, dung ke ca khi lop 1 bi go. Truoc khi sua, kich ban gom go chu, mo hop
 * xac nhan, go them, roi dang: doan go them van duoc autosave luu thanh ban nhap, dang xong ban nhap bi
 * xoa nen doan do mat vinh vien - mat chu da viet la loi nang nhat co the xay ra.
 */
test("go them sau khi hop xac nhan da mo khong duoc nhan; dang ra dung noi dung da go tu truoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Nhật ký một dòng", "rieng-tu");
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  await a.keyboard.insertText("Đoạn văn đầu tiên.");

  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi).toBeVisible();

  // Lop 1: tu luc hop mo, vung soan thao phai bi khoa - thu go them khong duoc nhan.
  await expect(giay).toHaveAttribute("contenteditable", "false");
  await giay.click();
  await a.keyboard.type(" Thêm chữ sau khi mở hộp.");
  await expect(giay).toHaveText("Đoạn văn đầu tiên.");

  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}\\?trang=1$`));
  await expect(a.locator(".sach")).toContainText("Đoạn văn đầu tiên.");
  await expect(a.locator(".sach")).not.toContainText("Thêm chữ sau khi mở hộp.");
});

test("che do tap trung lam mo doan khong co con tro, tat duoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Sổ tay chạy bộ", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Đoạn một.");
  await a.keyboard.press("Enter");
  await a.keyboard.insertText("Đoạn hai.");
  const doanMot = a.locator(".viet-chu p").first();
  await expect.poll(() => doanMot.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
  await a.getByRole("button", { name: "Tập trung" }).click();
  await expect(a.getByRole("button", { name: "Tập trung" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => doanMot.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});
