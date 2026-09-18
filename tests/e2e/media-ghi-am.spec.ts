import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dangTrang, dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { giaMicro, maTaiMedia } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Doc mot lan: moi the audio trong sach dang tam dung, va so the audio dang co. */
async function tiengTrongSach(page: Page): Promise<{ so: number; dungHet: boolean }> {
  return page.evaluate(() => {
    const cac = Array.from(document.querySelectorAll("audio"));
    return { so: cac.length, dungHet: cac.every((x) => x.paused) };
  });
}

test("ghi am o man viet: ghi, nghe thu, chen, dang; man doc phat va tam dung; lat trang thi tieng dung", async ({ browser }) => {
  const { a, tenCuaA } = await haiNguoiDaVao(browser);
  await giaMicro(a);
  const id = await taoSach(a, "Những bữa sáng", "chia-se");

  await a.getByRole("button", { name: "Ghi âm" }).click();
  const hop = a.getByRole("region", { name: "Ghi âm", exact: true });
  await expect(hop).toBeVisible();
  const dongHo = hop.getByRole("timer");
  // Doc so giay tu nhan dong ho roi cho no dat 2: so sanh nguong, khong so bang mot gia tri tuc thoi. Nhan chi giu moi
  // gia tri dung mot giay, con expect.poll cung lay mau moi mot giay, nen so bang co the khong bao gio trung.
  await expect
    .poll(async () => {
      const nhan = (await dongHo.getAttribute("aria-label")) ?? "";
      const m = new RegExp("Đã ghi ([0-9]+):([0-9]{2})").exec(nhan);
      return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
    }, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);

  await hop.getByRole("button", { name: "Dừng" }).click();
  const nghe = a.getByRole("region", { name: "Nghe thử" });
  await expect(nghe.getByRole("button", { name: "Phát ghi âm" })).toBeVisible();
  await nghe.getByRole("button", { name: "Chèn" }).click();

  const khoi = a.locator(".viet-chu .node-ghi-am");
  await expect(khoi).toHaveCount(1);
  await expect(a.getByText("Đã chèn ghi âm.")).toBeVisible();
  const ghiId = (await khoi.locator("audio").getAttribute("src"))?.replace("/m/", "") ?? "";
  expect(ghiId).toMatch(new RegExp("^[0-9a-f-]{36}$"));

  // Ban phim voi khoi ghi am: Tab toi dung nut Bo ghi am cua khoi dang chon. Khoi ghi am co hai nut focus
  // duoc (Phat ghi am roi Bo ghi am, theo dung thu tu DOM cua AudioBlock), khac khoi anh chi co mot nut, nen o
  // day can hai lan Tab: lan dau toi Phat ghi am, lan hai moi toi Bo ghi am.
  await khoi.click();
  await a.keyboard.press("Tab");
  await expect(a.getByRole("button", { name: "Phát ghi âm" })).toBeFocused();
  await a.keyboard.press("Tab");
  await expect(a.getByRole("button", { name: "Bỏ ghi âm" })).toBeFocused();

  expect(await dangTrang(a)).toBe(1);
  await dangToThang(id, "Tờ hai");
  expect(await maTaiMedia(a, ghiId)).toBe(200);

  await a.setViewportSize({ width: 375, height: 900 });
  await a.goto(`/sach/${id}?trang=1`);
  const trinhPhat = a.locator(".sach .khoi-ghi-am");
  await expect(trinhPhat).toBeVisible();
  await expect(a.locator(".sach .khoi-ghi-am__nhan")).toContainText(`${tenCuaA} ghi âm`);
  expect(await tiengTrongSach(a), "khong tu phat").toEqual({ so: 1, dungHet: true });

  await a.getByRole("button", { name: "Phát ghi âm" }).click();
  await expect(a.getByRole("button", { name: "Tạm dừng ghi âm" })).toBeVisible();
  await expect.poll(async () => (await tiengTrongSach(a)).dungHet).toBe(false);
  await a.getByRole("button", { name: "Tạm dừng ghi âm" }).click();
  await expect(a.getByRole("button", { name: "Phát ghi âm" })).toBeVisible();
  await expect.poll(async () => (await tiengTrongSach(a)).dungHet).toBe(true);

  // Phat lai roi lat trang: tieng dung ngay luc lat.
  await a.getByRole("button", { name: "Phát ghi âm" }).click();
  await expect.poll(async () => (await tiengTrongSach(a)).dungHet).toBe(false);
  await a.keyboard.press("ArrowRight");
  await expect(a.locator(".doc__dem")).toHaveText("Trang 2 / 2");
  await expect.poll(async () => (await tiengTrongSach(a)).dungHet).toBe(true);
});

test("loi micro tach hai cau: chua cho phep, va khong tim thay", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await giaMicro(a, "NotAllowedError");
  const id = await taoSach(a, "Những bữa sáng", "chia-se");

  await a.getByRole("button", { name: "Ghi âm" }).click();
  const hop = a.getByRole("region", { name: "Ghi âm", exact: true });
  await expect(hop.getByRole("alert")).toContainText("Chưa cho phép dùng micro.");
  await expect(hop.getByText("Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.")).toBeVisible();

  await giaMicro(a, "NotFoundError");
  await a.goto(`/sach/${id}/viet`);
  await a.getByRole("button", { name: "Ghi âm" }).click();
  const hop2 = a.getByRole("region", { name: "Ghi âm", exact: true });
  await expect(hop2.getByRole("alert")).toContainText("Không tìm thấy micro.");
  await expect(hop2.getByText("Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.")).toHaveCount(0);
  await hop2.getByRole("button", { name: "Đóng" }).click();
  await expect(a.getByRole("region", { name: "Ghi âm", exact: true })).toHaveCount(0);
});
