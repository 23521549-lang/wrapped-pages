import { test, expect, type Locator, type Page } from "@playwright/test";
import { normalizeReplyBody } from "@/lib/round-reply";
import { resetDb } from "./db";
import { dangToThang, datNhac, docSach, dongContextCu, haiNguoiDaVao, taiLaiSach, taoSach, toDaXemCua, tranNgang } from "./kho-sach";
import { dangKemNiemPhong } from "./niem-phong";
import { BE_RONG, BE_RONG_CHAM } from "./vung-bam";
import { giaYoutube } from "./youtube-gia";

/*
 * Loi hoi dap theo luot dang, di tu man doc that: nguoi doc gui mot lan roi thoi, nguoi viet doc duoc o cung cho, khung
 * di theo luot cua to dang hien, va cot phai dung cho o bon be rong cam ung lan man rong.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const LF = String.fromCharCode(10);
const MA = "dQw4w9WgXcQ";
const GIO = /^[0-9]{2}:[0-9]{2}$/;

const khung = (p: Page): Locator => p.getByRole("region", { name: "Lời hồi đáp" });

async function hop(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const h = await l.boundingBox();
  if (!h) throw new Error("phan tu khong hien");
  return h;
}

/**
 * Chu trong doan trich cua loi da gui, nguyen van (ke ca xuong dong). Doi doan trich hien ra bang mot khang dinh co
 * tran rieng truoc: evaluate doi toi het gio cua ca bai, nen khung khong co loi thi bai treo thay vi do ngay.
 */
const chuDaGui = async (p: Page): Promise<string | null> => {
  const l = khung(p).locator(".hoi-dap__chu");
  await expect(l).toBeVisible();
  return l.evaluate((el) => el.textContent);
};

test("nguoi doc gui loi hoi dap sau khi hoi lai; bam doi chi gui mot loi; nguoi viet doc duoc; dong Hoat dong dan toi to dau cua luot", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");
  await dangToThang(id, "Tờ ba");

  await b.setViewportSize({ width: 1280, height: 900 });
  await docSach(b, id);
  await expect(khung(b).getByText("Dành cho trang 1 tới 2")).toBeVisible();
  await expect(khung(b).getByText("0/1000")).toBeVisible();
  const chu = `  Đọc tới đây thương ghê.${LF}${LF}${LF}${LF}${LF}Cảm ơn nhé.  `;
  const daChuan = normalizeReplyBody(chu);
  const o = khung(b).getByLabel("Viết lời hồi đáp");
  await o.fill(chu);
  await expect(khung(b).getByText(`${Array.from(daChuan).length}/1000`)).toBeVisible();

  // Hoi lai ngay trong khung; Esc tra ve o chu, chu con nguyen.
  await khung(b).getByRole("button", { name: "Gửi" }).click();
  const hoi = khung(b).getByRole("group", { name: "Xác nhận gửi lời hồi đáp" });
  await expect(hoi.getByText("Gửi rồi sẽ không sửa được.")).toBeVisible();
  await expect(hoi.getByRole("button", { name: "Xem lại" })).toBeFocused();
  await b.keyboard.press("Escape");
  await expect(hoi).toHaveCount(0);
  await expect(o).toBeFocused();
  await expect(o).toHaveValue(chu);

  // Bam doi that nhanh tren nut Gui cua hop hoi lai: hai lan bam lien nhau khong bao gio thanh hai loi.
  await khung(b).getByRole("button", { name: "Gửi" }).click();
  const h = await hop(hoi.getByRole("button", { name: "Gửi" }));
  await b.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await b.mouse.down();
  await b.mouse.up();
  await b.mouse.down();
  await b.mouse.up();

  await expect(khung(b).getByLabel("Viết lời hồi đáp")).toHaveCount(0);
  await expect(khung(b).locator(".hoi-dap__loi")).toHaveCount(1);
  expect(await chuDaGui(b)).toBe(daChuan);
  const caption = khung(b).locator("figcaption");
  await expect(caption).toHaveText(/^Bạn gửi hôm nay, [0-9]{2}:[0-9]{2}$/);
  await expect(khung(b).locator(".hoi-dap__loi")).toBeFocused();

  // To 1 va 2 chi thanh "da thay" khi khung dung yen tren chung du CHO_MS (600ms) cua Reader, va lan ghi do di qua may
  // chu. Doi DUNG DONG trong read_sheets thay vi doi gio: ca doan tren chay het trong duoi 600ms tren may nhanh (tren
  // CI la 565ms tu luc mo man doc toi luc tai lai), nen khong doi thi lan tai lai duoi day van mo o to 1.
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([1, 2]);

  // Tai lai khong kem ?trang: man doc mo o to nho nhat chua thay (to 3, luot hai), nen khung la o chu con trong cua luot do.
  await taiLaiSach(b);
  await expect(khung(b).getByText("Dành cho trang 3")).toBeVisible();
  await expect(khung(b).getByLabel("Viết lời hồi đáp")).toHaveValue("");
  // Quay lai luot da hoi dap: van la loi da gui, khong co o chu nao (bat bien, mot luot mot loi).
  await b.goto(`/sach/${id}?trang=1`);
  expect(await chuDaGui(b)).toBe(daChuan);
  await expect(khung(b).getByRole("button", { name: "Gửi" })).toHaveCount(0);

  // Nguoi viet: doc duoc loi, kem ten nguoi doc va gio; khong co o chu.
  await a.setViewportSize({ width: 1280, height: 900 });
  await docSach(a, id);
  expect(await chuDaGui(a)).toBe(daChuan);
  const gio = (await khung(a).locator("figcaption time").textContent()) ?? "";
  await expect(khung(a).locator("figcaption")).toHaveText(`${tenCuaB} gửi ${gio}`);
  expect(gio.startsWith("hôm nay, ") && GIO.test(gio.slice("hôm nay, ".length))).toBe(true);
  await expect(khung(a).getByLabel("Viết lời hồi đáp")).toHaveCount(0);

  // Dong Hoat dong cua nguoi viet: dung mot dong (bam doi khong sinh dong thu hai) va dan toi to dau cua luot.
  await a.goto("/ke-sach");
  const dong = a.locator("section.hoat-dong").getByRole("listitem").filter({ hasText: `${tenCuaB} đã hồi đáp trang 1 tới 2 của Chuyện chưa kể` });
  await expect(dong).toHaveCount(1);
  await expect(dong.getByRole("link")).toHaveAttribute("href", `/sach/${id}?trang=1`);
});

test("khung theo luot cua to dang hien: mot trang, hai trang (theo trang phai), chu dang go cua luot cu duoc giu", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một");
  await dangToThang(id, "Tờ hai", "Tờ ba");
  await dangToThang(id, "Tờ bốn");

  await b.setViewportSize({ width: 375, height: 812 });
  await docSach(b, id);
  const dau = khung(b).locator(".meta").first();
  const dem = b.locator(".doc__dem");
  // Lat mot to va doi khung dung yen (bo dem cua sach doi) roi moi lat tiep: bam doi trong luc lat se bi gop.
  const lat = async (ten: "Trang sau" | "Trang trước", sau: string) => {
    await b.getByRole("button", { name: ten }).click();
    await expect(dem).toHaveText(sau);
  };
  await expect(dem).toHaveText("Trang 1 / 4");
  await expect(dau).toHaveText("Dành cho trang 1");
  await khung(b).getByLabel("Viết lời hồi đáp").fill("Nháp lượt một");
  await lat("Trang sau", "Trang 2 / 4");
  await expect(dau).toHaveText("Dành cho trang 2 tới 3");
  await expect(khung(b).getByLabel("Viết lời hồi đáp")).toHaveValue("");
  await lat("Trang sau", "Trang 3 / 4");
  await expect(dau).toHaveText("Dành cho trang 2 tới 3");
  await lat("Trang sau", "Trang 4 / 4");
  await expect(dau).toHaveText("Dành cho trang 4");
  await lat("Trang trước", "Trang 3 / 4");
  await lat("Trang trước", "Trang 2 / 4");
  await lat("Trang trước", "Trang 1 / 4");
  await expect(dau).toHaveText("Dành cho trang 1");
  await expect(khung(b).getByLabel("Viết lời hồi đáp")).toHaveValue("Nháp lượt một");

  // Mo thang toi mot to.
  await b.goto(`/sach/${id}?trang=4`);
  await expect(dau).toHaveText("Dành cho trang 4");

  // Hai trang: to 1 va to 2 thuoc hai luot, khung theo to ben phai.
  await b.setViewportSize({ width: 1280, height: 900 });
  await docSach(b, id);
  await expect(dem).toHaveText("Trang 1-2 / 4");
  await expect(dau).toHaveText("Dành cho trang 2 tới 3");
  await lat("Trang sau", "Trang 3-4 / 4");
  await expect(dau).toHaveText("Dành cho trang 4");
});

test("luot con niem phong: nguoi doc chi thay dong nhac, khong co o chu", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, ["Em tới sớm hơn giờ hẹn.", "Chuyện chưa kể ai nghe."], {
    kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [],
  });
  await docSach(b, id);
  await expect(khung(b).getByText("Mở niêm phong để hồi đáp.")).toBeVisible();
  await expect(khung(b).getByLabel("Viết lời hồi đáp")).toHaveCount(0);
  await docSach(a, id);
  await expect(khung(a).getByText("Chưa có lời hồi đáp.")).toBeVisible();
});

test("sach rieng tu va sach chia se chua co to: khong co khung, khong co cot phai", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);
  const rieng = await taoSach(a, "Cuốn riêng", "rieng-tu");
  await dangToThang(rieng, "Tờ một");
  await docSach(a, rieng);
  await expect(a.locator(".doc__khung")).toBeVisible();
  await expect(khung(a)).toHaveCount(0);
  await expect(a.locator(".doc-luoi")).toHaveCount(0);

  const trong = await taoSach(a, "Cuốn mới", "chia-se");
  await docSach(a, trong);
  await expect(a.getByRole("heading", { name: "Chưa có trang nào." })).toBeVisible();
  await expect(khung(a)).toHaveCount(0);
  await expect(a.locator(".doc-luoi")).toHaveCount(0);
});

test("bon be rong va man rong: khung duoi sach khi hep, ben phai sach khi rong; khong tran ngang; vung bam 44px", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");

  for (const width of BE_RONG) {
    await b.setViewportSize({ width, height: 900 });
    await docSach(b, id);
    await expect(khung(b).getByLabel("Viết lời hồi đáp")).toBeVisible();
    const [sach, k] = await Promise.all([hop(b.locator(".doc__khung")), hop(khung(b))]);
    expect(k.y, `${width}: khung nam duoi cuon sach`).toBeGreaterThanOrEqual(sach.y + sach.height);
    expect(await tranNgang(b), `${width}: tran ngang`).toEqual([]);
    if (width === BE_RONG_CHAM) {
      await khung(b).getByLabel("Viết lời hồi đáp").fill("Thương ghê.");
      await khung(b).getByRole("button", { name: "Gửi" }).click();
      await expect(khung(b).getByRole("button", { name: "Xem lại" })).toBeVisible();
      for (const el of await khung(b).locator("button, textarea").all()) {
        const h = await hop(el);
        expect(Math.min(h.width, h.height), `${width}: vung bam ${await el.textContent()}`).toBeGreaterThanOrEqual(44);
      }
      expect(await tranNgang(b), `${width}: tran ngang khi dang hoi lai`).toEqual([]);
    }
  }

  await b.setViewportSize({ width: 1280, height: 900 });
  await docSach(b, id);
  const [sach, k] = await Promise.all([hop(b.locator(".doc__khung")), hop(khung(b))]);
  expect(k.x, "1280: khung o cot phai").toBeGreaterThanOrEqual(sach.x + sach.width);
  expect(k.y, "1280: khung dung canh sach").toBeLessThan(sach.y + sach.height);
  expect(await tranNgang(b)).toEqual([]);
});

test("sach co nhac: khung chi hien sau Mo sach, nam ngay duoi the nhac, khong de len trinh phat", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");
  await datNhac(id, MA);
  await giaYoutube(b);

  for (const width of [1280, 375]) {
    await b.setViewportSize({ width, height: 900 });
    await b.goto(`/sach/${id}`);
    await expect(b.getByRole("button", { name: "Mở sách" })).toBeVisible();
    await expect(khung(b)).toHaveCount(0);
    await b.getByRole("button", { name: "Mở sách" }).click();
    await expect(khung(b).getByLabel("Viết lời hồi đáp")).toBeVisible();
    const the = b.getByRole("complementary", { name: "Nhạc nền" });
    const [may, theHop, k] = await Promise.all([hop(the.locator(".nhac-the__may")), hop(the), hop(khung(b))]);
    expect(Math.min(may.width, may.height), `${width}: trinh phat 200x200`).toBeGreaterThanOrEqual(200);
    expect(k.y, `${width}: khung nam duoi the nhac`).toBeGreaterThanOrEqual(theHop.y + theHop.height);
    expect(Math.abs(k.x - theHop.x), `${width}: cung mot cot`).toBeLessThanOrEqual(1);
    expect(await tranNgang(b)).toEqual([]);
  }
});

test("cuon toi cuoi cuon sach o 1280x720: khung hoi dap dinh ngay duoi the nhac, hay duoi thanh dieu huong khi khong nhac, khong bi gi che", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const coNhac = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(coNhac, "Tờ một", "Tờ hai", "Tờ ba");
  await datNhac(coNhac, MA);
  const khongNhac = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  await dangToThang(khongNhac, "Tờ một", "Tờ hai", "Tờ ba");
  await giaYoutube(b);
  await b.setViewportSize({ width: 1280, height: 720 });

  const cacCuon = [
    { id: coNhac, ten: "the nhac", tren: b.getByRole("complementary", { name: "Nhạc nền" }) },
    { id: khongNhac, ten: "thanh dieu huong", tren: b.getByRole("navigation", { name: "Điều hướng chính" }) },
  ];
  for (const { id, ten, tren } of cacCuon) {
    await docSach(b, id);
    await expect(khung(b).getByLabel("Viết lời hồi đáp")).toBeVisible();
    await b.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(async () => {
      // Trang phai that su da cuon, khong thi phep do duoi chi la do luc chua ai cuon.
      expect(await b.evaluate(() => window.scrollY), `${ten}: trang da cuon`).toBeGreaterThan(100);
      const [k, t] = await Promise.all([hop(khung(b)), hop(tren)]);
      expect(k.y, `khung hoi dap nam tron duoi ${ten}`).toBeGreaterThanOrEqual(t.y + t.height);
      expect(k.y + k.height, `${ten}: khung hoi dap nam tron trong khung nhin`).toBeLessThanOrEqual(720 + 1);
    }).toPass();
    await expect(khung(b).getByRole("button", { name: "Gửi", exact: true })).toBeInViewport();
  }
});
