import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datNhac, doiNgayTaoSach, dongContextCu, haiNguoiDaVao, moSach, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG, vungBamNho } from "./vung-bam";
import { baoYt, danhSachYt, ghiYt, giaYoutube } from "./youtube-gia";
import { khoangThang, tenThang, thangCua, thangKhoa } from "@/lib/tam-trang/lich";
import { thangVuaKhep } from "@/lib/thu";

/*
 * So nhac thang va nhac di theo trang (dot nam 5b, spec B, C): dai so tren trang Dau thoi gian, trang so mot thang voi
 * moi nguoi mot danh sach phat; phat roi doi trang thi khung phat thu thanh cua so video nho o goc duoi ben phai va van
 * phat; mo sach ra doc thi nhac tat. Nguoi A la Mạnh, nguoi B la Linh.
 */

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

const MA = "dQw4w9WgXcQ";
const MA_HAI = "5qap5aO4i9A";
const THANG = thangVuaKhep(new Date());
const KHOA = thangKhoa(THANG);
const TEN = tenThang(THANG);
const GIUA_THANG = new Date(khoangThang(THANG).from.getTime() + 14 * 86_400_000);

/** Hai cuon co nhac dat luc tao sach, giua thang vua khep: cua Mạnh (bai MA) va cua Linh (bai MA_HAI). */
async function haiCuonCoNhac(a: Page, b: Page): Promise<{ cuaA: string; cuaB: string }> {
  const cuaA = await taoSach(a, "Những bữa sáng", "chia-se");
  await dangToThang(cuaA, "Lượt một.");
  await datNhac(cuaA, MA);
  await doiNgayTaoSach(cuaA, GIUA_THANG);
  const cuaB = await taoSach(b, "Chạy bộ mùa thu", "chia-se");
  await datNhac(cuaB, MA_HAI);
  await doiNgayTaoSach(cuaB, GIUA_THANG);
  return { cuaA, cuaB };
}

/** Phan tu tren cung o bon goc (lui vao 12px) va o giua cua khung phat chung. */
function diemTrenKhung(page: Page): Promise<(string | undefined)[]> {
  return page.evaluate(() => {
    const khung = document.querySelector("aside.mph iframe");
    if (!khung) throw new Error("khong co khung phat");
    const r = khung.getBoundingClientRect();
    const diem = [[r.left + 12, r.top + 12], [r.right - 12, r.top + 12], [r.left + 12, r.bottom - 12], [r.right - 12, r.bottom - 12], [r.left + r.width / 2, r.top + r.height / 2]];
    return diem.map(([x, y]) => document.elementFromPoint(x, y)?.tagName);
  });
}

test("so nhac thang: dai so, hai danh sach, phat; doi trang thi thanh cua so nho van phat; mo sach doc thi tat", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const { cuaA } = await haiCuonCoNhac(a, b);
  await giaYoutube(a);

  await a.goto("/dau-thoi-gian");
  const dai = a.getByRole("region", { name: "Sổ nhạc theo tháng" });
  const nay = tenThang(thangCua(new Date()));
  await expect(dai.locator(".so--dang")).toContainText(`${nay.charAt(0).toUpperCase()}${nay.slice(1)}`);
  await expect(dai.locator(".so--dang")).toContainText("Đang ghi");
  await dai.getByRole("link", { name: new RegExp(`^Sổ nhạc ${TEN}(, ${THANG.y})?, 2 bài$`) }).click();
  await expect(a).toHaveURL(new RegExp(`/dau-thoi-gian/thang/${KHOA}$`));
  await expect(a.getByRole("heading", { level: 1, name: `Sổ nhạc ${TEN}` })).toBeVisible();
  await expect(a.getByRole("link", { name: "Dấu thời gian" }).first()).toBeVisible();

  // Moi nguoi mot danh sach, nguoi kia truoc; khung lon nap san bai dau, chua phat.
  const cuaLinh = a.getByRole("region", { name: /Của Linh/ });
  const cuaManh = a.getByRole("region", { name: /Của Mạnh/ });
  await expect(cuaLinh.locator(".bai")).toHaveCount(1);
  await expect(cuaManh.locator(".bai")).toContainText("Những bữa sáng, lúc tạo sách");
  const khung = a.locator("aside.mph iframe");
  await expect(khung).toBeAttached();
  await expect(a.locator("aside.mph")).toHaveClass("mph mph--lon");
  expect((await danhSachYt(a)).nap).toEqual([]);

  // Tam giac: phat tu bai dau; het danh sach thi sang danh sach ke.
  await a.getByRole("button", { name: "Phát Của Linh" }).click();
  await expect.poll(async () => (await danhSachYt(a)).nap).toEqual([MA_HAI]);
  await baoYt(a, 1);
  await expect(a.getByRole("button", { name: "Tạm dừng Của Linh" })).toBeVisible();
  await expect(a.locator(".sn__dang")).toContainText("Của Linh, bài 1 trên 1.");
  await baoYt(a, 0);
  await expect.poll(async () => (await danhSachYt(a)).nap).toEqual([MA_HAI, MA]);
  await baoYt(a, 1);

  // Doi trang mem: khung phat thu thanh cua so nho o goc duoi ben phai, van la trinh phat cu, khong gi de len.
  await a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Kệ sách" }).click();
  await expect(a).toHaveURL(new RegExp("/ke-sach$"));
  const nho = a.getByRole("complementary", { name: "Nhạc đang phát" });
  await expect(nho).toBeVisible();
  expect((await ghiYt(a)).created).toBe(1);
  // Do sau khi lan thu nho (420ms) chay xong.
  await nho.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
  const hop = await khung.boundingBox();
  if (!hop) throw new Error("khong do duoc khung phat");
  expect(Math.min(hop.width, hop.height)).toBeGreaterThanOrEqual(200);
  const vp = a.viewportSize();
  if (!vp) throw new Error("khong co khung nhin");
  expect(hop.x + hop.width).toBeGreaterThan(vp.width - 40);
  expect(await diemTrenKhung(a)).toEqual(Array(5).fill("IFRAME"));
  await expect(nho.getByRole("link")).toHaveAttribute("href", `/dau-thoi-gian/thang/${KHOA}`);

  // Bai ke tiep o cua so nho: het ca hai danh sach thi tat han.
  await nho.getByRole("button", { name: "Bài kế tiếp" }).click();
  await expect(nho).toHaveCount(0);
  await expect(khung).toHaveCount(0);

  // Phat lai tu so, sang mot cuon: tam bia van nghe; bam Mở sách thi nhac chung tat.
  await a.goto(`/dau-thoi-gian/thang/${KHOA}`);
  await a.getByRole("button", { name: "Phát Của Mạnh" }).click();
  await expect.poll(async () => (await danhSachYt(a)).nap).toEqual([MA]);
  await baoYt(a, 1);
  await a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Kệ sách" }).click();
  await expect(nho).toBeVisible();
  await a.locator("a.cuon__lien", { hasText: "Những bữa sáng" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${cuaA}$`));
  await expect(nho).toBeVisible();
  await moSach(a);
  await expect(nho).toHaveCount(0);
  await expect(a.locator("aside.mph iframe")).toHaveCount(0);
});

test("so nhac: thang chua khep hay sai dang la 404", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  for (const duong of [`/dau-thoi-gian/thang/${thangKhoa(thangCua(new Date()))}`, "/dau-thoi-gian/thang/2026-13", "/dau-thoi-gian/thang/khong"]) {
    const r = await a.goto(duong);
    expect(r?.status(), duong).toBe(404);
  }
});

test("so nhac: khung phat toi thieu 200px khong gi de len, tran ngang va vung bam o bon be rong", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await haiCuonCoNhac(a, b);
  await giaYoutube(a);
  for (const w of BE_RONG) {
    await a.setViewportSize({ width: w, height: 800 });
    await a.goto(`/dau-thoi-gian/thang/${KHOA}`);
    const khung = a.locator("aside.mph iframe");
    await expect(khung).toBeAttached();
    await khung.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const hop = await khung.boundingBox();
    if (!hop) throw new Error("khong do duoc khung phat");
    expect(Math.min(hop.width, hop.height), `${w}px: khung phat`).toBeGreaterThanOrEqual(200);
    expect(await diemTrenKhung(a), `${w}px: diem tren khung phat`).toEqual(Array(5).fill("IFRAME"));
    expect(await tranNgang(a), `${w}px: tran ngang`).toEqual([]);
    expect(await vungBamNho(a), `${w}px: vung bam`).toEqual([]);
    await a.goto("/dau-thoi-gian");
    await expect(a.getByRole("region", { name: "Sổ nhạc theo tháng" })).toBeVisible();
    expect(await tranNgang(a), `${w}px: dai so, tran ngang`).toEqual([]);
  }
});
