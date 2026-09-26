import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datNhac, docSach, dongContextCu, haiNguoiDaVao, moSach, taoSach } from "./kho-sach";
import { anhPng, giaMicro, tepMau } from "./media";
import { batMayHong, GOC_MAY_HONG } from "./may-hong";
import { dangKemNiemPhong, niemPhongCua } from "./niem-phong";
import { baoYt, ghiYt, giaYoutube } from "./youtube-gia";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const MA = "dQw4w9WgXcQ";
/** Ma trang thai PLAYING cua YouTube IFrame API. */
const PHAT = 1;
/** Mot mien khong co trong chinh sach nao, dung lam phep thu am de chung minh may nghe that su chay. */
const MIEN_LA = "https://example.com/";
const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";

/** Cua so co gan danh sach vi pham cua tai lieu dang mo. */
type CuaSoCoViPham = { viPhamCsp?: string[] };

/**
 * Gan may nghe vi pham CSP cho MOI tai lieu trang nay mo tu day ve sau. Phai goi TRUOC lan goto can theo doi.
 * Su kien securitypolicyviolation bat duoc ca thu trinh duyet chan ma khong in ra console.
 */
async function ngheViPham(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as CuaSoCoViPham;
    w.viPhamCsp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.viPhamCsp?.push(`${e.effectiveDirective} <- ${e.blockedURI}`);
    });
  });
}

/** Vi pham CSP cua tai lieu DANG mo. Doc truoc khi roi trang, vi danh sach nam trong chinh tai lieu do. */
function viPhamCua(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as CuaSoCoViPham).viPhamCsp ?? []);
}

/**
 * white-space cua trang giay dang viet. Gia tri nay chi den tu the <style> TipTap chen luc chay (xem
 * src/components/editor/nonce.ts); the do bi CSP chan thi o day con "normal" va man viet mat cach xuong dong.
 */
function khoangTrangCuaGiay(page: Page): Promise<string> {
  return page.locator(".viet-chu .ProseMirror").evaluate((el) => getComputedStyle(el).whiteSpace);
}

/**
 * Trang dang mo co mac giao dien cua web khong: nen cua <body> dung bang token --color-paper (do bang mot phan
 * tu thu dat nen var(--color-paper), nen token doi gia tri thi test khong phai sua), token do co that (CSS cua
 * web da nap), va phong Lexend da nap xong. Trang mac dinh cua Next khong co token nao va khong nap phong nao.
 */
async function coGiaoDienCuaWeb(page: Page): Promise<void> {
  const nen = await page.evaluate(() => {
    const thu = document.createElement("div");
    thu.style.background = "var(--color-paper)";
    document.body.append(thu);
    const giay = getComputedStyle(thu).backgroundColor;
    thu.remove();
    return { body: getComputedStyle(document.body).backgroundColor, giay };
  });
  expect(nen.giay, "token --color-paper khong co: CSS cua web chua nap").not.toBe("rgba(0, 0, 0, 0)");
  expect(nen.body, "nen <body> khong phai mau giay cua web").toBe(nen.giay);
  await expect
    .poll(() => page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.includes("Lexend") && f.status === "loaded");
    }), { message: "phong Lexend cua web chua nap" })
    .toBe(true);
}

/** Dong console cua trinh duyet ma Chromium in ra khi chan mot tai nguyen vi CSP. */
function laDongCsp(text: string): boolean {
  return /Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(text);
}

/** Gom moi dong console noi ve CSP cua mot trang, tu luc goi ham nay. */
function gomConsoleCsp(page: Page): string[] {
  const dong: string[] = [];
  page.on("console", (m) => {
    if (laDongCsp(m.text())) dong.push(m.text());
  });
  return dong;
}

test("header Content-Security-Policy co that tren response, mang nonce moi cho tung request, va Next gan dung nonce do vao the script", async ({ page }) => {
  // src/proxy.ts dat nham ten thanh middleware.ts thi tep khong chay va khong co loi nao bao: chi cach doc
  // header tren mot response THAT moi bat duoc. /cho khong cham database nen khang dinh nay dung ca khi
  // chua co tai khoan nao, dung luc moc "san sang" cua webServer goi toi no.
  const res = await page.goto("/cho");
  expect(res, "khong co response cho /cho").not.toBeNull();
  expect(res?.status()).toBe(200);
  const csp = res?.headers()["content-security-policy"];
  expect(csp, "thieu han header Content-Security-Policy").toBeDefined();

  const nonce = new RegExp("'nonce-([A-Za-z0-9+/_-]+={0,2})'").exec(csp ?? "");
  expect(nonce, `header khong co nonce: ${csp}`).not.toBeNull();
  const ma = nonce?.[1] ?? "";

  // Tung nguon ngoai duy nhat, ghi du ten mien: mot lan doi mien nham la do ngay o day.
  expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
  expect(csp).toContain("media-src 'self' blob:");
  expect(csp).toContain("img-src 'self' data: blob:");
  expect(csp).toContain("worker-src 'self' blob:");
  expect(csp).toContain("connect-src 'self' blob:");
  expect(csp).toContain("'strict-dynamic'");
  expect(csp, "ban phat hanh khong duoc co 'unsafe-eval'").not.toContain("'unsafe-eval'");

  // Nonce trong header phai la nonce that su nam tren the script cua trang: day moi la bang chung Next da
  // doc dung header ma proxy dat. Header va HTML lay tu CUNG MOT response. Doc HTML tho vi trinh duyet giau gia
  // tri thuoc tinh nonce khoi DOM.
  const html = (await res?.text()) ?? "";
  const cuaHtml = [...html.matchAll(new RegExp('nonce="([A-Za-z0-9+/_-]*={0,2})"', "g"))].map((m) => m[1]);
  expect(cuaHtml.length, "HTML tra ve khong co the script nao mang nonce").toBeGreaterThan(0);
  expect(new Set(cuaHtml), "moi nonce trong HTML phai dung la nonce cua header cung response").toEqual(new Set([ma]));

  // Moi request mot nonce moi: lan hai phai khac lan mot.
  const lanHai = await page.request.get("/cho");
  const cspHai = lanHai.headers()["content-security-policy"];
  const nonceHai = new RegExp("'nonce-([A-Za-z0-9+/_-]+={0,2})'").exec(cspHai ?? "")?.[1];
  expect(nonceHai).not.toBeUndefined();
  expect(nonceHai, "hai request lien tiep dung chung mot nonce").not.toBe(ma);
});

test("may nghe vi pham that su hoat dong: mot khung tu mien la bi chan va bi ghi lai", async ({ page }) => {
  // Phep thu am. Khong co no thi ba khang dinh "khong co vi pham nao" ben duoi co the xanh chi vi may nghe
  // chua bao gio chay. Trinh duyet chan ngay tai trang, khong request nao di ra mang.
  await ngheViPham(page);
  await page.goto("/cho");
  await page.evaluate((mien) => {
    const khung = document.createElement("iframe");
    khung.src = mien;
    document.body.append(khung);
  }, MIEN_LA);
  await expect.poll(() => viPhamCua(page)).toEqual(["frame-src <- https://example.com"]);
});

test("khong mot vi pham CSP nao tren cac man chinh, ke ca o man viet va man doc", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const dongConsole = gomConsoleCsp(a);
  const dongConsoleB = gomConsoleCsp(b);
  await ngheViPham(a);
  await ngheViPham(b);
  await giaMicro(a);

  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "trao-doi", question: "Hôm đó em nghĩ gì?" });
  const [s] = await niemPhongCua(id);

  const cacMan: [string, () => Promise<unknown>][] = [
    ["/ke-sach", () => expect(a.getByRole("heading", { level: 1, name: "Kệ sách" })).toBeVisible()],
    ["/sach/moi", () => expect(a.getByLabel("Tên sách")).toBeVisible()],
    [`/sach/${id}/viet`, () => expect(a.locator(".viet-chu .ProseMirror")).toBeVisible()],
    // Moi cuon mo qua tam bia (chu du an chot 26/09): do ca man doc sau khi bam "Mở sách".
    [`/sach/${id}`, async () => {
      await moSach(a);
      await expect(a.locator(".doc__khung")).toBeVisible();
    }],
    [`/sach/${id}/sua`, () => expect(a.getByLabel("Tên sách")).toBeVisible()],
    ["/ban-nhap", () => expect(a.getByRole("heading", { level: 1, name: "Bản nháp" })).toBeVisible()],
    ["/cai-dat", () => expect(a.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible()],
    ["/cho", () => expect(a.getByRole("heading", { level: 1, name: "Đang chờ" })).toBeVisible()],
    // notFound() cua man doc (sach khong co): trang 404 cua web, trong layout goc nen cung phai sach vi pham.
    ["/sach/khong-co-cuon-nay", () => expect(a.getByRole("heading", { level: 1, name: "Không thấy trang này" })).toBeVisible()],
  ];

  for (const [duong, hien] of cacMan) {
    const res = await a.goto(duong);
    expect(res?.headers()["content-security-policy"], `${duong}: thieu header CSP`).toBeDefined();
    await hien();
    if (duong.endsWith("/viet")) expect(await khoangTrangCuaGiay(a), "man viet: the <style> cua TipTap da ap").toBe("break-spaces");
    expect(await viPhamCua(a), `${duong}: co vi pham CSP`).toEqual([]);
  }

  // Nguon blob: duoi may nghe vi pham. media-src blob: la chi thi de quen nhat: ban ghi am nghe thu TRUOC KHI
  // chen phat tu mot blob: URL. Ghi, dung, phat ban nghe thu va doi no phat that (currentTime tien len).
  await a.goto(`/sach/${id}/viet`);
  await a.getByRole("button", { name: "Ghi âm" }).click();
  const hopGhi = a.getByRole("region", { name: "Ghi âm", exact: true });
  await expect(hopGhi).toBeVisible();
  await expect(hopGhi.getByRole("timer")).toHaveAttribute("aria-label", new RegExp("Đã ghi (?!0:00)"), { timeout: 20_000 });
  await hopGhi.getByRole("button", { name: "Dừng" }).click();
  const ngheThu = a.getByRole("region", { name: "Nghe thử" });
  // CSP chan blob: thi khoi nghe thu bao "Chua tai duoc ghi am", the audio va nut phat bien mat: doi toi khi hoac
  // nut phat hien, hoac da co vi pham, roi kiem vi pham TRUOC de loi do ra dung ten chi thi thay vi treo o cu bam.
  const nutPhat = ngheThu.getByRole("button", { name: "Phát ghi âm" });
  await expect.poll(async () => (await viPhamCua(a)).length > 0 || (await nutPhat.isVisible()), { timeout: 10_000 }).toBe(true);
  expect(await viPhamCua(a), "ban ghi am nghe thu (blob:): co vi pham CSP").toEqual([]);
  await expect(ngheThu.locator("audio")).toHaveAttribute("src", new RegExp("^blob:"));
  await nutPhat.click({ timeout: 10_000 });
  await expect
    .poll(() => ngheThu.locator("audio").evaluate((el) => (el as HTMLAudioElement).currentTime), { timeout: 10_000 })
    .toBeGreaterThan(0);
  expect(await viPhamCua(a), "ban ghi am nghe thu (blob:) sau khi phat: co vi pham CSP").toEqual([]);

  // img-src blob:: buoc cat anh bia ve anh vua chon tu mot blob: URL. Nap lai chinh URL do bang mot <img> va doi
  // decode(): chi xong khi anh nap duoc, CSP chan thi tu choi. Luc no xong, the <image> cua trang cung da nap.
  await a.goto("/sach/moi");
  await a.getByLabel("Thêm ảnh của bạn làm bìa").setInputFiles({
    name: "bia.png", mimeType: "image/png", buffer: await anhPng(a, 800, 600),
  });
  const anhCat = a.getByRole("group", { name: "Khung cắt ảnh bìa" }).locator("image");
  await expect(anhCat).toHaveAttribute("href", new RegExp("^blob:"));
  const napAnh = await anhCat.evaluate((el) => {
    const img = new Image();
    img.src = el.getAttribute("href") ?? "";
    return img.decode().then(() => "da nap", (e: unknown) => String(e));
  });
  // Vi pham truoc, de loi do ra dung ten chi thi; roi moi toi ket qua nap.
  expect(await viPhamCua(a), "anh bia xem thu (blob:): co vi pham CSP").toEqual([]);
  expect(napAnh, "anh xem thu cua bia (blob:) phai nap duoc").toBe("da nap");

  // worker-src va connect-src co blob:: bo doc anh iPhone (heic-to) giai ma trong mot Worker tao tu blob: (worker-src),
  // roi chinh Worker do doc tep nguoi dung chon qua mot blob: URL (connect-src). San cat hien dung kich thuoc nghia la
  // worker da chay xong duoi CSP that.
  await a.getByRole("button", { name: "Hủy", exact: true }).click();
  await a.getByLabel("Thêm ảnh của bạn làm bìa").setInputFiles(tepMau("plain.heic"));
  await expect(a.getByRole("group", { name: "Khung cắt ảnh bìa" }).locator("svg").first())
    .toHaveAttribute("viewBox", "0 0 120 80", { timeout: 20_000 });
  expect(await viPhamCua(a), "bo doc anh iPhone (Worker blob:): co vi pham CSP").toEqual([]);

  // Trang tra loi (trinh viet thu hai), mo bang CHUYEN TRANG ben trong ung dung nhu nguoi dung that: tai lieu
  // khong tai lai nen nonce phai la nonce cua lan tai dau tien, khong phai cua lan lay du lieu RSC.
  await docSach(b, id);
  await b.getByRole("link", { name: "Viết trang trả lời" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}/tra-loi/${s.id}$`));
  await expect(b.getByRole("heading", { level: 1, name: "Trang trả lời" })).toBeVisible();
  expect(await khoangTrangCuaGiay(b), "trang tra loi qua chuyen trang: the <style> cua TipTap da ap").toBe("break-spaces");
  expect(await viPhamCua(b), "trang tra loi qua chuyen trang: co vi pham CSP").toEqual([]);
  // Va tai thang trang tra loi.
  await b.reload();
  await expect(b.getByRole("heading", { level: 1, name: "Trang trả lời" })).toBeVisible();
  expect(await khoangTrangCuaGiay(b), "trang tra loi tai thang: the <style> cua TipTap da ap").toBe("break-spaces");
  expect(await viPhamCua(b), "trang tra loi tai thang: co vi pham CSP").toEqual([]);
  expect(dongConsoleB, "console cua nguoi thu hai co dong noi ve CSP").toEqual([]);

  // Man dang nhap la trang tinh truoc khi co CSP, nen no chinh la cho de vo nhat: doi context de khong bi
  // day ve /ke-sach.
  const khach = await (await browser.newContext()).newPage();
  try {
    await ngheViPham(khach);
    const res = await khach.goto("/dang-nhap");
    expect(res?.headers()["content-security-policy"], "/dang-nhap: thieu header CSP").toBeDefined();
    await expect(khach.getByLabel("Mật khẩu người kia gửi cho bạn")).toBeVisible();
    await khach.getByLabel("Mật khẩu người kia gửi cho bạn").fill("sai-mat-khau-de-kiem");
    expect(await viPhamCua(khach), "/dang-nhap: co vi pham CSP").toEqual([]);
  } finally {
    await khach.context().close();
  }

  expect(dongConsole, "console cua trinh duyet co dong noi ve CSP").toEqual([]);
});

test("duong dan khong co: trang 404 tieng Viet mac giao dien cua web, ma 404, khong mot vi pham CSP", async ({ page }) => {
  // Truoc khi co src/app/not-found.tsx, duong dan la roi vao trang 404 tieng Anh mac dinh cua Next.
  const dongConsole = gomConsoleCsp(page);
  await ngheViPham(page);
  const res = await page.goto("/khong-co-trang-nay");
  expect(res?.status()).toBe(404);
  expect(res?.headers()["content-security-policy"], "trang 404: thieu header CSP").toBeDefined();
  await expect(page.getByRole("heading", { level: 1, name: "Không thấy trang này" })).toBeVisible();
  await coGiaoDienCuaWeb(page);
  await expect(page.getByRole("link", { name: "Về trang chính" })).toHaveAttribute("href", "/");
  expect(await viPhamCua(page), "trang 404: co vi pham CSP").toEqual([]);
  expect(dongConsole, "trang 404: console co dong noi ve CSP").toEqual([]);
});

test("database khong toi duoc: trang loi tieng Viet mac giao dien cua web, khong lo chi tiet loi, khong mot vi pham CSP", async ({ page }) => {
  // Loi that: mot may chu thu hai chay cung ban build nhung DATABASE_URL tro toi cong khong co gi (may-hong.ts).
  // "/" doc bang accounts nen nem loi ket noi; error.tsx phai do no, trong layout goc, duoi CSP binh thuong.
  test.setTimeout(120_000);
  const may = await batMayHong();
  try {
    const dongConsole = gomConsoleCsp(page);
    await ngheViPham(page);
    const res = await page.goto(`${GOC_MAY_HONG}/`);
    expect(res?.status()).toBe(500);
    expect(res?.headers()["content-security-policy"], "trang loi: thieu header CSP").toBeDefined();
    await expect(page.getByRole("heading", { level: 1, name: "Trang chưa mở được" })).toBeVisible();
    await coGiaoDienCuaWeb(page);
    // Loi may chu co digest de doi voi log; chi tiet cua loi (driver, dia chi, chuoi ket noi) khong bao gio hien.
    await expect(page.getByText(new RegExp("^Mã lỗi: [0-9A-Za-z]+$"))).toBeVisible();
    const chu = await page.locator("body").innerText();
    for (const loRi of ["ECONNREFUSED", "127.0.0.1", "khong_co", "postgres"]) expect(chu, `trang loi lo "${loRi}"`).not.toContain(loRi);
    await expect(page.getByRole("link", { name: "Về trang chính" })).toHaveAttribute("href", "/");

    // Thu lai: database van khong toi duoc nen van la trang loi, nhung nut phai chay that (lay lai du lieu) va
    // khong lam vo trang.
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Trang chưa mở được" })).toBeVisible();
    expect(await viPhamCua(page), "trang loi: co vi pham CSP").toEqual([]);
    expect(dongConsole, "trang loi: console co dong noi ve CSP").toEqual([]);
  } finally {
    await may.dung();
  }
});

test("nhac nen van phat duoc duoi CSP: script iframe_api tu chen van nap, trinh phat van chay", async ({ browser }) => {
  // Chung minh DUOC: 'strict-dynamic' cho script iframe_api ma src/components/music/youtubeApi.ts tu chen bang
  // document.createElement (script do van chay, tuc CSP khong chan no), va duong noi trinh phat cua man doc van chay
  // duoi CSP (tao trinh phat, bam Mo sach, phat, doi nhan nut). Buoc o day lap lai duong di cua nhac-nen.spec.ts.
  // KHONG chung minh duoc frame-src: giaYoutube (youtube-gia.ts) chan moi request toi youtube(-nocookie).com va
  // thay YT.Player bang ban gia tao khung about:blank, ma khung about:blank khong chiu frame-src. Goc that ma
  // frame-src mo duoc kiem o tests/unit/csp.test.ts (khop YT_HOST), con khung YouTube that chi chay o buoc tu kiem
  // nhac nen trong docs/huong-dan-phat-hanh.md.
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba");
  await datNhac(id, MA);

  const dongConsole = gomConsoleCsp(b);
  await ngheViPham(b);
  await giaYoutube(b);

  await b.goto(`/sach/${id}`);
  const the = b.getByRole("complementary", { name: "Nhạc nền" });
  const nut = the.locator(".nhac-the__dk .btn");
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  // YT.Player da duoc tao: tuc the script chen vao head KHONG bi CSP chan.
  expect(await ghiYt(b), "khong tao duoc trinh phat: script iframe_api co the da bi CSP chan").toEqual({ created: 1, play: 0, pause: 0 });
  await expect(the.locator(".nhac-the__may iframe")).toHaveAttribute("title", "Nhạc nền");

  await b.getByRole("button", { name: "Mở sách" }).click();
  await expect.poll(async () => (await ghiYt(b)).play).toBe(1);
  await baoYt(b, PHAT);
  await expect(nut).toHaveText("Tắt nhạc");

  expect(await viPhamCua(b), "man doc co nhac: co vi pham CSP").toEqual([]);
  expect(dongConsole, "console cua trinh duyet co dong noi ve CSP").toEqual([]);
});
