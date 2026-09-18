import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, gioSau, niemPhongCua } from "./niem-phong";

// Ghim mui gio de phep doi gio dia phuong sang ISO duoc kiem that, ke ca khi may chay test o gio UTC.
test.use({ timezoneId: "Asia/Ho_Chi_Minh" });

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DAU = "Em tới sớm hơn giờ hẹn bốn mươi phút.";

test("cau do: cau xac nhan doi theo loai, dap an toi da 5, focus khi them xoa, khong tran ngang, ghi dung du lieu", async ({ browser }) => {
  const { a, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(DAU);
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });

  await expect(hoi.locator(".dang-hoi__chu")).toHaveText(`Đăng 1 trang vào Chuyện chưa kể? ${tenCuaB} sẽ đọc được.`);
  await expect(hoi.getByRole("radio")).toHaveCount(4);
  await hoi.getByRole("radio", { name: "Hẹn giờ" }).check();
  await expect(hoi.locator(".dang-hoi__chu")).toHaveText("Đăng 1 trang vào Chuyện chưa kể, hẹn giờ mở? Tới giờ đó cả hai mới đọc được.");
  await hoi.getByRole("radio", { name: "Trao đổi" }).check();
  await expect(hoi.locator(".dang-hoi__chu")).toHaveText(
    `Đăng 1 trang vào Chuyện chưa kể, đóng bằng trao đổi? ${tenCuaB} cần viết một trang trả lời mới đọc được.`,
  );
  await hoi.getByRole("radio", { name: "Câu đố" }).check();
  await expect(hoi.locator(".dang-hoi__chu")).toHaveText(
    `Đăng 1 trang vào Chuyện chưa kể, đóng bằng câu đố? ${tenCuaB} cần trả lời đúng mới đọc được.`,
  );

  await hoi.getByLabel("Câu hỏi", { exact: true }).fill("Mình gặp nhau ở đâu?");
  await hoi.getByLabel("Đáp án 1", { exact: true }).fill("Bến xe Miền Đông");
  const them = hoi.getByRole("button", { name: "Thêm đáp án" });
  for (let i = 0; i < 4; i++) await them.click();
  await expect(hoi.getByLabel("Đáp án 5", { exact: true })).toBeFocused();
  await expect(them).toBeDisabled();

  // Hop dai nhat cua man viet (5 dap an) khong duoc lam tran ngang o 320 va 375.
  for (const width of [320, 375]) {
    await a.setViewportSize({ width, height: 640 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }
  await a.setViewportSize({ width: 1280, height: 720 });

  await hoi.getByLabel("Đáp án 2", { exact: true }).fill("miền   đông!");
  for (const so of [5, 4, 3]) await hoi.getByRole("button", { name: `Xóa đáp án ${so}`, exact: true }).click();
  await expect(hoi.getByLabel("Đáp án 2", { exact: true })).toBeFocused();
  await expect(hoi.getByLabel("Đáp án 3", { exact: true })).toHaveCount(0);
  await expect(them).toBeEnabled();
  await hoi.getByRole("button", { name: "Thêm gợi ý" }).click();
  await hoi.getByLabel("Gợi ý 1", { exact: true }).fill("Có xe khách");

  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(await niemPhongCua(id)).toMatchObject([{
    kind: "cau-do", first_position: 1, last_position: 1, question: "Mình gặp nhau ở đâu?",
    answers: ["ben xe mien dong", "mien dong"], hints: ["Có xe khách"], teaser: DAU, opened_at: null,
  }]);
});

test("trao doi tren sach chia se, hen gio tren sach rieng tu chi con hai lua chon", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const chung = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [DAU], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  expect(await niemPhongCua(chung)).toMatchObject([{ kind: "trao-doi", question: "Hôm đó em nghĩ gì?", answers: [], hints: [] }]);

  const rieng = await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Gửi em của năm ba mươi tuổi.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi.getByRole("radio")).toHaveCount(2);
  await expect(hoi.getByRole("radio", { name: "Câu đố" })).toHaveCount(0);
  await hoi.getByRole("radio", { name: "Hẹn giờ" }).check();
  await expect(hoi.locator(".dang-hoi__chu")).toHaveText("Đăng 1 trang vào Cuốn không đặt tên, hẹn giờ mở? Tới giờ đó bạn mới đọc lại được.");

  // Mui gio ghim la UTC+7 (khong co gio mua he); ten mui gio co the la Asia/Ho_Chi_Minh hoac ban danh Asia/Saigon tuy ICU.
  expect(await a.evaluate(() => new Date("2026-09-20T00:00:00.000Z").getTimezoneOffset())).toBe(-420);
  const gio = await gioSau(a, 2 * 86_400_000);
  await hoi.getByLabel("Ngày giờ mở", { exact: true }).fill(gio);
  // Tinh thoi diem mong doi bang offset viet tay (+07:00), khong qua cach trinh duyet doc chuoi khong mui gio.
  const iso = new Date(`${gio}:00+07:00`).toISOString();
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${rieng}[?]trang=1$`));
  const [s] = await niemPhongCua(rieng);
  expect(s).toMatchObject({ kind: "hen-gio", question: null });
  expect(s.opens_at?.toISOString()).toBe(iso);
});

test("niem phong sai thi bao ngay trong hop, chua dang gi; sua xong thi dang duoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(DAU);
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });

  await hoi.getByRole("radio", { name: "Hẹn giờ" }).check();
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(hoi.getByRole("alert")).toHaveText("Chọn ngày giờ mở.");
  await hoi.getByLabel("Ngày giờ mở", { exact: true }).fill(await gioSau(a, -86_400_000));
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(hoi.getByRole("alert")).toContainText("Giờ mở phải sau lúc này ít nhất 1 phút");

  await hoi.getByRole("radio", { name: "Câu đố" }).check();
  await expect(hoi.getByRole("alert")).toHaveCount(0);
  await hoi.getByLabel("Câu hỏi", { exact: true }).fill("Mình gặp nhau ở đâu?");
  const dong = hoi.getByLabel("Đáp án 1", { exact: true });
  await dong.fill("?!");
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(dong).toHaveAttribute("aria-invalid", "true");
  await expect(dong).toBeFocused();
  await expect(hoi.getByText("Đáp án cần có chữ, chỉ dấu câu thì không ai đoán được.")).toBeVisible();
  await expect(hoi.getByRole("alert")).toHaveCount(0);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));
  await expect(a.locator(".viet-chu .ProseMirror")).toHaveAttribute("contenteditable", "false");
  expect(await niemPhongCua(id)).toEqual([]);

  await dong.fill("Bến xe");
  await expect(dong).toHaveAttribute("aria-invalid", "false");
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(await niemPhongCua(id)).toMatchObject([{ kind: "cau-do", answers: ["ben xe"] }]);
});
