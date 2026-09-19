import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";

/*
 * Khung dang trang kem niem phong o man viet: ba cot tren man rong, cac to dang viet xem canh nhau (hai to tren
 * 1180px, mot to tu 901 toi 1180px) bang cot CSS cua chinh vung soan thao. Cach nhin doi nhung cho ngat trang
 * thi khong: moi to van bat dau dung o dinh vung chu cua to do.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn. ";

/**
 * Do lech cua moi cho ngat trang trong khung dang mo: manh cuoi cua khoi dem ngat trang thu i phai ket thuc dung o
 * dinh vung chu cua to i + 1 (dinh to + 36px, trai to + 28px, da thu phong). Doc mot lan trong mot khung hinh.
 */
async function lechNgat(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const tos = Array.from(document.querySelectorAll(".viet-to"));
    return Array.from(document.querySelectorAll(".ngat-trang")).map((n, i) => {
      const rs = n.getClientRects();
      const cuoi = rs[rs.length - 1];
      const to = tos[i + 1].getBoundingClientRect();
      const k = to.width / 360;
      return Math.max(Math.abs(cuoi.bottom - (to.top + 36 * k)), Math.abs(cuoi.left - (to.left + 28 * k)));
    });
  });
}

/** Cac to dang thay trong khung cat (giao voi khung nhin cua .viet-chong), theo so to hien o chan to. */
async function toDangThay(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const khung = document.querySelector(".viet-chong")!.getBoundingClientRect();
    return Array.from(document.querySelectorAll(".viet-to"))
      .map((t, i) => ({ r: t.getBoundingClientRect(), i }))
      .filter(({ r }) => r.left >= khung.left - 1 && r.right <= khung.right + 1)
      .map(({ i }) => i + 1);
  });
}

test("hai to canh nhau tren man rong, mot to o man vua; go tran thi so trang va to dang thay theo con tro; cho ngat giu nguyen", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.setViewportSize({ width: 1280, height: 800 });
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }
  await a.keyboard.insertText("Dòng cuối.");
  await expect.poll(() => a.locator(".viet-to").count()).toBeGreaterThanOrEqual(2);

  const nut = a.getByRole("button", { name: "Đăng trang" });
  await nut.click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  // Mo khung: focus o loai dang chon (Khong), trang khong cuon, to giay nam tron trong khung nhin.
  await expect(hoi.getByRole("radio", { name: "Không" })).toBeFocused();
  const cau = hoi.locator(".dang-hoi__chu");
  const soDau = Number(/Đăng ([0-9]+) trang/.exec(await cau.innerText())?.[1]);
  expect(soDau).toBeGreaterThanOrEqual(2);
  await expect(cau).toHaveText(`Đăng ${soDau} trang vào Chuyện chưa kể, ${tenCuaB} đọc được ngay.`);
  if (soDau > 2) await expect(a.locator(".viet-lat__dem")).toHaveText(`Tờ 1-2 / ${soDau}`);
  else await expect(a.locator(".viet-lat")).toHaveCount(0);
  expect(await toDangThay(a)).toEqual([1, 2]);
  const khung = (await a.locator(".viet-chong").boundingBox())!;
  expect(khung.y).toBeGreaterThanOrEqual(0);
  expect(khung.y + khung.height).toBeLessThanOrEqual(800);
  expect(Math.max(...(await lechNgat(a)))).toBeLessThan(2);

  // Doi loai: cot giua doi dung cac o; Khong thi khong co cot giua.
  await hoi.getByRole("radio", { name: "Câu đố" }).check();
  await expect(hoi.getByRole("heading", { level: 2, name: "Câu đố" })).toBeVisible();
  await expect(hoi.getByLabel("Đáp án 1", { exact: true })).toBeVisible();
  await hoi.getByRole("radio", { name: "Hẹn giờ" }).check();
  await expect(hoi.getByLabel("Ngày giờ mở", { exact: true })).toBeVisible();
  await expect(hoi.getByLabel("Câu hỏi", { exact: true })).toHaveCount(0);
  await hoi.getByRole("radio", { name: "Không" }).check();
  await expect(hoi.locator(".niem__form")).toHaveCount(0);

  // Man vua: mot to; con tro o cuoi tai lieu, go tran them mot to thi khung lat theo toi to cuoi.
  await a.setViewportSize({ width: 1024, height: 800 });
  await expect.poll(() => toDangThay(a)).toEqual([1]);
  await giay.click({ position: { x: 40, y: 60 } });
  await a.keyboard.press("Control+End");
  for (let i = 0; i < 8; i++) {
    await a.keyboard.press("Enter");
    await a.keyboard.insertText(DOAN.repeat(2).trim());
  }
  await expect.poll(async () => Number(/Đăng ([0-9]+) trang/.exec(await cau.innerText())?.[1])).toBeGreaterThan(soDau);
  const so = Number(/Đăng ([0-9]+) trang/.exec(await cau.innerText())?.[1]);
  await expect(a.locator(".viet-lat__dem")).toHaveText(`Tờ ${so} / ${so}`);
  expect(await toDangThay(a)).toEqual([so]);
  await expect.poll(async () => Math.max(...(await lechNgat(a)))).toBeLessThan(2);

  // Nut lat: ve to dau, nut Truoc tat.
  const truoc = a.getByRole("button", { name: "Tờ trước" });
  while ((await truoc.getAttribute("aria-disabled")) !== "true") await truoc.click();
  await expect(a.locator(".viet-lat__dem")).toHaveText(`Tờ 1 / ${so}`);

  // De sau: dong khung, focus ve nut Dang trang; mo lai roi dang, man doc co dung so trang da hien.
  await hoi.getByRole("button", { name: "Để sau" }).click();
  await expect(hoi).toHaveCount(0);
  await expect(nut).toBeFocused();
  await nut.click();
  await expect(cau).toHaveText(`Đăng ${so} trang vào Chuyện chưa kể, ${tenCuaB} đọc được ngay.`);
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}\\?trang=1$`));
  await expect(a.locator(".doc__dem")).toContainText(`/ ${so}`);
});

test("sach rieng tu chi co Khong va Hen gio; khung mo khong tran ngang o bon be rong", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Cuốn không đặt tên", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  for (let i = 0; i < 12; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }
  await expect.poll(() => a.locator(".viet-to").count()).toBeGreaterThanOrEqual(3);
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi.getByRole("radio")).toHaveCount(2);
  expect(await hoi.getByRole("radio").evaluateAll((rs) => rs.map((r) => (r as HTMLInputElement).value))).toEqual(["khong", "hen-gio"]);
  await expect(hoi.locator(".dang-hoi__chu")).toContainText(", chỉ mình bạn đọc được.");
  await hoi.getByRole("radio", { name: "Hẹn giờ" }).check();
  for (const width of [320, 375, 414, 768]) {
    await a.setViewportSize({ width, height: 800 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }
});
