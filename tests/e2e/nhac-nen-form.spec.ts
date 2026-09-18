import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { giaYoutube } from "./youtube-gia";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const MA = "5qap5aO4i9A";

test("o nhac nen: link sai bi chan, link dung duoc luu va dien lai, xoa trong la bo nhac", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  // Luu link xong la toi man doc cua mot cuon co nhac: API YouTube gia, khong goi mang that.
  await giaYoutube(a);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const suaSach = new RegExp(`/sach/${id}/sua$`);
  const manSach = new RegExp(`/sach/${id}$`);
  const luu = a.getByRole("button", { name: "Lưu", exact: true });

  await a.goto(`/sach/${id}/sua`);
  const nhac = a.getByLabel("Nhạc nền");
  await expect(nhac).toHaveValue("");
  await expect(a.getByText("Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.")).toBeVisible();

  // Link sai: bao loi luc roi o; bam Luu thi khong gui form, focus ve o nhac.
  await nhac.fill(`https://youtube.com.evil.test/watch?v=${MA}`);
  await nhac.blur();
  await expect(a.getByText("Link YouTube chưa đúng.")).toBeVisible();
  await expect(nhac).toHaveAttribute("aria-invalid", "true");
  await luu.click();
  await expect(nhac).toBeFocused();
  await expect(a).toHaveURL(suaSach);

  // Link dung: chip Da nhan video, khong tran ngang o man hep, luu xong ve man sach.
  await nhac.fill(`https://www.youtube.com/watch?v=${MA}&t=42`);
  await expect(a.getByText("Đã nhận video")).toBeVisible();
  await expect(nhac).toHaveAttribute("aria-invalid", "false");
  await a.setViewportSize({ width: 375, height: 812 });
  expect(await tranNgang(a), "tran ngang o 375px").toEqual([]);
  await luu.click();
  await expect(a).toHaveURL(manSach);

  // Mo lai form: may chu chi luu ma video, form dien lai link ngan cua dung video do.
  await a.goto(`/sach/${id}/sua`);
  await expect(nhac).toHaveValue(`https://youtu.be/${MA}`);
  await expect(a.getByText("Đã nhận video")).toBeVisible();

  // Xoa trong o nhac roi luu: sach khong con nhac.
  await nhac.fill("");
  await luu.click();
  await expect(a).toHaveURL(manSach);
  await a.goto(`/sach/${id}/sua`);
  await expect(nhac).toHaveValue("");
  await expect(a.getByText("Đã nhận video")).toHaveCount(0);
});
