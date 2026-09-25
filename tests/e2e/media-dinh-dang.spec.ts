import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { anhGif, anhJpegXoay, anhPng, anhTiff, tepMau } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

type Tep = { name: string; mimeType: string; buffer: Buffer };

/** Bo doc anh iPhone nap qua mang (Worker tu blob:), giai ma 12 MP mat khoang 1.7 giay: doi rong hon mac dinh. */
const CHO_ANH_MS = 20_000;

const oBia = (p: Page) => p.getByLabel("Thêm ảnh của bạn làm bìa");
const san = (p: Page) => p.getByRole("group", { name: "Khung cắt ảnh bìa" });

/** Chon tep lam bia, doi buoc cat, doc viewBox cua san cat (kich thuoc anh da xoay theo huong chup), roi Huy. */
async function khungCat(p: Page, tep: Tep): Promise<string | null> {
  await oBia(p).setInputFiles(tep);
  await expect(san(p)).toBeVisible({ timeout: CHO_ANH_MS });
  const khung = await san(p).locator("svg").first().getAttribute("viewBox");
  await p.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(san(p)).toHaveCount(0);
  return khung;
}

test("bia nhan PNG, JPEG xoay theo EXIF, GIF, AVIF, HEIC; TIFF bao dung cau; HEIC dung lam bia that", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  await a.goto("/sach/moi");
  await a.getByLabel("Tên sách").fill("Ảnh nhiều loại");

  expect(await khungCat(a, { name: "bia.png", mimeType: "image/png", buffer: await anhPng(a, 800, 600) })).toBe("0 0 800 600");
  expect(await khungCat(a, { name: "IMG_0101.jpg", mimeType: "image/jpeg", buffer: await anhJpegXoay(a, 800, 600, 6) })).toBe("0 0 600 800");
  expect(await khungCat(a, { name: "dong.gif", mimeType: "image/gif", buffer: anhGif(50, 30) })).toBe("0 0 50 30");
  expect(await khungCat(a, tepMau("plain.avif"))).toBe("0 0 120 80");
  expect(await khungCat(a, tepMau("orient6.heic"))).toBe("0 0 80 120");

  await oBia(a).setInputFiles({ name: "scan.tif", mimeType: "image/tiff", buffer: anhTiff() });
  await expect(a.locator(".tai-anh__chu--loi")).toHaveText("!Chưa đọc được loại ảnh này.");
  await expect(a.locator(".tai-anh__phu")).toHaveText("Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP.");
  await a.getByRole("button", { name: "Đóng" }).click();

  await oBia(a).setInputFiles(tepMau("plain.heic"));
  await expect(san(a).locator("svg").first()).toHaveAttribute("viewBox", "0 0 120 80", { timeout: CHO_ANH_MS });
  await a.getByRole("button", { name: "Dùng ảnh này" }).click();
  await expect(a.getByRole("radio", { name: /Ảnh của bạn/ })).toBeChecked();
  await a.getByRole("button", { name: "Tạo sách" }).click();
  await a.waitForURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
});

test("bo doc anh iPhone chi tai khi gap tep HEIC; mat mang thi bao cau rieng, Thu lai doc duoc", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  // Moi tep .js tai ve duoc doc than: tep nao co ham cua libheif la bo doc HEIC.
  const coBoDoc: string[] = [];
  const dangDoc: Promise<void>[] = [];
  a.on("response", (res) => {
    if (!new URL(res.url()).pathname.endsWith(".js")) return;
    dangDoc.push(res.text().then((chu) => {
      if (chu.includes("heif_context_alloc")) coBoDoc.push(res.url());
    }, () => {}));
  });

  await a.goto("/sach/moi");
  await khungCat(a, { name: "bia.png", mimeType: "image/png", buffer: await anhPng(a, 400, 300) });
  await Promise.all(dangDoc);
  expect(coBoDoc, "bo doc HEIC da tai truoc khi can").toEqual([]);

  const laJs = (url: URL) => url.pathname.endsWith(".js");
  await a.route(laJs, (route) => route.abort());
  await oBia(a).setInputFiles(tepMau("plain.heic"));
  await expect(a.locator(".tai-anh__chu--loi")).toHaveText("!Chưa tải được bộ đọc ảnh iPhone, thử lại.", { timeout: CHO_ANH_MS });
  await a.unroute(laJs);

  await a.getByRole("button", { name: "Thử lại" }).click();
  await expect(san(a).locator("svg").first()).toHaveAttribute("viewBox", "0 0 120 80", { timeout: CHO_ANH_MS });
  await Promise.all(dangDoc);
  expect(coBoDoc).toHaveLength(1);
});

test("anh HEIC trong trang: chen duoc, anh da xoay theo huong chup", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Những bữa sáng", "chia-se");
  await a.locator('input[type="file"]').setInputFiles(tepMau("orient6.heic"));
  const anh = a.locator(".viet-chu .node-anh img");
  await expect(anh).toBeVisible({ timeout: CHO_ANH_MS });
  await expect(anh).toHaveAttribute("src", new RegExp("^/m/[0-9a-f-]{36}$"));
  const rong = Number(await anh.getAttribute("width"));
  const cao = Number(await anh.getAttribute("height"));
  expect(cao, "orient6.heic hien doc: cao hon rong").toBeGreaterThan(rong);
});
