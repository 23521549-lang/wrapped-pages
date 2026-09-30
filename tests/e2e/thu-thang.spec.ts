import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datDauLuotMoi, dongContextCu, ghiTamTrang, ghiThu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG, vungBamNhoCoLich } from "./vung-bam";
import { giaYoutube } from "./youtube-gia";
import { khoangThang, tenThang, thangKhoa } from "@/lib/tam-trang/lich";
import { thangVuaKhep } from "@/lib/thu";

/*
 * Thu thang (dot nam 5b, spec E, F): nhac o Ke sach cho ca hai nguoi, viet o Lich hoa (cho thu luon chi mot thu), nguoi
 * kia thay la thu troi o moi trang, mo doc va tra loi ngay trong cua so thu; khong ai xem lai duoc thu cua minh. Tong ket
 * thang thu gon va tha xuong. Nguoi A la Mạnh, nguoi B la Linh.
 */

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

const THANG = thangVuaKhep(new Date());
const KHOA = thangKhoa(THANG);
const TEN = tenThang(THANG);
const TEN_HOA = `${TEN.charAt(0).toUpperCase()}${TEN.slice(1)}`;
/** Chim bay xong va trang lam moi: vai giay. */
const CHO_CHIM_MS = 15_000;

/** Gui thu o to giay dang hien (Lich hoa hay cua so thu): go chu, Gửi thư, xac nhan Gửi. */
async function guiThu(noi: ReturnType<Page["locator"]>, chu: string): Promise<void> {
  await noi.getByRole("textbox").fill(chu);
  await noi.getByRole("button", { name: "Gửi thư" }).click();
  await noi.getByRole("group", { name: "Xác nhận gửi thư" }).getByRole("button", { name: "Gửi", exact: true }).click();
}

test("thu thang: nhac o Ke sach, viet o Lich hoa, nguoi kia mo la thu troi va tra loi; khong ai xem lai thu cua minh", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);

  // Nhac ca hai nguoi, tu ngay 1 thang moi toi khi chinh minh gui.
  await a.goto("/ke-sach");
  const nhacA = a.getByRole("link", { name: `${TEN_HOA} đã khép, viết thư cho Linh` });
  await expect(nhacA).toBeVisible();
  await expect(nhacA).toHaveAttribute("href", `/tam-trang#thu-${KHOA}`);
  await b.goto("/ke-sach");
  await expect(b.getByRole("link", { name: `${TEN_HOA} đã khép, viết thư cho Mạnh` })).toBeVisible();

  // Bam dong nhac: sang Lich hoa, o thang do tha xuong, trang cuon toi to giay.
  await nhacA.click();
  await expect(a).toHaveURL(new RegExp(`/tam-trang#thu-${KHOA}$`));
  const tomA = a.getByRole("button", { name: new RegExp(`^${TEN_HOA}, ${THANG.y}`) });
  await expect(tomA).toHaveAttribute("aria-expanded", "true");
  const choA = a.locator(`[data-cho-thu="${KHOA}"]`);
  await expect(choA.getByRole("textbox", { name: "Thư của bạn gửi Linh" })).toBeInViewport();

  // Viet va gui: hoi lai truoc khi gui; gui xong cho thu thanh dong cho, khong con chu nao cua thu minh.
  await guiThu(choA, "Tháng này anh nắng nhiều.");
  await expect(choA.locator(".thu-la--dong")).toContainText("Thư của bạn đã tới tay Linh.", { timeout: CHO_CHIM_MS });
  expect(await a.content()).not.toContain("Tháng này anh nắng nhiều.");
  await a.goto("/ke-sach");
  await expect(a.locator(".ke-thu")).toHaveCount(0);
  await expect(a.locator(".hoat-dong__chu", { hasText: `Bạn đã gửi thư ${TEN} cho Linh` })).toHaveCount(1);

  // Nguoi kia: la thu troi o goc tren ben phai o moi trang, dong nhac doi cau, dong Hoat dong.
  await b.goto("/ke-sach");
  await expect(b.locator(".ke-thu")).toHaveText(`Mạnh đã viết thư ${TEN} cho bạn`);
  await expect(b.locator(".hoat-dong__chu", { hasText: `Mạnh đã viết thư ${TEN} cho bạn` })).toHaveCount(1);
  const la = b.getByRole("button", { name: `Mạnh gửi bạn thư ${TEN}. Bấm để đọc` });
  await expect(la).toBeVisible({ timeout: CHO_CHIM_MS });
  await b.goto("/cai-dat");
  await expect(la).toBeVisible({ timeout: CHO_CHIM_MS });

  // Bam la thu: cua so doc thu, thu cua Mạnh va to giay tra loi; tra loi xong cua so dong, la thu het.
  await la.click({ force: true });
  const hop = b.getByRole("dialog", { name: `Thư ${TEN} của Mạnh` });
  await expect(hop).toBeVisible();
  await expect(hop.locator(".thu-la__than")).toHaveText("Tháng này anh nắng nhiều.");
  await expect(hop.getByText("Viết thư trả lời Mạnh")).toBeVisible();
  await guiThu(hop, "Em cũng vậy, cảm ơn anh.");
  await expect(hop).toHaveCount(0, { timeout: CHO_CHIM_MS });
  await expect(la).toHaveCount(0);
  expect(await b.content()).not.toContain("Em cũng vậy, cảm ơn anh.");

  // Lich hoa cua Linh: cho thu la thu cua Mạnh, khong con to giay, khong co thu cua minh.
  await b.goto(`/tam-trang#thu-${KHOA}`);
  const choB = b.locator(`[data-cho-thu="${KHOA}"]`);
  await expect(choB.getByRole("article", { name: `Thư ${TEN} của Mạnh` })).toContainText("Tháng này anh nắng nhiều.");
  await expect(choB.getByRole("textbox")).toHaveCount(0);
  expect(await b.content()).not.toContain("Em cũng vậy, cảm ơn anh.");

  // Mạnh: la thu cua Linh bay toi; da gui roi nen cua so chi co nut Đóng; Lich hoa hien thu cua Linh.
  await a.goto("/ke-sach");
  const laA = a.getByRole("button", { name: `Linh gửi bạn thư ${TEN}. Bấm để đọc` });
  await expect(laA).toBeVisible({ timeout: CHO_CHIM_MS });
  await laA.click({ force: true });
  const hopA = a.getByRole("dialog", { name: `Thư ${TEN} của Linh` });
  await expect(hopA.locator(".thu-la__than")).toHaveText("Em cũng vậy, cảm ơn anh.");
  await expect(hopA.getByRole("textbox")).toHaveCount(0);
  await hopA.getByRole("button", { name: "Đóng" }).click();
  await expect(hopA).toHaveCount(0);
  await a.goto(`/tam-trang#thu-${KHOA}`);
  await expect(a.locator(`[data-cho-thu="${KHOA}"]`).getByRole("article")).toContainText("Em cũng vậy, cảm ơn anh.");
  expect(await a.content()).not.toContain("Tháng này anh nắng nhiều.");
});

test("thu toi luc dang mo trang: la thu troi hien ma khong tai lai (hoi moi 20 giay)", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await a.emulateMedia({ reducedMotion: "reduce" });
  await a.goto("/ke-sach");
  await expect(a.locator(".thu-bay")).toHaveCount(0);
  await ghiThu("Linh", KHOA, "Thư tới giữa chừng.");
  await expect(a.getByRole("button", { name: `Linh gửi bạn thư ${TEN}. Bấm để đọc` })).toBeVisible({ timeout: 30_000 });
});

test("tong ket thang: o thu gon voi cau danh gia, bam thi tha xuong so lieu; tran ngang va vung bam o bon be rong", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const { from } = khoangThang(THANG);
  for (let d = 0; d < 8; d++) {
    const luc = new Date(from.getTime() + (d * 24 + 10) * 3_600_000);
    await ghiTamTrang("Mạnh", "nang-am", luc);
    await ghiTamTrang("Linh", d < 3 ? "nang-am" : "mua-phun", luc);
  }
  await a.goto("/tam-trang");
  const tom = a.getByRole("button", { name: new RegExp(`^${TEN_HOA}, ${THANG.y}`) });
  await expect(tom).toHaveAttribute("aria-expanded", "false");
  await expect(tom).toContainText("Bạn nắng gần cả tháng, Linh hay mưa phùn");
  await expect(tom).toContainText("Chưa ai viết thư");
  await tom.click();
  await expect(tom).toHaveAttribute("aria-expanded", "true");
  const vung = a.locator(`#thg-${KHOA}`);
  await expect(vung).toContainText("16 bông, 3 ngày cùng một trời");
  await expect(vung.getByText("3 ngày hai người cùng một trời")).toBeVisible();
  await expect(vung.getByRole("textbox", { name: "Thư của bạn gửi Linh" })).toBeVisible();

  for (const w of BE_RONG) {
    await a.setViewportSize({ width: w, height: 800 });
    await expect(vung.getByRole("textbox")).toBeVisible();
    expect(await tranNgang(a), `${w}px: tran ngang`).toEqual([]);
    expect(await vungBamNhoCoLich(a), `${w}px: vung bam`).toEqual([]);
  }
});

test("la thu troi khong bao gio de len khung YouTube: cham khung phat thi tam an", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Những bữa sáng", "chia-se");
  await dangToThang(id, "Lượt một.");
  await datDauLuotMoi(id, { youtubeId: "dQw4w9WgXcQ" });
  await ghiThu("Linh", KHOA, "Thư chờ đọc.");
  await giaYoutube(a);
  await a.emulateMedia({ reducedMotion: "reduce" });
  await a.setViewportSize({ width: 375, height: 700 });
  await a.goto(`/dau-thoi-gian/${id}`);
  const khung = a.locator("aside.mph iframe");
  await expect(khung).toBeAttached();
  // Dua khung phat len sat mep tren, dung cho la thu troi.
  await khung.evaluate((el) => {
    const r = el.getBoundingClientRect();
    scrollBy(0, r.top - 70);
  });
  await expect(a.locator(".thu-bay")).toHaveClass(/thu-bay--tranh/);
  const tren = await a.evaluate(() => {
    const k = document.querySelector("aside.mph iframe");
    if (!k) throw new Error("khong co khung phat");
    const r = k.getBoundingClientRect();
    return [[r.right - 12, r.top + 12], [r.left + r.width / 2, r.top + 12]].map(([x, y]) => document.elementFromPoint(x, y)?.tagName);
  });
  expect(tren).toEqual(["IFRAME", "IFRAME"]);
  await a.evaluate(() => scrollTo(0, 0));
  await expect(a.locator(".thu-bay")).not.toHaveClass(/thu-bay--tranh/);
});
