import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { coSach, dangToThang, dongContextCu, haiNguoiDaVao, nhapCua, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DA_LUU = new RegExp("^Đã lưu lúc [0-9]{2}:[0-9]{2}$");

/** Go mot cau o man viet dang mo va doi tu luu xong. */
async function vietNhap(p: Page, chu: string): Promise<void> {
  await p.locator(".viet-chu .ProseMirror").click();
  await p.keyboard.insertText(chu);
  await expect(p.getByText(DA_LUU)).toBeVisible({ timeout: 10_000 });
}

test("xoa sach chua dang: hop xac nhan trong the, Esc tra focus, Xoa xong nguoi kia khong con thay cuon do", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  await vietNhap(a, "Sáng nay chạy vòng hồ, gió ngược cả đoạn về.");
  await b.goto("/ke-sach");
  await expect(b.locator(".cuon", { hasText: "Sổ tay chạy bộ" })).toBeVisible();

  await a.goto("/ban-nhap");
  const muc = a.getByRole("listitem").filter({ hasText: "Sổ tay chạy bộ" });
  await expect(muc.getByRole("button", { name: "Bỏ bản nháp" })).toHaveCount(0);
  const xoa = muc.getByRole("button", { name: "Xóa sách" });
  await xoa.click();
  const hoi = muc.getByRole("group", { name: "Xóa hẳn cuốn sách này?" });
  await expect(hoi.getByRole("button", { name: "Thôi" })).toBeFocused();

  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px khi hop xac nhan mo`).toEqual([]);
    if (width === 375) {
      for (const n of [muc.getByRole("link", { name: "Viết tiếp" }), xoa, hoi.getByRole("button", { name: "Thôi" }), hoi.getByRole("button", { name: "Xóa", exact: true })]) {
        expect((await n.boundingBox())?.height ?? 0, "vung bam toi thieu 44px").toBeGreaterThanOrEqual(44);
      }
    }
  }

  await a.keyboard.press("Escape");
  await expect(hoi).toHaveCount(0);
  await expect(xoa).toBeFocused();

  await xoa.click();
  await hoi.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(muc).toHaveCount(0);
  await expect(a.getByRole("heading", { name: "Chưa có bản nháp." })).toBeVisible();
  expect(await coSach(id)).toBe(false);

  await b.goto("/ke-sach");
  await expect(b.locator("main")).not.toContainText("Sổ tay chạy bộ");
  expect((await b.goto(`/sach/${id}`))?.status()).toBe(404);
});

test("bo ban nhap cua sach da dang: chi mat ban nhap, sach va trang da dang giu nguyen", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một đã đăng.");
  await a.goto(`/sach/${id}/viet`);
  await vietNhap(a, "Dòng nháp chưa muốn đăng.");

  await a.goto("/ban-nhap");
  const muc = a.getByRole("listitem").filter({ hasText: "Chuyện chưa kể" });
  await expect(muc.getByRole("button", { name: "Xóa sách" })).toHaveCount(0);
  await muc.getByRole("button", { name: "Bỏ bản nháp" }).click();
  const hoi = muc.getByRole("group", { name: "Bỏ bản nháp này?" });
  await expect(hoi.getByRole("button", { name: "Thôi" })).toBeFocused();
  await hoi.getByRole("button", { name: "Bỏ", exact: true }).click();
  await expect(muc).toHaveCount(0);
  expect(await nhapCua(id)).toBeNull();
  expect(await coSach(id)).toBe(true);

  await b.goto(`/sach/${id}`);
  await expect(b.locator(".sach")).toContainText("Tờ một đã đăng.");
});

test("cuon vua tao, chua viet chu nao: co the Chua viet chu nao o Ban nhap va xoa duoc tu do", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Sổ mới tinh", "rieng-tu");
  // Man viet chi luu nhap khi co thay doi: khong go gi thi khong co dong drafts.
  expect(await nhapCua(id)).toBeNull();

  await a.goto("/ban-nhap");
  await expect(a.getByText("1 cuốn chưa viết · chỉ mình bạn thấy")).toBeVisible();
  const muc = a.getByRole("listitem").filter({ hasText: "Sổ mới tinh" });
  await expect(muc.locator(".nhap__m")).toHaveText("Chưa viết chữ nào");
  await expect(muc.getByRole("link", { name: "Viết tiếp" })).toHaveAttribute("href", `/sach/${id}/viet`);
  await muc.getByRole("button", { name: "Xóa sách" }).click();
  await muc.getByRole("group", { name: "Xóa hẳn cuốn sách này?" }).getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(muc).toHaveCount(0);
  await expect(a.getByRole("heading", { name: "Chưa có bản nháp." })).toBeVisible();
  expect(await coSach(id)).toBe(false);
});
