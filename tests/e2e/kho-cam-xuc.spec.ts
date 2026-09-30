import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, ghiCamXuc, haiNguoiDaVao, tranNgang } from "./kho-sach";
import { BE_RONG, vungBamNho } from "./vung-bam";

/*
 * Kho cam xuc va linh vat Chip (dot nam 5d, spec muc G2) tren trinh duyet that: Manh tha, Linh dang mo Ke sach thay Chip
 * hoa hinh, noi cau cua Manh va dien hieu ung xuyen chuot; tai lai khong dien lai; dong Hoat dong o ca hai phia. Vang lau
 * thi chi ba cam xuc moi nhat, theo thu tu. Tha hai lan lien nhau thi bao cho. Giam chuyen dong khong co lop hieu ung.
 * Tran ngang va vung bam 44px voi kho mo va bong bong hien. a la Manh, b la Linh.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Cho mot nhip hoi hang cho (15 giay) cong du. */
const MOT_NHIP_HOI = 25_000;

/** Mo to tro chuyen cua Chip roi mo Kho cam xuc trong to (5e: kho nam trong to tro chuyen); tra vung kho. */
async function moKho(p: Page) {
  await p.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const to = p.getByRole("region", { name: "Chíp", exact: true });
  await to.getByRole("button", { name: /^Thả cảm xúc cho / }).click();
  return to;
}

test("Manh tha Yeu: Linh thay Gau bong noi cau cua Manh, hieu ung xuyen chuot, tai lai khong dien lai", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const kho = await moKho(a);
  await kho.getByRole("button", { name: "Yêu" }).click();
  await expect(kho.getByText(/sẽ nói với Linh/)).toHaveText("Gấu bông sẽ nói với Linh: Mạnh đang cảm thấy yêu bạn");
  await kho.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(a.locator(".loi-lv__chu")).toContainText("Gấu bông đang mang Yêu tới Linh.");
  await expect(a.locator(".hieu-ung")).toHaveCount(0);

  // Linh dang mo Ke sach: trong mot nhip hoi, Chip hoa Gau bong va noi.
  await expect(b.locator(".loi-lv__chu")).toContainText("Mạnh đang cảm thấy yêu bạn", { timeout: MOT_NHIP_HOI });
  await expect(b.locator(".linh-vat")).toHaveClass(/linh-vat--mang/);
  await expect(b.locator(".linh-vat__hinh img")).toHaveAttribute("src", "/linh-vat/gau-bong.webp");
  const lop = b.locator(".hieu-ung");
  await expect(lop).toHaveCount(1);
  await expect(lop).toHaveCSS("pointer-events", "none");
  await expect(lop.locator(".hv-tim").first()).toBeAttached();
  // Hieu ung khong chan bam: lien ket ben duoi van bam duoc luc dang dien.
  await b.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Dấu thời gian" }).click();
  await b.waitForURL(/\/dau-thoi-gian$/);

  // Tai lai: khong dien lai; dong Hoat dong o ca hai phia.
  await b.goto("/ke-sach");
  await b.waitForTimeout(1500);
  await expect(b.locator(".loi-lv")).toHaveCount(0);
  await expect(b.locator(".hoat-dong__chu").first()).toHaveText("Mạnh thả cảm xúc Yêu");
  await a.goto("/ke-sach");
  await expect(a.locator(".hoat-dong__chu").first()).toHaveText("Bạn thả cảm xúc Yêu");
});

test("vang lau quay lai: chi ba cam xuc moi nhat, cu toi moi; tha hai lan lien nhau thi bao cho", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await ghiCamXuc("Mạnh", { loai: "vui", giayTruoc: 400 }, { loai: "buon", giayTruoc: 300 }, { loai: "nho", giayTruoc: 200 }, { loai: "treu", giayTruoc: 100 });
  await b.goto("/ke-sach");
  for (const [cau, ten] of [["Mạnh đang buồn", "Chim cánh cụt"], ["Mạnh đang nhớ bạn", "Gấu túi"], ["Mạnh đang muốn trêu bạn", "Khỉ con"]]) {
    await expect(b.locator(".loi-lv__chu")).toContainText(cau);
    await b.getByRole("button", { name: `Đóng lời ${ten}` }).click();
  }
  await b.waitForTimeout(1500);
  await expect(b.locator(".loi-lv")).toHaveCount(0);

  let kho = await moKho(a);
  await kho.getByRole("button", { name: "Biết ơn" }).click();
  await kho.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(a.locator(".loi-lv__chu")).toContainText("Gấu trúc đang mang Biết ơn tới Linh.");
  kho = await moKho(a);
  await kho.getByRole("button", { name: "Giận" }).click();
  await kho.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(kho.getByRole("alert")).toHaveText("Chíp vừa chạy đi, vài giây nữa thả tiếp nhé.");
});

test("giam chuyen dong: bong bong va hinh moi van hien, khong co lop hieu ung", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await b.emulateMedia({ reducedMotion: "reduce" });
  await ghiCamXuc("Mạnh", { loai: "gian", giayTruoc: 5 });
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-lv__chu")).toContainText("Mạnh đang giận bạn đó");
  await expect(b.locator(".linh-vat__hinh source")).toHaveAttribute("srcset", "/linh-vat/ho-con-tinh.webp");
  await b.waitForTimeout(500);
  await expect(b.locator(".hieu-ung")).toHaveCount(0);
});

test("kho mo va bong bong khong tran ngang; vung bam 44px o be rong cam ung", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await b.emulateMedia({ reducedMotion: "reduce" });
  await ghiCamXuc("Mạnh", { loai: "bat-ngo", giayTruoc: 5 });
  for (const w of BE_RONG) {
    await a.setViewportSize({ width: w, height: 800 });
    await a.goto("/ke-sach");
    await (await moKho(a)).getByRole("button", { name: "Bất ngờ" }).click();
    expect(await tranNgang(a), `kho ${w}`).toEqual([]);
    expect(await vungBamNho(a), `kho ${w}`).toEqual([]);
  }
  await b.setViewportSize({ width: 320, height: 800 });
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-lv__chu")).toContainText("Mạnh bất ngờ quá");
  for (const w of BE_RONG) {
    await b.setViewportSize({ width: w, height: 800 });
    expect(await tranNgang(b), `bong bong ${w}`).toEqual([]);
    expect(await vungBamNho(b), `bong bong ${w}`).toEqual([]);
  }
});
