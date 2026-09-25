import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG, BE_RONG_CHAM, vungBamNho } from "./vung-bam";

/*
 * Ke chia tang va bia tu doi, tren trinh duyet that. Hai thu chi chung minh duoc o day: so cot cua luoi (mot su that
 * cua trinh duyet, doi theo be rong va co chu) va nhip muoi giay cua lan doi bia.
 */

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

/** Tao n cuon da co trang cho nguoi dang dung page. Tra ma cac cuon theo thu tu tao. */
async function nCuon(page: Page, n: number): Promise<string[]> {
  const ma: string[] = [];
  for (let i = 1; i <= n; i++) {
    const id = await taoSach(page, `Cuốn ${i}`, "chia-se");
    await dangToThang(id, `Trang của cuốn ${i}.`);
    ma.push(id);
  }
  return ma;
}

/**
 * Cho ngan tu do so cot xong: may chu ve ca ngan trong lop cat CSS `.ngan__gon`, va lop do chi go khi thanh phan da
 * chay tren trinh duyet va doc so cot. Moi phep dem truoc moc nay la dem ban cua may chu.
 */
async function daDoXong(ngan: Locator): Promise<void> {
  await expect(ngan.locator(".ngan__gon")).toHaveCount(0);
}

/** So cot that cua luoi mot ngan, doc tu tri da tinh cua trinh duyet. */
async function soCot(page: Page, ngan: string): Promise<number> {
  return page.evaluate((ten) => {
    const sec = [...document.querySelectorAll("section.ngan")].find((s) => s.getAttribute("aria-label") === ten);
    const luoi = sec?.querySelector(".hang");
    if (!luoi) return 0;
    return globalThis.getComputedStyle(luoi).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length;
  }, ngan);
}

test("ke hon ba tang: chi thay ba tang, bam dai nut thi thay het, bam lai thi gon", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await nCuon(a, 9);
  // Be rong hep de luoi chi con hai cot: ba tang la sau cuon, nen chin cuon chac chan vuot ba tang. O 1280px luoi co
  // toi nam cot, tuc ba tang da la muoi lam cho va khong ngan nao thu gon duoc.
  await a.setViewportSize({ width: 414, height: 900 });
  await a.goto("/ke-sach");
  const ngan = a.locator("section.ngan", { hasText: "Kệ của bạn" });
  await daDoXong(ngan);
  const cot = await soCot(a, "Kệ của bạn");
  expect(cot, "luoi phai co it nhat mot cot").toBeGreaterThan(0);

  // Ba tang dung nghia: dung cot * 3 cuon nam trong cay, cac cuon con lai khong duoc ve ra.
  await expect(ngan.locator(".cuon")).toHaveCount(cot * 3);

  const nut = ngan.getByRole("button", { name: /Mở rộng kệ của bạn/ });
  await expect(nut).toBeVisible();
  await nut.click();
  await expect(ngan.locator(".cuon")).toHaveCount(9);
  await expect(ngan.getByRole("button", { name: "Thu gọn kệ của bạn" })).toBeVisible();

  await ngan.getByRole("button", { name: "Thu gọn kệ của bạn" }).click();
  await expect(ngan.locator(".cuon")).toHaveCount(cot * 3);
});

test("dai nut an voi mat nhung hien ra khi di toi bang phim Tab, va doc duoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await nCuon(a, 9);
  await a.setViewportSize({ width: 414, height: 900 });
  await a.goto("/ke-sach");
  const nut = a.locator("section.ngan", { hasText: "Kệ của bạn" }).getByRole("button", { name: /Mở rộng kệ của bạn/ });
  const chu = nut.locator(".ke-nut__chu");

  // An voi mat: chu trong suot khi khong ai cham toi.
  await expect(chu).toHaveCSS("opacity", "0");
  // Nhung nut van o trong luong tieu diem va hien ra khi duoc focus.
  await nut.focus();
  await expect(nut).toBeFocused();
  await expect(chu).toHaveCSS("opacity", "1");
});

test("ba tang tro xuong thi khong co dai nut nao", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await nCuon(a, 2);
  await a.goto("/ke-sach");
  const ngan = a.locator("section.ngan", { hasText: "Kệ của bạn" });
  await daDoXong(ngan);
  await expect(ngan.locator(".cuon")).toHaveCount(2);
  await expect(ngan.getByRole("button", { name: /kệ của bạn/ })).toHaveCount(0);
});

test("ke chia tang: dai nut an du 44px, va khong tran ngang o bon be rong ca khi gon lan khi mo", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  // Muoi cuon: o 768px luoi co ba cot, ba tang la chin cho, nen ke thu gon duoc o ca bon be rong.
  await nCuon(a, 10);
  for (const w of BE_RONG) {
    await a.setViewportSize({ width: w, height: 900 });
    await a.goto("/ke-sach");
    const nut = a.locator("section.ngan", { hasText: "Kệ của bạn" }).getByRole("button", { name: /^(Mở rộng|Thu gọn) kệ của bạn/ });
    // Dai nut chi sinh ra sau khi ngan do xong so cot: do truoc do la do mot ke chua co nut.
    await expect(nut).toBeVisible();
    if (w === BE_RONG_CHAM) expect(await vungBamNho(a), `ke gon o ${w}px: vung bam`).toEqual([]);
    expect(await tranNgang(a), `ke gon o ${w}px: tran ngang`).toEqual([]);
    await nut.click();
    await expect(nut).toHaveAttribute("aria-expanded", "true");
    if (w === BE_RONG_CHAM) expect(await vungBamNho(a), `ke mo o ${w}px: vung bam`).toEqual([]);
    expect(await tranNgang(a), `ke mo o ${w}px: tran ngang`).toEqual([]);
  }
});

test("cuon hai bia: khung sach lon doi bia sau muoi giay; cuon mot bia thi dung yen", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await a.goto("/ke-sach");
  const khung = a.locator(".tranh-dan__bia");
  const lop = async () => (await khung.getAttribute("class")) ?? "";

  // Mot bia: dung yen tuyet doi. Cho qua nhip muoi giay mot chut.
  const truoc = await lop();
  await a.waitForTimeout(11_000);
  expect(await lop()).toBe(truoc);

  // Them mot o bia cho luot moi qua trang Viet tiep, roi dang mot luot nua.
  await a.goto(`/sach/${id}/viet-tiep`);
  await a.getByRole("radio", { name: "Bìa khóm trúc" }).check();
  await a.getByRole("button", { name: "Viết trang" }).click();
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt thứ hai.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  await a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=[0-9]+$`));

  await a.goto("/ke-sach");
  const bat = await lop();
  // Hai bia: sau nhip muoi giay thi bia phai doi.
  await expect.poll(lop, { timeout: 20_000, message: "bia phai doi sau muoi giay" }).not.toBe(bat);
});

test("giam chuyen dong: khung sach lon khong bao gio doi bia", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await a.goto(`/sach/${id}/viet-tiep`);
  await a.getByRole("radio", { name: "Bìa khóm trúc" }).check();
  await a.getByRole("button", { name: "Viết trang" }).click();
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt thứ hai.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  await a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=[0-9]+$`));

  await a.emulateMedia({ reducedMotion: "reduce" });
  await a.goto("/ke-sach");
  const khung = a.locator(".tranh-dan__bia");
  const truoc = (await khung.getAttribute("class")) ?? "";
  await a.waitForTimeout(12_000);
  expect(await khung.getAttribute("class")).toBe(truoc);
});
