import { test, expect, type Page, type Route } from "@playwright/test";
import { resetDb } from "./db";
import { docSach, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, niemPhongCua } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn.";
const TRA_LOI = "Anh nghĩ người này ăn hết hai bát bún mà vẫn thong thả thế.";
const TRAN = "Đã tràn sang trang 2, cần gọn lại";

/** Cac ban luu tam cua trang tra loi trong sessionStorage cua the dang mo. */
function banLuu(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.entries(sessionStorage)
      .filter(([k]) => k.startsWith("mqce-tra-loi-"))
      .map(([, v]) => v),
  );
}

/** Khong tran ngang o hai be rong dien thoai, roi tra ve be rong mac dinh. */
async function khongTranNgang(page: Page): Promise<void> {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await tranNgang(page), `${width}`).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("nguoi kia viet trang tra loi: tran thi khoa nut gui, chu con sau khi roi man, gui xong ca hai thay hai trang", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  const [s] = await niemPhongCua(id);
  const duong = `/sach/${id}/tra-loi/${s.id}`;
  expect((await a.goto(duong))?.status(), "chu sach").toBe(404);

  await docSach(b, id);
  await b.getByRole("link", { name: "Viết trang trả lời" }).click();
  await expect(b).toHaveURL(new RegExp(`${duong}$`));
  await expect(b.getByRole("heading", { level: 1, name: "Trang trả lời" })).toBeVisible();
  await expect(b.locator(".cau-hoi")).toContainText(`${tenCuaA} hỏi`);
  await expect(b.locator(".cau-hoi__chu")).toHaveText("Hôm đó em nghĩ gì?");
  const trangThai = b.locator(".viet-dau .vua-trang");
  await expect(trangThai).toHaveText("Vừa một trang");
  const giay = b.locator(".viet-chu .ProseMirror");
  await expect(giay).toHaveAttribute("aria-describedby", "vua-trang");
  expect(await tranNgang(b)).toEqual([]);

  await giay.click();
  for (let i = 0; i < 10; i++) {
    await b.keyboard.insertText(DOAN);
    await b.keyboard.press("Enter");
  }
  await expect(trangThai).toContainText(TRAN);
  await expect(b.getByRole("button", { name: "Gửi trả lời" })).toBeDisabled();
  await expect(b.locator(".het-cho")).toHaveAttribute("data-hien", "co");
  await expect(b.locator(".viet-to")).toHaveCount(1);
  await khongTranNgang(b);

  // Lien ket Ve sach dieu huong phia client, khong phat beforeunload: quay lai thi chu van con.
  // "Về sách" tro ve dung to cua trang niem phong dang tra loi, mo thang khong qua tam bia.
  await b.getByRole("link", { name: "Về sách" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=[0-9]+$`));
  await b.getByRole("link", { name: "Viết trang trả lời" }).click();
  // Doi tung moc san sang thay vi gop ca chuoi vao mot han: dieu huong, roi editor phia trinh duyet da dung
  // (immediatelyRender false nen .ProseMirror chi co sau khi tao editor), roi moi toi lan do sau khi khoi phuc chu.
  await expect(b).toHaveURL(new RegExp(`${duong}$`));
  await expect(giay).toBeVisible();
  await expect(trangThai).toContainText(TRAN);

  await giay.click();
  await b.keyboard.press("ControlOrMeta+A");
  await b.keyboard.press("Delete");
  await b.keyboard.insertText(TRA_LOI);
  await expect(trangThai).toHaveText("Vừa một trang");
  await b.getByRole("button", { name: "Gửi trả lời" }).click();
  const hoi = b.getByRole("group", { name: "Xác nhận gửi trả lời" });
  await expect(hoi).toContainText("Gửi xong thì cả hai trang cùng mở cho cả hai người.");
  await expect(giay).toHaveAttribute("contenteditable", "false");
  await khongTranNgang(b);
  await hoi.getByRole("button", { name: "Gửi", exact: true }).click();

  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  // Khong bam Escape: phim co the toi truoc khi nghi thuc gan bo nghe. Cho nghi thuc go xong (con tro bien mat),
  // han 15s dai hon thoi gian go. Bo qua nghi thuc bang Escape da co e2e trao doi rieng giu.
  await expect(b.locator(".sach .con-tro")).toHaveCount(0, { timeout: 15_000 });
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.getByRole("region", { name: "Trang trả lời" })).toContainText(TRA_LOI);

  await docSach(a, id);
  await expect(a.locator(".sach")).toContainText(BI_MAT);
  await expect(a.getByRole("region", { name: "Trang trả lời" })).toContainText(TRA_LOI);

  for (const d of [duong, `/sach/${id}/tra-loi/khong-phai-ma`, `/sach/${id}/tra-loi/00000000-0000-4000-8000-000000000000`]) {
    expect((await b.goto(d))?.status(), d).toBe(404);
  }
});

test("trang tra loi: trong thi khong gui, tai lai van con chu, gui hong giu chu, gui xong xoa ban luu tam", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  const [s] = await niemPhongCua(id);
  const duong = `/sach/${id}/tra-loi/${s.id}`;
  // .viet-dau .luu--loi thay vi getByRole("alert"): bo bao chuyen trang cua Next cung mang vai alert.
  const loi = b.locator(".viet-dau .luu--loi");
  const guiTraLoi = b.getByRole("button", { name: "Gửi trả lời" });
  const hoi = b.getByRole("group", { name: "Xác nhận gửi trả lời" });
  const giay = b.locator(".viet-chu .ProseMirror");
  // Doc bang JS thay vi dua vao hop hoi cua Chromium: su kien gia co huy duoc, listener goi preventDefault thi la dang canh bao.
  const canhBaoKhiRoi = () =>
    b.evaluate(() => {
      const ev = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    });

  // Trang trong, ke ca chi co khoang trang: khong mo hop, bao dung ly do, vung soan thao mo khoa lai.
  await b.goto(duong);
  await expect(giay).toBeVisible();
  await guiTraLoi.click();
  await expect(loi).toHaveText("Trang còn trống, chưa có gì để gửi.");
  await expect(hoi).toHaveCount(0);
  await expect(giay).toHaveAttribute("contenteditable", "true");
  expect(await canhBaoKhiRoi()).toBe(false);
  await giay.click();
  await b.keyboard.insertText("   ");
  await guiTraLoi.click();
  await expect(loi).toHaveText("Trang còn trống, chưa có gì để gửi.");
  await expect(hoi).toHaveCount(0);

  // Co chu thi canh bao khi roi trang; tai lai thi chu doc lai tu sessionStorage.
  await giay.click();
  await b.keyboard.press("ControlOrMeta+A");
  await b.keyboard.press("Delete");
  await b.keyboard.insertText(TRA_LOI);
  await expect.poll(canhBaoKhiRoi).toBe(true);
  // Neu Chromium hien hop hoi beforeunload thi dong y; khong hien thi tai lai van chay.
  const dongY = (d: { accept: () => Promise<void> }) => void d.accept();
  b.on("dialog", dongY);
  await b.reload();
  b.off("dialog", dongY);
  await expect(giay).toHaveText(TRA_LOI);
  // Khoi phuc khong vao lich su hoan tac: Ctrl+Z khong xoa chu vua khoi phuc.
  await giay.click();
  await b.keyboard.press("ControlOrMeta+Z");
  await expect(giay).toHaveText(TRA_LOI);

  // Gui hong: giu POST cua server action (header next-action, gui toi dung duong dan trang nay) roi cat no.
  let cho: Route | null = null;
  const laTrangNay = (u: URL) => u.pathname === duong;
  await b.route(laTrangNay, (r) => {
    if (r.request().method() === "POST" && r.request().headers()["next-action"]) cho = r;
    else void r.fallback();
  });
  await guiTraLoi.click();
  await hoi.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect.poll(() => cho !== null).toBe(true);
  // Dang cho action: vung soan thao khoa, go them khong vao duoc.
  await expect(giay).toHaveAttribute("contenteditable", "false");
  await expect(hoi.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled();
  await giay.click();
  await b.keyboard.insertText(" Chữ thêm lúc chờ.");
  await expect(giay).toHaveText(TRA_LOI);
  await (cho as Route | null)?.abort();
  await expect(loi).toHaveText("Mất kết nối lúc gửi. Kiểm tra mạng rồi thử lại. Chữ vẫn còn ở đây.");
  await expect(hoi).toHaveCount(0);
  await expect(giay).toHaveAttribute("contenteditable", "true");
  await expect(giay).toHaveText(TRA_LOI);
  const conLai = await banLuu(b);
  expect(conLai).toHaveLength(1);
  expect(conLai[0]).toContain(TRA_LOI);
  await b.unroute(laTrangNay);

  // Gui lai: mo hop qua Gui tra loi, gui xong thi ban luu tam bi xoa.
  await guiTraLoi.click();
  await hoi.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  expect(await banLuu(b)).toEqual([]);
});
