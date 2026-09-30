import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { coSach, docSach, dongContextCu, haiNguoiDaVao, taoSach, tranNgang, vietTranTrang } from "./kho-sach";
import { BE_RONG, BE_RONG_CHAM, vungBamNho, type MienTru } from "./vung-bam";

/*
 * Sach viet cung "Hai Ngòi Bút" (dot nam 5c, spec muc K2) tren trinh duyet that: moi tu Sach moi, nhan loi o Ke sach, ca
 * hai viet voi nhap rieng, dang bat buoc ten luot, man doc co dong dau trang va "Các lượt" ma cho ngat trang khong doi,
 * xin viet cung, tu choi, rut loi moi, de nghi xoa roi giu lai roi dong y xoa; tran ngang va vung bam 44px o cac man moi.
 * a la Manh (tao cuon), b la Linh.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Radio 20px nam trong the chon (BookForm.tsx): ca the la vung bam, nhu vung-bam.spec.ts. */
const MIEN_TRU: MienTru[] = [{ phanTu: ".the-chon input", vungBam: "label.the-chon" }];

const DA_LUU = new RegExp("^Đã lưu lúc [0-9]{2}:[0-9]{2}$");

/** a tao cuon "Những bữa sáng" voi lua chon Viet cung Linh; tra ma sach, trang dung o man viet. */
async function taoVaMoi(a: Page): Promise<string> {
  await a.goto("/sach/moi");
  await a.getByRole("radio", { name: "Viết cùng Linh" }).check();
  await a.getByLabel("Chủ đề").fill("Những bữa sáng");
  await a.getByRole("button", { name: "Tạo và mời Linh" }).click();
  await a.waitForURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
  return new URL(a.url()).pathname.split("/")[2];
}

/** b nhan loi moi o Ke sach; cuon sang ke Hai Ngòi Bút. */
async function nhanLoi(b: Page): Promise<void> {
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-moi__chu")).toHaveText("Mạnh mời bạn viết cùng Những bữa sáng");
  await b.getByRole("button", { name: "Nhận lời" }).click();
  await expect(b.getByRole("region", { name: "Hai Ngòi Bút" })).toBeVisible();
  await expect(b.locator(".loi-moi")).toHaveCount(0);
}

/** Go mot doan o man viet dang mo va cho tu luu xong. */
async function goVaLuu(p: Page, chu: string): Promise<void> {
  await p.locator(".viet-chu .ProseMirror").click();
  await p.keyboard.insertText(chu);
  await expect(p.getByText(DA_LUU)).toBeVisible({ timeout: 15_000 });
}

/** Nut Luu cua form sach (Sua sach con co nut luu tung o cua hai dong thoi gian). */
const luuForm = (p: Page) => p.locator(".form__nut").getByRole("button", { name: "Lưu", exact: true });

/** Dang luot dang soan voi ten luot, doi toi man doc. */
async function dangLuot(p: Page, ten: string): Promise<void> {
  await p.getByRole("button", { name: "Đăng trang" }).click();
  const hop = p.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hop.getByLabel("Tên lượt")).toBeFocused();
  await hop.getByLabel("Tên lượt").fill(ten);
  await hop.getByRole("button", { name: "Đăng", exact: true }).click();
  await p.waitForURL(new RegExp("/sach/[0-9a-f-]{36}[?]trang=[0-9]+$"));
}

test("moi, nhan loi, ca hai viet voi nhap rieng, dang bat buoc ten luot, man doc co dong dau trang va Cac luot", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoVaMoi(a);

  // Loi moi cho: the cuon cua a mang dau "Chờ Linh nhận lời".
  await a.goto("/ke-sach");
  await expect(a.locator(".dh--cho")).toHaveText("Chờ Linh nhận lời");
  await nhanLoi(b);

  // Hai nhap rieng: nhap cua a khong bao gio hien o man viet cua b.
  await a.goto(`/sach/${id}/viet`);
  await goVaLuu(a, "Sáng nay anh ăn bánh cuốn Thanh Trì.");
  await b.goto(`/sach/${id}/viet`);
  await expect(b.locator(".viet-chu .ProseMirror")).not.toContainText("bánh cuốn");
  await goVaLuu(b, "Em ăn xôi xéo đầu ngõ.");

  // Hop Dang trang cua sach viet cung: khong co niem phong; thieu ten thi nhac va focus ve o ten.
  await a.getByRole("button", { name: "Đăng trang" }).click();
  const hop = a.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hop.getByRole("radio")).toHaveCount(0);
  await hop.getByRole("button", { name: "Đăng", exact: true }).click();
  await expect(hop.getByRole("alert")).toHaveText("Đặt tên cho lượt này rồi hãy đăng nhé.");
  await expect(hop.getByLabel("Tên lượt")).toBeFocused();
  await hop.getByLabel("Tên lượt").fill("Bánh cuốn Thanh Trì");
  await hop.getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=1$`));

  // b van con nguyen nhap cua minh, viet tran sang to sau roi dang luot cua minh.
  await b.goto(`/sach/${id}/viet`);
  await expect(b.locator(".viet-chu .ProseMirror")).toContainText("xôi xéo");
  await vietTranTrang(b);
  await dangLuot(b, "Xôi xéo đầu ngõ");

  // Man doc cua a: dong phu hai nguoi, Cac luot thay khung hoi dap, dong dau trang, nut sua chi o luot cua minh.
  await a.goto(`/sach/${id}?trang=2`);
  await expect(a.locator(".doc-head__sub")).toContainText("Mạnh và Linh viết");
  await expect(a.getByRole("heading", { name: "Các lượt" })).toBeVisible();
  await expect(a.getByRole("heading", { name: "Lời hồi đáp" })).toHaveCount(0);
  const muc = a.locator(".cac-luot__ds .luot");
  await expect(muc).toHaveCount(2);
  await expect(muc.nth(0)).toContainText("Bánh cuốn Thanh Trì");
  await expect(muc.nth(1)).toContainText("Xôi xéo đầu ngõ");
  await expect(muc.nth(1)).toHaveAttribute("aria-current", "true");
  // Man rong mo hai trang: to 1 (luot cua Manh) va to 2 (luot cua Linh). Moi to mang dong dau trang cua dung luot.
  await expect(a.locator(".to-giay .dau-trang").filter({ hasText: "Xôi xéo đầu ngõ" }).first()).toContainText("Linh");
  await expect(a.locator(".to-giay .dau-trang").filter({ hasText: "Bánh cuốn Thanh Trì" }).first()).toContainText("Mạnh");
  // Nut sua chi o to cua luot minh viet.
  await expect(a.getByRole("link", { name: "Sửa trang 1" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Sửa trang 2" })).toHaveCount(0);

  // Dong dau trang nam trong le tren, khong de len vung chu; vung chu khong tran (cho ngat trang giu nguyen).
  const doDau = await a.evaluate(() => Array.from(document.querySelectorAll(".to-giay")).flatMap((to) => {
    const dau = to.querySelector(".dau-trang");
    const chu = to.querySelector(".giay-noi-dung");
    if (!dau || !chu) return [];
    return [{ duoiDau: dau.getBoundingClientRect().bottom, trenChu: chu.getBoundingClientRect().top, tran: chu.scrollHeight > chu.clientHeight + 1 }];
  }));
  expect(doDau.length).toBeGreaterThan(0);
  for (const d of doDau) {
    expect(d.duoiDau).toBeLessThanOrEqual(d.trenChu + 0.5);
    expect(d.tran).toBe(false);
  }

  // Bam mot luot trong Cac luot la toi trang dau cua luot do.
  await muc.nth(0).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=1$`));
  await expect(a.getByRole("link", { name: "Sửa trang 1" })).toBeVisible();

  // Ke Hai Ngòi Bút cua ca hai: so luot, hai chu cai dau.
  await b.goto("/ke-sach");
  const ke = b.getByRole("region", { name: "Hai Ngòi Bút" });
  await expect(ke.locator(".cuon__phu")).toContainText("2 lượt");
  await expect(ke.locator(".cuon__doi span")).toHaveText(["M", "L"]);
});

test("xin viet cung, tu choi, xin lai, dong y; doi ten luot o Sua luot", async ({ browser }) => {
  test.setTimeout(200_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chạy bộ mùa thu", "chia-se");
  await goVaLuu(a, "Năm cây số quanh hồ.");
  await a.getByRole("button", { name: "Đăng trang" }).click();
  await a.getByRole("group", { name: "Xác nhận đăng trang" }).getByRole("button", { name: "Đăng", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}[?]trang=1$`));

  // b xin: hoi lai roi moi gui; sau do nut thanh dong cho.
  await docSach(b, id);
  await b.getByRole("button", { name: "Xin viết cùng" }).click();
  await b.getByRole("group", { name: "Gửi lời xin tới Mạnh?" }).getByRole("button", { name: "Gửi lời xin" }).click();
  await expect(b.getByText("Đã xin, chờ Mạnh")).toBeVisible();

  // a tu choi o Ke sach: dong bien mat, cuon giu nguyen.
  await a.goto("/ke-sach");
  await expect(a.locator(".loi-moi__chu")).toHaveText("Linh xin viết cùng Chạy bộ mùa thu");
  await a.getByRole("button", { name: "Từ chối" }).click();
  await expect(a.locator(".loi-moi")).toHaveCount(0);
  await expect(a.getByRole("region", { name: "Hai Ngòi Bút" })).toHaveCount(0);

  // b xin lai, a dong y: cuon sang Hai Ngòi Bút; luot cu tu mang ten "Lượt 1".
  await docSach(b, id);
  await b.getByRole("button", { name: "Xin viết cùng" }).click();
  await b.getByRole("button", { name: "Gửi lời xin" }).click();
  await a.goto("/ke-sach");
  await a.getByRole("button", { name: "Đồng ý" }).click();
  await expect(a.getByRole("region", { name: "Hai Ngòi Bút" })).toBeVisible();
  await a.goto(`/sach/${id}?trang=1`);
  await expect(a.locator(".cac-luot__ds .luot").first()).toContainText("Lượt 1");

  // a doi ten luot cu cua minh o Sua luot.
  await a.goto(`/sach/${id}/sua-luot/1`);
  await expect(a.getByLabel("Tên lượt")).toHaveAttribute("placeholder", "Lượt 1");
  await a.getByLabel("Tên lượt").fill("Quanh hồ Tây");
  await a.getByRole("button", { name: "Lưu tên" }).click();
  await expect(a.getByText("Đã lưu tên.")).toBeVisible();
  await a.goto(`/sach/${id}?trang=1`);
  await expect(a.locator(".cac-luot__ds .luot").first()).toContainText("Quanh hồ Tây");
  // b khong vao duoc man sua luot cua a.
  const r = await b.goto(`/sach/${id}/sua-luot/1`);
  expect(r?.status()).toBe(404);
});

test("rut loi moi o Sua sach; de nghi xoa, giu lai, roi dong y xoa han", async ({ browser }) => {
  test.setTimeout(200_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Góc riêng", "rieng-tu");

  // Moi tu Sua sach roi rut lai bang cach chon lai Chia se.
  await a.goto(`/sach/${id}/sua`);
  await a.getByRole("radio", { name: "Viết cùng Linh" }).check();
  await expect(a.locator(".ghi-chung")).toContainText("Bấm Lưu là gửi lời mời.");
  await luuForm(a).click();
  await a.waitForURL(new RegExp(`/sach/${id}$`));
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-moi__chu")).toHaveText("Mạnh mời bạn viết cùng Góc riêng");
  await a.goto(`/sach/${id}/sua`);
  await expect(a.getByRole("radio", { name: "Viết cùng Linh" })).toBeChecked();
  await a.getByRole("radio", { name: "Chia sẻ", exact: true }).check();
  await luuForm(a).click();
  await a.waitForURL(new RegExp(`/sach/${id}$`));
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-moi")).toHaveCount(0);

  // Moi lai va b nhan loi.
  await a.goto(`/sach/${id}/sua`);
  await a.getByRole("radio", { name: "Viết cùng Linh" }).check();
  await luuForm(a).click();
  await a.waitForURL(new RegExp(`/sach/${id}$`));
  await b.goto("/ke-sach");
  await b.getByRole("button", { name: "Nhận lời" }).click();
  await expect(b.getByRole("region", { name: "Hai Ngòi Bút" })).toBeVisible();

  // Sua sach cua sach viet cung: Chu de, dong khoa, muc Xoa cuon.
  await a.goto(`/sach/${id}/sua`);
  await expect(a.getByLabel("Chủ đề")).toBeVisible();
  await expect(a.getByRole("radio", { name: "Viết cùng Linh" })).toHaveCount(0);
  await a.getByRole("button", { name: "Đề nghị xóa" }).click();
  await expect(a.getByText("Bạn đã đề nghị xóa.")).toBeVisible();

  // b giu lai o Ke sach.
  await b.goto("/ke-sach");
  await expect(b.locator(".loi-moi__chu")).toHaveText("Mạnh đề nghị xóa Góc riêng");
  await b.getByRole("button", { name: "Giữ lại" }).click();
  await expect(b.locator(".loi-moi")).toHaveCount(0);
  expect(await coSach(id)).toBe(true);

  // a de nghi lai; b dong y xoa (hoi lai mot lan) thi cuon mat han.
  await a.goto(`/sach/${id}/sua`);
  await a.getByRole("button", { name: "Đề nghị xóa" }).click();
  await expect(a.getByText("Bạn đã đề nghị xóa.")).toBeVisible();
  await b.goto("/ke-sach");
  await b.getByRole("button", { name: "Đồng ý xóa" }).click();
  await b.getByRole("group", { name: "Xóa hẳn Góc riêng?" }).getByRole("button", { name: "Xóa hẳn" }).click();
  await expect(b.getByRole("region", { name: "Hai Ngòi Bút" })).toHaveCount(0);
  await expect.poll(() => coSach(id)).toBe(false);
});

test("man moi cua sach viet cung khong tran ngang o bon be rong; vung bam 44px o be rong cam ung", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoVaMoi(a);
  await nhanLoi(b);
  await a.goto(`/sach/${id}/viet`);
  await goVaLuu(a, "Sáng nay anh ăn bánh cuốn Thanh Trì, ngồi ở cái ghế nhựa đỏ cạnh gốc bàng.");
  await dangLuot(a, "Một cái tên lượt rất dài để thử xem dòng đầu trang có cắt gọn không");
  // Mot loi moi khac con cho: ke cua b co dong de nghi.
  await taoVaMoi(a);

  const man: { ten: string; trang: Page; duong: string; cho: (p: Page) => Promise<void> }[] = [
    { ten: "ke sach co de nghi", trang: b, duong: "/ke-sach", cho: async (p) => expect(p.locator(".loi-moi")).toHaveCount(1) },
    { ten: "sach moi chon viet cung", trang: a, duong: "/sach/moi", cho: async (p) => {
      await p.getByRole("radio", { name: "Viết cùng Linh" }).check();
      await expect(p.getByLabel("Chủ đề")).toBeVisible();
    } },
    { ten: "sua sach viet cung", trang: b, duong: `/sach/${id}/sua`, cho: async (p) => expect(p.getByRole("heading", { name: "Xóa cuốn" })).toBeVisible() },
    { ten: "man doc viet cung", trang: b, duong: `/sach/${id}?trang=1`, cho: async (p) => expect(p.getByRole("heading", { name: "Các lượt" })).toBeVisible() },
    { ten: "sua luot co ten luot", trang: a, duong: `/sach/${id}/sua-luot/1`, cho: async (p) => expect(p.getByLabel("Tên lượt")).toBeVisible() },
    { ten: "hop dang trang voi o ten luot", trang: b, duong: `/sach/${id}/viet`, cho: async (p) => {
      await p.locator(".viet-chu .ProseMirror").click();
      await p.keyboard.insertText("Em ăn xôi xéo đầu ngõ. ");
      await p.getByRole("button", { name: "Đăng trang" }).click();
      await expect(p.getByRole("group", { name: "Xác nhận đăng trang" }).getByLabel("Tên lượt")).toBeVisible();
    } },
  ];
  for (const width of BE_RONG) {
    for (const m of man) {
      await m.trang.setViewportSize({ width, height: 900 });
      await m.trang.goto(m.duong);
      await m.cho(m.trang);
      expect(await tranNgang(m.trang), `${m.ten} o ${width}px`).toEqual([]);
      if (width === BE_RONG_CHAM) expect(await vungBamNho(m.trang, MIEN_TRU), `${m.ten}: vung bam`).toEqual([]);
    }
  }
});
