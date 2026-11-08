import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao } from "./kho-sach";

/*
 * Chip tu di chuyen doc 4 canh (de xuat chip-di-chuyen): doi vi tri theo thoi gian, luon trong dai mep, khong de
 * len nav/khung nhac/la thu; dung yen khi giam chuyen dong, khi bat tam dung, khi man hep; ve goc khi mo to tro
 * chuyen; bam trung duoc du Chip dang di (G2: 20 lan bam lien tiep). Khong can may Groq gia (khong hoi Chip).
 */

const RONG = 1280;
const CAO = 800;
/** Goc nha cua Chip: duoi trai, le 16px, khung 64px. */
const NHA = { x: 16, y: CAO - 16 - 64 };

type Mau = { x: number; y: number; deNav: boolean; deNhac: boolean; deThu: boolean; dangDi: boolean };

async function layMau(page: Page, lan: number, cachMs = 1000): Promise<Mau[]> {
  const mau: Mau[] = [];
  for (let i = 0; i < lan; i++) {
    const m = await page.evaluate(() => {
      const goc = document.querySelector(".linh-vat");
      if (!goc) return null;
      const r = goc.getBoundingClientRect();
      const giao = (a: DOMRect, b: DOMRect | undefined) =>
        b !== undefined && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        deNav: giao(r, document.querySelector("nav.nav")?.getBoundingClientRect()),
        deNhac: giao(r, document.querySelector("aside.mph:not([hidden])")?.getBoundingClientRect()),
        deThu: giao(r, document.querySelector(".thu-bay:not(.thu-bay--cho):not(.thu-bay--tranh)")?.getBoundingClientRect()),
        dangDi: goc.classList.contains("linh-vat--dang-di"),
      };
    });
    if (m !== null) mau.push(m);
    await page.waitForTimeout(cachMs);
  }
  return mau;
}

/** Co nam trong dai mep khong (le chuan 16px + do luon Bezier toi da ~12px + xoay banking: cho phep lech 20px). */
function oDaiMep(m: Mau): boolean {
  return m.x <= 36 || m.y <= 36 || m.x >= RONG - 64 - 20 || m.y >= CAO - 64 - 20;
}

async function tamNut(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const r = document.querySelector(".linh-vat__nut")?.getBoundingClientRect();
    return r === undefined ? null : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

/** Doi toi khi Chip dang di (lop vo canh bat), toi da toiDaMs (ve goc xong Chip nghi 1-4 giay roi moi di). */
async function choChipDangDi(page: Page, toiDaMs = 10_000): Promise<void> {
  const batDau = Date.now();
  for (;;) {
    const dangDi = await page.evaluate(() => document.querySelector(".linh-vat")?.classList.contains("linh-vat--dang-di") ?? false);
    if (dangDi) return;
    if (Date.now() - batDau > toiDaMs) return;
    await page.waitForTimeout(300);
  }
}

/** Tha mot tam trang qua hop chon tren trang dang mo (de bau troi hien nut tam dung). */
async function thaTamTrang(p: Page): Promise<void> {
  await p.getByRole("button", { name: "Thả tâm trạng" }).click();
  await p.locator("label.o", { hasText: "Mưa phùn" }).click();
  await p.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(p.getByText("Đã thả Mưa phùn. Giữ trong 24 giờ.")).toBeAttached();
}

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

test("di chuyen doc canh: doi vi tri theo thoi gian, luon trong dai mep, khong de len nav/nhac/thu", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: RONG, height: CAO });
  await b.goto("/ke-sach");
  // Cho bong bong chao (neu co) tu tat sau 8 giay: luc do Chip neo dau o goc, chua di.
  await b.waitForTimeout(10_000);
  const mau = await layMau(b, 20);
  expect(mau).toHaveLength(20);
  const rieng = new Set(mau.map((m) => `${m.x},${m.y}`));
  expect(rieng.size, "Chip phai doi vi tri (khong dung mot cho)").toBeGreaterThan(3);
  expect(mau.filter((m) => m.dangDi).length, "phai co luc dang di").toBeGreaterThan(0);
  for (const m of mau) {
    expect(oDaiMep(m), `(${m.x},${m.y}) phai trong dai mep`).toBe(true);
    expect(m.deNav, `(${m.x},${m.y}) khong de len nav`).toBe(false);
    expect(m.deNhac, `(${m.x},${m.y}) khong de len khung nhac`).toBe(false);
    expect(m.deThu, `(${m.x},${m.y}) khong de len la thu`).toBe(false);
  }
});

test("giam chuyen dong: Chip dung yen o goc, khong co lop dang di", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: RONG, height: CAO });
  await b.emulateMedia({ reducedMotion: "reduce" });
  await b.goto("/ke-sach");
  await b.waitForTimeout(3000);
  const mau = await layMau(b, 5);
  expect(mau).toHaveLength(5);
  for (const m of mau) {
    expect(m.x).toBe(NHA.x);
    expect(m.y).toBe(NHA.y);
    expect(m.dangDi).toBe(false);
  }
});

test("tam dung hieu ung: Chip dung yen o goc; cho chay lai thi di tiep", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: RONG, height: CAO });
  await thaTamTrang(a);
  await b.goto("/ke-sach");
  await b.getByRole("button", { name: "Tạm dừng hiệu ứng" }).click();
  await expect(b.getByText("Hiệu ứng đã tạm dừng.")).toBeAttached();
  const mauDung = await layMau(b, 5);
  expect(mauDung).toHaveLength(5);
  for (const m of mauDung) {
    expect(m.x).toBe(NHA.x);
    expect(m.y).toBe(NHA.y);
    expect(m.dangDi).toBe(false);
  }
  await b.getByRole("button", { name: "Cho hiệu ứng chạy" }).click();
  await expect(b.getByText("Hiệu ứng chạy lại rồi.")).toBeAttached();
  await b.waitForTimeout(10_000);
  const mauChay = await layMau(b, 10);
  const rieng = new Set(mauChay.map((m) => `${m.x},${m.y}`));
  expect(rieng.size, "cho chay lai thi Chip phai doi vi tri").toBeGreaterThan(1);
});

test("mo to tro chuyen: Chip ve goc duoi trai", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: RONG, height: CAO });
  await b.goto("/ke-sach");
  await b.waitForTimeout(10_000);
  // Cho Chip roi goc roi moi bam, khong thi phep thu vo nghia (da o goc san).
  await choChipDangDi(b);
  await b.getByRole("button", { name: "Chíp, mở trò chuyện" }).click({ force: true });
  await expect(b.getByRole("region", { name: "Chíp", exact: true })).toBeVisible();
  // Chip ve goc trong vai giay (duong ve nhanh gap 8 lan toc do dao choi).
  await expect
    .poll(
      async () => {
        const m = await b.evaluate(() => {
          const r = document.querySelector(".linh-vat")?.getBoundingClientRect();
          return r === undefined ? null : `${Math.round(r.left)},${Math.round(r.top)}`;
        });
        return m ?? "";
      },
      { timeout: 10_000 },
    )
    .toBe(`${NHA.x},${NHA.y}`);
});

test("man hep 360px (G3): Chip dung yen o goc", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: 360, height: CAO });
  await b.goto("/ke-sach");
  await b.waitForTimeout(3000);
  const mau = await layMau(b, 5);
  expect(mau).toHaveLength(5);
  for (const m of mau) {
    expect(m.x).toBe(NHA.x);
    expect(m.y).toBe(NHA.y);
    expect(m.dangDi).toBe(false);
  }
});

test("G2: bam Chip 20 lan lien tiep luc dang di, bam trung duoc", async ({ browser }) => {
  test.setTimeout(180_000);
  const { b } = await haiNguoiDaVao(browser);
  await b.setViewportSize({ width: RONG, height: CAO });
  await b.goto("/ke-sach");
  await b.waitForTimeout(10_000);
  let trung = 0;
  for (let i = 0; i < 20; i++) {
    await choChipDangDi(b);
    const truoc = await b.locator(".tc").count();
    const tam = await tamNut(b);
    if (tam === null) continue;
    // Bam bang chuot tai tam nut vua doc: Chip di 160px/s nen tu luc doc toi luc bam lech vai px, van trong nut 64px.
    await b.mouse.click(tam.x, tam.y);
    await b.waitForTimeout(300);
    const sau = await b.locator(".tc").count();
    if (sau !== truoc) trung += 1;
    if (sau > 0) {
      await b.getByRole("button", { name: "Đóng trò chuyện" }).click();
      await b.waitForTimeout(300);
    }
  }
  console.log(`G2: bam trung ${trung}/20 lan`);
  expect(trung, "bam trung it nhat 18/20 lan").toBeGreaterThanOrEqual(18);
});
