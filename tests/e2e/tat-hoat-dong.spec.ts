import { test, expect, type Locator, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangTrang, dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

/*
 * An hoat dong (06/10). Hop dong chu du an dat ra, dung bang vi du cua chinh ho: "khi toi tat hoat dong, va toi viet
 * sach thi nguoi ta van doc duoc trang moi do nhung ma khong thay tren khung hoat dong la toi co viet sach".
 *
 * Nen bai nay di DUONG UI THAT: dangToThang ghi thang SQL nen khong sinh dong Hoat dong nao, dung no la kiem mot cai
 * cong luon xanh. Moi lan dang o day deu qua man viet va nut Dang trang, tuc qua publishDraft va recordActivity.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const TEN_SACH = "Chuyện chưa kể";
const NHAC = "Hoạt động của bạn đang ẩn.";

/** Khung Hoat dong cua trang dang mo. */
const khung = (p: Page): Locator => p.locator("section.hoat-dong");
/** Vung cuon cua khung Hoat dong; chi co khi co it nhat mot dong. */
const cuon = (p: Page): Locator => p.getByRole("region", { name: "Hoạt động gần đây" });
/** Dong cua vung cuon co chua chu nay. */
const dong = (p: Page, chu: string): Locator => cuon(p).getByRole("listitem").filter({ hasText: chu });
/** The sach tren ke. */
const theSach = (p: Page, ten: string): Locator => p.locator(".cuon", { hasText: ten });
/** O danh dau o muc Hoat dong cua trang Cai dat. */
const oAn = (p: Page): Locator => p.getByRole("checkbox", { name: "Ẩn hoạt động của tôi" });

/**
 * Viet mot to vao cuon id roi dang, qua dung man viet va nut Dang trang.
 *
 * Cho man doc nap xong han truoc khi tra ve: dang trang xong la Next dieu huong sang man doc, va dieu huong tiep ngay
 * luc luong RSC cua man do chua chay het lam Next ghi "The destination stream closed early" vao dau ra. Mot nguoi that
 * thi dung lai nhin trang vua dang, nen cho o day la mo phong dung chu khong phai treo ban kiem.
 */
async function viet(p: Page, id: string, chu: string): Promise<void> {
  await p.goto(`/sach/${id}/viet`);
  await p.locator(".viet-chu .ProseMirror").click();
  await p.keyboard.insertText(chu);
  expect(await dangTrang(p)).toBe(1);
  await p.waitForLoadState("networkidle");
}

/**
 * Bat hay tat cong tac o Cai dat, roi khang dinh no da o dung trang thai VA lan luu da xong.
 *
 * Phai cho lan luu xong truoc khi dieu huong di: action goi refresh(), tuc mo mot luong RSC, va dieu huong giua luong
 * lam Next ghi "The destination stream closed early" vao dau ra. O danh dau tu `disabled` trong luc dang luu, nen cho
 * no duoc bat lai chinh la cho luong do chay het.
 */
async function dat(p: Page, bat: boolean): Promise<void> {
  await p.goto("/cai-dat");
  if (bat) await oAn(p).check();
  else await oAn(p).uncheck();
  await expect(oAn(p)).toBeChecked({ checked: bat });
  await expect(oAn(p)).toBeEnabled();
}

test("an hoat dong: viec moi khong len khung, nhung trang moi van toi tay nguoi kia", async ({ browser }) => {
  test.slow();
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, TEN_SACH, "chia-se");

  // 1. Mot to dang TRUOC khi bat. Dong nay phai con mai ve sau: bat tat khong sua lai qua khu.
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Chiều nay anh đi ngang hiệu sách cũ ở góc phố.");
  expect(await dangTrang(a)).toBe(1);
  await b.goto("/ke-sach");
  await expect(dong(b, `${tenCuaA} đăng 1 trang mới trong ${TEN_SACH}`)).toHaveCount(1);
  // Mot dong tao cuon va mot dong dang trang.
  await expect(cuon(b).getByRole("listitem")).toHaveCount(2);
  await expect(khung(b).getByText(NHAC)).toHaveCount(0);

  // 2. Bat cong tac, roi dang tiep mot to.
  await dat(a, true);
  await viet(a, id, "Hôm nay anh viết thêm một trang nữa cho em.");

  // 3. Nguoi kia: KHONG co dong moi nao, nhung VAN thay trang moi tren ke va mo doc duoc.
  await b.goto("/ke-sach");
  await expect(cuon(b).getByRole("listitem")).toHaveCount(2);
  await expect(theSach(b, TEN_SACH).locator(".dh--moi")).toHaveText("2 trang mới");
  await theSach(b, TEN_SACH).getByRole("link", { name: TEN_SACH }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}`));
  // Cho man doc nap xong: bo do no roi de afterEach dong context se chat dut luong RSC, va Next ghi
  // "The destination stream closed early" vao dau ra test.
  await b.waitForLoadState("networkidle");

  // 4. Chinh nguoi bat cung khong thay dong do, va thay dong nhac o dau khung.
  await a.goto("/ke-sach");
  await expect(khung(a).getByText(NHAC)).toBeVisible();
  await expect(dong(a, `Bạn đăng 1 trang mới trong ${TEN_SACH}`)).toHaveCount(1);
  await expect(cuon(a).getByRole("listitem")).toHaveCount(2);

  // 5. Tat lai: dong moi hien lai binh thuong, con quang bi an van an mai.
  await dat(a, false);
  await viet(a, id, "Trang thứ ba, viết lúc đã bỏ ẩn.");
  await a.goto("/ke-sach");
  await expect(khung(a).getByText(NHAC)).toHaveCount(0);
  await expect(cuon(a).getByRole("listitem")).toHaveCount(3);
  await b.goto("/ke-sach");
  await expect(cuon(b).getByRole("listitem")).toHaveCount(3);
});

test("an hoat dong khong lo ra o trinh doc man hinh hay trong du lieu trang", async ({ browser }) => {
  test.slow();
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  // Bat an TRUOC khi tao sach, nen ca dong tao-sach lan dong dang-trang deu bi an: khong chua loai nao.
  await dat(a, true);
  const id = await taoSach(a, TEN_SACH, "chia-se");
  await viet(a, id, "Trang nay dang bi an khoi khung Hoat dong.");

  // Khong chi la an bang CSS: cau cua dong ("dang 1 trang moi") va dong tao cuon khong duoc co trong khung Hoat dong
  // cua ai ca, cung khong duoc nam trong HTML hay du lieu RSC cua trang.
  for (const p of [a, b]) {
    await p.goto("/ke-sach");
    await p.waitForLoadState("networkidle");
    const chu = await khung(p).innerText();
    expect(chu).not.toContain("đăng 1 trang mới");
    expect(chu).not.toContain("tạo cuốn");
  }
  const html = await b.content();
  expect(html).not.toContain(`${tenCuaA} đăng 1 trang mới`);
});
