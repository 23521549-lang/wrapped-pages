import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { conTroKhi, dangKemNiemPhong, gioSau, khongLo, luiGioMo, luiMocThu, niemPhongCua } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
/** Doan dai de nghi thuc mo keo dai khoang 5,4 giay (300 ky tu, 18ms), du de thay con tro truoc khi bam bo qua. */
const DAI = "Mình ngồi tới lúc quán tắt đèn. Anh kể chuyện hồi nhỏ trốn học đi câu cá, em kể chuyện con mèo nhà bà ngoại. Toàn chuyện chẳng đâu vào đâu. Lúc về, anh đi trước em nửa bước, cứ quay lại nhìn như sợ em lạc.";
const GOI_Y_1 = "Quán ở gần bến xe, chỉ có bốn cái bàn.";
const GOI_Y_2 = "Trên trời có, lúc mưa thì sẫm lại.";
const TRA_LOI = "Anh nghĩ người này ăn hết hai bát bún mà vẫn thong thả thế.";

/**
 * Man doc vua tai (URL phai co mo cua dung niem phong): dem con tro ngay trong khung hinh khung sach het an (conTroKhi).
 * Flipbook chi hien khung sau khi biet che do, trong useLayoutEffect cung lan commit voi cong nghi thuc cua Reader;
 * neu nghi thuc chay thi luc do con tro da tren trang.
 */
async function khongNghiThuc(page: Page): Promise<void> {
  expect(await conTroKhi(page, "khung-hien"), "khong co nghi thuc").toBe(0);
  await expect(page.locator(".sach")).toContainText(DAI);
}

/**
 * Nghi thuc dang chay: thay con tro, roi bam Escape toi khi con tro mat. Trinh nghe phim cua TypeReveal gan sau
 * mot nhip nen bam lai. Han 4 giay ngan hon 5,4 giay cua nghi thuc: qua duoc nghia la phim da bo qua nghi thuc.
 */
async function boQuaNghiThuc(page: Page): Promise<void> {
  await expect(page.locator(".sach .con-tro")).toHaveCount(1);
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page.locator(".sach .con-tro")).toHaveCount(0, { timeout: 300 });
  }).toPass({ timeout: 4_000 });
  await expect(page.locator(".sach")).toContainText(DAI);
}

/**
 * Man dang mo khong tran ngang o 320, 375, 414 va 768, roi tra ve khung Desktop Chrome. Doi co che do sach
 * lat va ti le thu phong chay sau su kien doi kich thuoc, nen hoi lai toi khi het tran thay vi doc mot lan.
 */
async function khongTranHep(page: Page, nhan: string): Promise<void> {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => tranNgang(page), { message: `${nhan} o ${width}px` }).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("cau do: goi y nho giot, ha nhiet, tra loi dung thi trang mo voi nghi thuc mot lan; ke sach truoc va sau; nguoi viet thay nhat ky go cua", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], {
    kind: "cau-do", question: "Quán mình ngồi đợi nhau tên là gì?", answers: ["Quán Mây"], hints: [GOI_Y_1, GOI_Y_2],
  });
  const [s] = await niemPhongCua(id);

  // Reader cua nguoi kia gui moc da doc sau khi to 1 hien (server action). Doi dung response do, khong doi gio.
  const daGuiMoc = b.waitForResponse((r) => r.request().method() === "POST" && "next-action" in r.request().headers());
  await b.goto(`/sach/${id}`);
  await expect(b.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await expect(b.locator(".sach .giay-noi-dung p").first()).toHaveText(HE_LO);
  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await expect(khung.locator(".cau-hoi")).toContainText(`${tenCuaA} hỏi`);
  await expect(khung.locator(".con-lan")).toHaveText("Còn 5 lần");
  await khongLo(b, BI_MAT, DAI, "quan may", GOI_Y_1, GOI_Y_2);

  // Da mo sach ma to khoa van la trang moi: markRead khong cho moc vuot to khoa. Doan trich la dong he lo.
  await daGuiMoc;
  await b.goto("/ke-sach");
  const the = b.locator(".cuon", { hasText: "Chuyện chưa kể" });
  const ganNhat = b.getByRole("article", { name: "Trang gần nhất" });
  await expect(the.locator(".dh--moi")).toHaveText("1 trang mới");
  await expect(the.locator(".dh--khoa")).toHaveText("1 trang khóa");
  await expect(ganNhat.locator(".he-lo")).toHaveText(HE_LO);
  await khongLo(b, BI_MAT, DAI, "quan may", GOI_Y_1, GOI_Y_2);

  // mo= gia khi con khoa: van la to khoa, khong nghi thuc, khong lo chu.
  await b.goto(`/sach/${id}?trang=1&mo=${s.id}`);
  expect(await conTroKhi(b, "khung-hien"), "khong co nghi thuc").toBe(0);
  await expect(b.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await khongLo(b, BI_MAT, DAI, "quan may", GOI_Y_1, GOI_Y_2);

  // Ve URL khong co mo, de lan chuyen trang cua dap an dung doi URL that.
  await b.goto(`/sach/${id}`);
  const traLoi = async (chuoi: string, sau: string) => {
    await khung.getByLabel("Câu trả lời").fill(chuoi);
    await khung.getByRole("button", { name: "Mở trang" }).click();
    await expect(khung.locator(".con-lan")).toHaveText(sau);
  };

  await traLoi("quán cà phê", "Chưa đúng. Còn 4 lần");
  await expect(khung.locator(".goi-y")).toHaveCount(0);
  await traLoi("quán bánh bao", "Chưa đúng. Còn 3 lần");
  await expect(khung.locator(".goi-y")).toHaveCount(1);
  await expect(khung.locator(".goi-y").first()).toHaveText(`Gợi ý 1${GOI_Y_1}`);
  // Lan sai vua roi lam moi bang server action: du lieu RSC moi khong vao DOM, nen tai lai roi moi soi.
  await b.reload();
  await expect(khung.locator(".goi-y")).toHaveCount(1);
  await khongLo(b, BI_MAT, DAI, "quan may", GOI_Y_2);
  await traLoi("quán cóc", "Chưa đúng. Còn 2 lần");
  await traLoi("quán nhỏ", "Chưa đúng. Còn 1 lần");
  await expect(khung.locator(".goi-y")).toHaveCount(2);

  await khung.getByLabel("Câu trả lời").fill("quán gió");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(khung.locator(".con-lan")).toHaveText("Thử lại sau 10 phút");
  await expect(khung.getByLabel("Câu trả lời")).toBeDisabled();
  await expect(khung.getByRole("button", { name: "Mở trang" })).toBeDisabled();
  await khongTranHep(b, "khung cau do dang cho");

  await luiMocThu(s.id, 11);
  await b.reload();
  await expect(khung.locator(".con-lan")).toHaveText("Còn 5 lần");
  await expect(khung.getByLabel("Câu trả lời")).toBeEnabled();
  await khongLo(b, BI_MAT, DAI, "quan may");

  await khung.getByLabel("Câu trả lời").fill("quán mây!");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  await boQuaNghiThuc(b);
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.getByRole("region", { name: "Câu đố", exact: true })).toHaveCount(0);

  // Mot lan trong tab: tai lai ngay (URL van co mo, van trong RITUAL_WINDOW_MS nen may chu van tra ritual) thi hien thang.
  await b.reload();
  await khongNghiThuc(b);

  // Ke sach sau khi mo: het chip khoa, doan trich la chu that. newCount khong kiem: no phu thuoc moc gui tre 600ms.
  await b.goto("/ke-sach");
  await expect(b.locator(".ke-dau__phu")).toHaveText(new RegExp("^1 cuốn(, [0-9]+ trang mới)?$"));
  await expect(the.locator(".dh--khoa")).toHaveCount(0);
  await expect(ganNhat.locator(".trang-khoa")).toHaveCount(0);
  await expect(ganNhat.locator(".vua-viet__chu")).toContainText(BI_MAT);

  // Chu sach mo dung URL co mo: khong nghi thuc (ritual chi cua nguoi kia tu mo).
  await a.goto(`/sach/${id}?trang=1&mo=${s.id}`);
  await khongNghiThuc(a);
  const cuaToi = a.getByRole("region", { name: "Câu đố của bạn" });
  await expect(cuaToi.locator(".thu-thach__dau .meta")).toContainText(`${tenCuaB} đã mở`);
  const nhatKy = cuaToi.getByRole("list", { name: "Nhật ký gõ cửa" }).getByRole("listitem");
  await expect(nhatKy).toHaveCount(6);
  await expect(nhatKy.first()).toContainText("“quán mây!”");
  await expect(nhatKy.first().locator(".chip")).toHaveText("Đúng");
  await expect(cuaToi.locator(".go-cua .chip", { hasText: "Sai" })).toHaveCount(5);
  await expect(cuaToi.getByRole("button", { name: "Tặng chìa khóa" })).toHaveCount(0);
  await khongTranHep(a, "nhat ky go cua");
});

test("hen gio: chu sach cung bi khoa; dem nguoc cham 0 tren trang dang mo thi trang tu mo, khong nghi thuc; mo= gia cung khong", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Thư gửi năm ba mươi", "chia-se");
  // Mo sau 2 toi 3 phut (datetime-local lam tron xuong phut), qua moc toi thieu 1 phut. Cac buoc khoa ben duoi xong
  // trong vai chuc giay, truoc gio mo that; toi gio la do test tu lui opens_at va tu nhay dong ho.
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], { kind: "hen-gio", opensAt: await gioSau(a, 3 * 60_000) });
  const [s] = await niemPhongCua(id);

  // dangKemNiemPhong ket thuc bang chuyen trang phia trinh duyet: tai lai de soi ban may chu ve that.
  await a.reload();
  await expect(a.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await expect(a.getByRole("region", { name: "Hẹn giờ" }).getByRole("timer")).toBeVisible();
  await expect(a.getByRole("button", { name: "Tặng chìa khóa" })).toHaveCount(0);
  await khongLo(a, BI_MAT, DAI);

  // Dong ho gia cho ca context cua B, cai truoc khi tai trang. URL co mo that cua hen gio nay.
  await b.clock.install();
  await b.goto(`/sach/${id}?trang=1&mo=${s.id}`);
  const henGio = b.getByRole("region", { name: "Hẹn giờ" });
  await expect(henGio.getByRole("timer")).toBeVisible();
  await expect(b.locator(".sach .dau-niem")).toHaveText("Đang niêm phong");
  await khongLo(b, BI_MAT, DAI);
  await khongTranHep(b, "khung hen gio");

  // May chu thay da toi gio; dong ho cua trang nhay qua 0. Dau tren window con nguyen nghia la lam moi tai cho.
  await luiGioMo(s.id);
  await b.evaluate(() => {
    (window as unknown as { chuaTaiLai?: boolean }).chuaTaiLai = true;
  });
  await b.clock.fastForward(4 * 60_000);
  // Khung bien mat va to doi noi dung trong cung lan lam moi: dem con tro ngay trong khung hinh dong ho bien mat.
  expect(await conTroKhi(b, "het-hen-gio"), "khong co nghi thuc").toBe(0);
  await expect(henGio).toHaveCount(0);
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.locator(".sach")).toContainText(DAI);
  await expect(b.locator(".sach .dau-niem")).toHaveCount(0);
  expect(await b.evaluate(() => (window as unknown as { chuaTaiLai?: boolean }).chuaTaiLai), "lam moi, khong tai lai").toBe(true);

  // Hen gio da mo, URL co mo= (gia voi hen gio): ca hai doc duoc, khong nghi thuc.
  await a.goto(`/sach/${id}?trang=1&mo=${s.id}`);
  await khongNghiThuc(a);
  await expect(a.locator(".sach")).toContainText(BI_MAT);
  await expect(a.locator(".sach .dau-niem")).toHaveCount(0);
  await expect(a.getByRole("region", { name: "Hẹn giờ" })).toHaveCount(0);
  await b.reload();
  await khongNghiThuc(b);
  await expect(henGio).toHaveCount(0);
});

test("trao doi: gui trang tra loi thi nghi thuc chay that, tai lai trong tab thi khong; khung trao doi khong tran o man hep", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  const [s] = await niemPhongCua(id);

  await b.goto(`/sach/${id}`);
  const traoDoi = b.getByRole("region", { name: "Trao đổi", exact: true });
  await expect(traoDoi).toBeVisible();
  await khongLo(b, BI_MAT, DAI);
  await khongTranHep(b, "khung trao doi");

  await traoDoi.getByRole("link", { name: "Viết trang trả lời" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}/tra-loi/${s.id}$`));
  await b.locator(".viet-chu .ProseMirror").click();
  await b.keyboard.insertText(TRA_LOI);
  await expect(b.locator(".viet-dau .vua-trang")).toHaveText("Vừa một trang");
  await b.getByRole("button", { name: "Gửi trả lời" }).click();
  await b.getByRole("group", { name: "Xác nhận gửi trả lời" }).getByRole("button", { name: "Gửi", exact: true }).click();

  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  await boQuaNghiThuc(b);
  await expect(b.locator(".sach")).toContainText(BI_MAT);

  // Mot lan trong tab: tai lai ngay thi hien thang.
  await b.reload();
  await khongNghiThuc(b);
  await expect(b.getByRole("region", { name: "Trang trả lời" })).toContainText(TRA_LOI);
  await khongTranHep(b, "khung trang tra loi");
});

test("tang chia khoa: chuyen trang khong kem mo; tab cu cua nguoi kia gui dap an sau do cung khong co nghi thuc", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT, DAI], { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] });
  const [s] = await niemPhongCua(id);

  // Tab cua nguoi kia mo truoc khi duoc tang, o tra loi con dung duoc.
  await b.goto(`/sach/${id}`);
  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await expect(khung.getByLabel("Câu trả lời")).toBeEnabled();

  const cuaToi = a.getByRole("region", { name: "Câu đố của bạn" });
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  await cuaToi.getByRole("button", { name: "Tặng chìa khóa" }).click();
  // Dong nay chi co sau khi action da chuyen trang va trang ve lai, nen URL doc ngay sau do la URL cua action.
  await expect(cuaToi.locator(".thu-thach__dau .meta")).toContainText(`${tenCuaB} đã mở`);
  expect(new URL(a.url()).searchParams.get("mo"), "tang chia khoa khong kem mo").toBeNull();

  // Tab cu chua lam moi gui mot dap an bat ky: may chu tra "da mo" va chuyen trang kem mo, nhung nguoi kia
  // khong tu mo (khong co lan tra loi dung) nen ritual la false.
  await khung.getByLabel("Câu trả lời").fill("gì cũng được");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  await khongNghiThuc(b);
  await expect(b.locator(".sach")).toContainText(BI_MAT);
});
