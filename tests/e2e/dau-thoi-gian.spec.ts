import { expect, test } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datNhac, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG, BE_RONG_CHAM, vungBamNho, type MienTru } from "./vung-bam";
import { giaYoutube } from "./youtube-gia";

/*
 * Trang Dau thoi gian va ba loi vao cua no (diem 15 va 17 cua chu du an): muc tren thanh dieu huong dan qua trang chon
 * cuon, bam anh bia tren khung sach lon, va bam tieu de the Nhac nen. Cuon rieng tu cua nguoi kia phai la 404.
 */

const MA = "dQw4w9WgXcQ";

/**
 * Mien tru vung bam (co ten va ly do; phan tu van duoc do, qua vung bam that cua no):
 * - .dtg-dong .nhap__ten: ten sach tren trang chon cuon cua Dau thoi gian chi cao mot dong chu, nhung ::after cua no phu
 *   kin ca dong (`.dtg-dong{ position: relative }`, `.dtg-dong .nhap__ten::after{ position: absolute; inset: 0 }`),
 *   nen ca dong - bia, ten va dong dem - la vung bam.
 */
const MIEN_TRU: MienTru[] = [{ phanTu: ".dtg-dong .nhap__ten", vungBam: "li.dtg-dong" }];

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

test("vao tu thanh dieu huong qua trang chon cuon, roi toi luoi muoi hai thang cua cuon do", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");

  await a.goto("/ke-sach");
  await a.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Dấu thời gian" }).click();
  await expect(a).toHaveURL(new RegExp("/dau-thoi-gian$"));
  await expect(a.getByRole("heading", { level: 1, name: "Dấu thời gian" })).toBeVisible();
  // Dong phu dem o: cuon moi tao co dung o bia mo dau, chua co nhac.
  await expect(a.locator(".dtg-dong", { hasText: "Chuyện chưa kể" })).toContainText("Bạn, 1 bìa, 0 bản nhạc");

  await a.getByRole("link", { name: "Chuyện chưa kể" }).click();
  await expect(a).toHaveURL(new RegExp(`/dau-thoi-gian/${id}$`));
  await expect(a.getByRole("heading", { level: 1, name: "Chuyện chưa kể" })).toBeVisible();
  await expect(a.locator(".nam-o")).toHaveCount(12);
  // Thang dang chon san la thang cua dau moi nhat; khung chi tiet ke o mo dau.
  await expect(a.locator(".chi-tiet")).toContainText("Lúc tạo sách");
});

test("vao thang bang cach bam anh bia tren khung sach lon", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await a.goto("/ke-sach");
  const bia = a.getByRole("link", { name: "Dấu thời gian của Chuyện chưa kể" });
  await expect(bia).toBeVisible();
  // Bam bang chuot that vao giua anh bia: anh bia phai nam TREN lop phu cua khung sach, khong thi cu bam roi vao man doc.
  const hop = await bia.boundingBox();
  if (!hop) throw new Error("khong thay anh bia");
  await a.mouse.click(hop.x + hop.width / 2, hop.y + hop.height / 2);
  await expect(a).toHaveURL(new RegExp(`/dau-thoi-gian/${id}$`));
});

test("bam cho khac tren khung sach lon van toi man doc, nut chinh van la nut rieng", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await a.goto("/ke-sach");
  const khung = a.getByRole("article", { name: "Một trang trong sách" });
  const chu = await khung.locator(".vua-viet__chu").boundingBox();
  if (!chu) throw new Error("khong thay doan trich");
  await a.mouse.click(chu.x + chu.width / 2, chu.y + chu.height / 2);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(await khung.locator("a a").count(), "khong co lien ket long trong lien ket").toBe(0);
});

test("vao thang bang cach bam tieu de the Nhac nen o man doc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await datNhac(id, MA);
  await giaYoutube(a);
  await a.goto(`/sach/${id}`);
  const the = a.getByRole("complementary", { name: "Nhạc nền" });
  await expect(the).toBeVisible();
  // Chi dong tieu de la lien ket; khung phat khong nam trong lien ket nao.
  expect(await the.locator(".nhac-the__may").evaluate((el) => el.closest("a") === null)).toBe(true);
  await the.getByRole("link", { name: "Nhạc nền, xem dấu thời gian của cuốn này" }).click();
  await expect(a).toHaveURL(new RegExp(`/dau-thoi-gian/${id}$`));
  // O nhac mo dau hien trong luoi.
  await expect(a.locator(".nam-not").first()).toBeVisible();
});

test("cuon rieng tu cua nguoi kia: khong co trong trang chon cuon va trang cua no la 404", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const rieng = await taoSach(a, "Nhật ký riêng", "rieng-tu");
  const chung = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(chung, "Lượt đầu tiên.");

  await b.goto("/dau-thoi-gian");
  await expect(b.locator(".dtg-dong", { hasText: "Chuyện chưa kể" })).toBeVisible();
  await expect(b.locator("main")).not.toContainText("Nhật ký riêng");

  const r = await b.goto(`/dau-thoi-gian/${rieng}`);
  expect(r?.status()).toBe(404);
  // Cuon chia se cua nguoi kia thi xem duoc.
  const r2 = await b.goto(`/dau-thoi-gian/${chung}`);
  expect(r2?.status()).toBe(200);
});

test("hai trang Dau thoi gian voi ten sach dai: vung bam 44px va khong tran ngang o bon be rong", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể có một cái tên khá dài để thử tràn ngang", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  for (const duong of ["/dau-thoi-gian", `/dau-thoi-gian/${id}`]) {
    for (const w of BE_RONG) {
      await a.setViewportSize({ width: w, height: 900 });
      await a.goto(duong);
      if (w === BE_RONG_CHAM) expect(await vungBamNho(a, MIEN_TRU), `${duong}: vung bam`).toEqual([]);
      expect(await tranNgang(a), `${duong} o ${w}px: tran ngang`).toEqual([]);
    }
  }
});

test("re chuot tren anh bia thi bia khong tu doi", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  // Them o bia cho luot thu hai: sang trang Viet tiep chon bia, roi dang.
  await a.goto(`/sach/${id}/viet-tiep`);
  await a.getByRole("radio", { name: "Bìa khóm trúc" }).check();
  await a.getByRole("button", { name: "Viết trang" }).click();
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt thứ hai.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  await a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=[0-9]+$`));

  await a.goto("/ke-sach");
  const bia = a.getByRole("link", { name: "Dấu thời gian của Chuyện chưa kể" });
  await bia.hover();
  const truoc = await a.locator(".tranh-dan__bia").getAttribute("class");
  await a.waitForTimeout(11_500);
  expect(await a.locator(".tranh-dan__bia").getAttribute("class")).toBe(truoc);
});

test("khung chi tiet: anh bia khong de len chu; trang chon cuon: ten sach dai xuong dong tron ven", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const TEN = "Những bữa sáng ở quán cà phê cũ đầu ngõ";
  const id = await taoSach(a, TEN, "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  for (const w of [320, 1280]) {
    await a.setViewportSize({ width: w, height: 900 });

    // Ten sach la cach duy nhat phan biet hai cuon tren trang chon, nen khong duoc cat bang dau ba cham.
    await a.goto("/dau-thoi-gian");
    const ten = a.locator(".dtg-dong .nhap__ten");
    await expect(ten).toHaveText(TEN);
    const biCat = await ten.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    expect(biCat, `ten sach bi cat o ${w}px`).toBe(false);

    // Thang mac dinh la thang cua dau moi nhat: o bia mo dau cua cuon vua tao.
    await a.goto(`/dau-thoi-gian/${id}`);
    const dong = a.locator(".dtg-ct__dong").first();
    await expect(dong.locator(".dtg-ct__hinh svg")).toBeVisible();
    const hinh = await dong.locator(".dtg-ct__hinh").boundingBox();
    const chu = await dong.locator(".dtg-ct__chu").boundingBox();
    if (!hinh || !chu) throw new Error("khong thay dong chi tiet");
    expect(hinh.x + hinh.width, `anh bia de len chu o ${w}px`).toBeLessThanOrEqual(chu.x + 0.5);
  }
});
