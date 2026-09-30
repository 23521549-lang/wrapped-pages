import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { resetDb } from "./db";
import { GROQ_GIA_CONG } from "./env";
import { datLanCuoiThay, dongContextCu, ghiThu, haiNguoiDaVao, tranNgang } from "./kho-sach";
import { BE_RONG, vungBamNho } from "./vung-bam";

/*
 * Chip biet noi (dot nam 5e, spec muc I) tren trinh duyet that, voi may chu Groq gia o cong GROQ_GIA_CONG (tests/e2e/env.ts
 * tro webServer toi day): hoi va nhan tra loi, tai lai van con tin, nguoi kia khong thay; ngu canh gui di dung ten hai
 * nguoi (luat giu bi mat kiem o chip-server.test.ts); het han muc thi Chip ngu cho ca hai; vang lau quay lai thi Chip mung ve; thu nho; tat trong Cai dat;
 * tran ngang va vung bam o bon be rong. a la Manh, b la Linh.
 */

/** Cac lan goi toi Groq gia: tin he thong (ngu canh) va tin cuoi cua nguoi dung. */
const daGoi: { heThong: string; cuoi: string }[] = [];
let may: Server;

test.beforeAll(async () => {
  may = createServer((req, res) => {
    let than = "";
    req.on("data", (c: Buffer) => {
      than += c.toString("utf8");
    });
    req.on("end", () => {
      const body = JSON.parse(than) as { messages: { role: string; content: string }[] };
      const heThong = body.messages.find((m) => m.role === "system")?.content ?? "";
      const cuoi = body.messages.at(-1)?.content ?? "";
      daGoi.push({ heThong, cuoi });
      if (cuoi.includes("ngủ đi")) {
        res.writeHead(429, { "retry-after": "36000", "content-type": "application/json" });
        res.end("{}");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: `Chíp nghe rồi: **${cuoi}**` } }] }));
    });
  });
  await new Promise<void>((ok) => may.listen(GROQ_GIA_CONG, "127.0.0.1", ok));
});

test.afterAll(async () => {
  await new Promise<void>((ok) => may.close(() => ok()));
});

test.beforeEach(async () => {
  daGoi.length = 0;
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("hoi Chip: tra loi hien, tai lai van con, nguoi kia khong thay; ngu canh co ten minh va nguoi kia", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const to = a.getByRole("region", { name: "Chíp" });
  await expect(to).toContainText("Đang thức");
  await to.getByLabel("Nói với Chíp").fill("Hôm nay Linh thế nào?");
  await to.getByLabel("Nói với Chíp").press("Enter");
  await expect(to.locator(".tin--chip").last()).toHaveText("Chíp: Chíp nghe rồi: Hôm nay Linh thế nào?");
  await expect(to.locator(".tin--chip").last().locator("b")).toHaveText("Hôm nay Linh thế nào?");
  expect(daGoi).toHaveLength(1);
  expect(daGoi[0].heThong).toContain("Người đang nói chuyện với bạn là Mạnh");
  expect(daGoi[0].heThong).toContain("Linh");

  await a.reload();
  await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  await expect(a.getByRole("region", { name: "Chíp" }).locator(".tin--minh")).toHaveText(["Bạn: Hôm nay Linh thế nào?"]);

  await b.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const toB = b.getByRole("region", { name: "Chíp" });
  await expect(toB).toContainText("Chào Linh! Chíp đây.");
  await expect(toB.locator(".tin--minh")).toHaveCount(0);
});

test("het han muc ngay: Chip di ngu cho ca hai, o nhap tat, kho van mo duoc", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const to = a.getByRole("region", { name: "Chíp" });
  await to.getByLabel("Nói với Chíp").fill("Chíp ngủ đi");
  await to.getByRole("button", { name: "Gửi" }).click();
  await expect(to.locator(".tin--chip").last()).toContainText("Chíp mệt rồi, đi ngủ chút nha.");
  await expect(to.getByLabel("Nói với Chíp")).toBeDisabled();
  await expect(to).toContainText("Đang ngủ,");
  await to.getByRole("button", { name: "Đóng trò chuyện" }).click();
  await expect(a.locator(".linh-vat__ngu")).toBeVisible();

  await b.reload();
  await expect(b.locator(".linh-vat__ngu")).toBeVisible();
  await b.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const toB = b.getByRole("region", { name: "Chíp" });
  await expect(toB.getByLabel("Nói với Chíp")).toBeDisabled();
  await toB.getByRole("button", { name: "Thả cảm xúc cho Mạnh" }).click();
  await expect(toB.getByRole("button", { name: "Yêu" })).toBeVisible();
  expect(daGoi).toHaveLength(2);
});

test("vang ba ngay quay lai: Chip mung ve va tom tat viec nguoi kia lam, kem nut Xem ngay", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await datLanCuoiThay("Linh", new Date(Date.now() - 3 * 86_400_000 - 60_000));
  await ghiThu("Mạnh", "2026-09", "Gửi Linh tháng Chín.");
  await b.evaluate(() => localStorage.removeItem("mqce-chip-noi-luc"));
  await b.reload();
  const loi = b.locator(".loi-lv--chao");
  await expect(loi.locator(".loi-lv__chu")).toHaveText("Linh về rồi! 3 ngày rồi đó. Trong lúc Linh đi, Mạnh gửi thư tháng Chín.");
  await expect(loi.getByRole("link", { name: "Xem ngay" })).toHaveAttribute("href", "/tam-trang#thu-2026-09");
  await loi.getByRole("button", { name: "Nói chuyện với Chíp" }).click();
  await expect(b.getByRole("region", { name: "Chíp" })).toBeVisible();
  // Tai lai ngay: da chao roi, khong noi lai.
  await b.reload();
  await b.waitForTimeout(1500);
  await expect(b.locator(".loi-lv--chao")).toHaveCount(0);
});

test("thu nho nho theo trinh duyet; tat Chip trong Cai dat thi khong ngoi goc o trang nao", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  await a.getByRole("button", { name: "Thu nhỏ Chíp" }).click();
  await expect(a.locator(".linh-vat")).toHaveClass(/linh-vat--thu-nho/);
  await a.reload();
  await a.getByRole("button", { name: "Chíp đang thu nhỏ, bấm để hiện lại" }).click();
  await expect(a.getByRole("button", { name: "Chíp, mở trò chuyện" })).toBeVisible();

  await a.goto("/cai-dat");
  await a.getByLabel("Hiện Chíp ở các trang").uncheck();
  await expect(a.locator(".linh-vat__nut")).toHaveCount(0);
  await a.goto("/ke-sach");
  await expect(a.locator(".linh-vat__nut")).toHaveCount(0);
  await a.goto("/cai-dat");
  await a.getByLabel("Hiện Chíp ở các trang").check();
  await expect(a.locator(".linh-vat__nut")).toHaveCount(1);
});

test("to tro chuyen va kho mo: khong tran ngang, vung bam 44px o be rong cam ung", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  for (const w of BE_RONG) {
    await a.setViewportSize({ width: w, height: 800 });
    await a.goto("/ke-sach");
    await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
    const to = a.getByRole("region", { name: "Chíp" });
    await to.getByRole("button", { name: /^Thả cảm xúc cho / }).click();
    await to.getByRole("button", { name: "Vui" }).click();
    expect(await tranNgang(a), `to ${w}`).toEqual([]);
    expect(await vungBamNho(a), `to ${w}`).toEqual([]);
  }
  await a.goto("/cai-dat");
  expect(await vungBamNho(a, [{ phanTu: ".chon-chip input", vungBam: "label.chon-chip" }]), "cai dat").toEqual([]);
});
