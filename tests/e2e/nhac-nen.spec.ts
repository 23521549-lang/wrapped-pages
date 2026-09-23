import { test, expect, type Locator, type Page } from "@playwright/test";
import { quaNuaTrongKhung, type KhungChuNhat } from "@/lib/viewport";
import { resetDb } from "./db";
import { dangToThang, datNhac, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, niemPhongCua } from "./niem-phong";
import { baoYt, ghiYt, giaYoutube, lucPhat } from "./youtube-gia";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const MA = "dQw4w9WgXcQ";
const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const CAU_DO = { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] } as const;
const PHAT = 1;
const DUNG = 2;
/** Bon be rong phai khong tran ngang va be rong nho nhat con hai cot cua man doc co nhac. */
const BE_RONG = [320, 375, 414, 768, 981];

async function hop(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const h = await l.boundingBox();
  if (!h) throw new Error("phan tu khong hien");
  return h;
}

/** Khung cua mot phan tu so voi khung nhin, doc tu trinh duyet. */
function khungCua(l: Locator): Promise<KhungChuNhat> {
  return l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  });
}

/**
 * Phan tu tren cung o hai goc tren cua khung trinh phat, dinh khung so voi khung nhin va vi tri cuon, doc trong cung
 * mot khung hinh. Diem do lui 2px tu mep tren; theo chieu ngang lui dung ban kinh bo goc, vi khung bo goc va
 * overflow hidden nen diem sat goc hon nam ngoai khung. Nav phu ca be ngang nen diem nay van bat duoc nav dinh.
 * Khong gi de len trinh phat, ke ca thanh nav, thi ca hai goc la IFRAME.
 */
function gocTren(page: Page): Promise<{ goc: (string | undefined)[]; dinh: number; cuon: number }> {
  return page.evaluate(() => {
    const may = document.querySelector(".nhac-the__may");
    if (!may) throw new Error("khong co .nhac-the__may");
    const r = may.getBoundingClientRect();
    const bo = parseFloat(getComputedStyle(may).borderTopLeftRadius) || 2;
    return {
      goc: [document.elementFromPoint(r.left + bo, r.top + 2)?.tagName, document.elementFromPoint(r.right - bo, r.top + 2)?.tagName],
      dinh: r.top,
      cuon: window.scrollY,
    };
  });
}

/** The Nhac nen, nut va dong trang thai cua no. */
function theNhac(page: Page) {
  const the = page.getByRole("complementary", { name: "Nhạc nền" });
  return { the, nut: the.locator(".nhac-the__dk .btn"), chu: the.locator(".nhac-the__chu") };
}

test("bia Mo sach: chua gan sach, bam thi phat ngay va focus vao sach, sach vua cot ben the nhac; Tat nhac nho theo tung nguoi, ke ca qua Back", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai", "Tờ ba");
  await datNhac(id, MA);
  await giaYoutube(a);
  await giaYoutube(b);

  await b.goto(`/sach/${id}`);
  const bia = b.locator(".bia-mo");
  await expect(bia.getByRole("heading", { level: 1, name: "Chuyện chưa kể" })).toBeVisible();
  await expect(bia).toContainText(`${tenCuaA} viết`);
  await expect(bia).not.toContainText("trang");
  await expect(b.locator(".doc-head")).toHaveCount(0);
  await expect(b.locator(".doc__khung")).toHaveCount(0);
  const { the, nut, chu } = theNhac(b);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await expect(nut).toHaveText("Bật nhạc");
  await expect(chu).toHaveText("Nhạc phát khi mở sách");
  await expect(the.locator(".nhac-the__may iframe")).toHaveAttribute("title", "Nhạc nền");
  await expect(the.locator(".nhac-the__may iframe")).toHaveAttribute("tabindex", "-1");
  expect(await ghiYt(b)).toEqual({ created: 1, play: 0, pause: 0 });

  await b.getByRole("button", { name: "Mở sách" }).click();
  // playVideo() chi gui postMessage; ban gia ghi lai o mot tac vu sau (nhu that), nen doi bang poll.
  await expect.poll(async () => (await ghiYt(b)).play).toBe(1);
  const [luc] = await lucPhat(b);
  expect(quaNuaTrongKhung(luc, luc.rong, luc.cao), "luc phat, hon nua trinh phat dang hien").toBe(true);
  await expect(b.locator(".doc__khung")).toBeFocused();
  await expect(b.locator(".doc-head__sub")).toHaveText(`${tenCuaA} viết · 3 trang`);
  // Nhan theo trang thai phat that: chua co PLAYING thi van la Bat nhac.
  await expect(nut).toHaveText("Bật nhạc");
  await baoYt(b, PHAT);
  await expect(nut).toHaveText("Tắt nhạc");
  await expect(chu).toHaveText("Nhạc đang phát");

  // Sach thu phong theo cot chinh cua luoi, khong tran sang the nhac.
  for (const width of [1280, 1024]) {
    await b.setViewportSize({ width, height: 900 });
    await expect(async () => {
      const [cot, khung, may] = await Promise.all([hop(b.locator(".doc-luoi__chinh")), hop(b.locator(".doc__khung")), hop(the.locator(".nhac-the__may"))]);
      expect(khung.width, `${width}: sach vua cot`).toBeLessThanOrEqual(cot.width + 1);
      expect(khung.x + khung.width, `${width}: sach khong de len trinh phat`).toBeLessThanOrEqual(may.x);
      expect(Math.min(may.width, may.height), `${width}: trinh phat 200x200`).toBeGreaterThanOrEqual(200);
    }).toPass();
    expect(await tranNgang(b)).toEqual([]);
  }
  expect(await ghiYt(b)).toEqual({ created: 1, play: 1, pause: 0 });

  // Tat nhac: luu o may chu (POST cua actionSetMusicMuted mang doi so [true]).
  const daLuu = b.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined && r.request().postData() === "[true]");
  await nut.click();
  await daLuu;
  expect((await ghiYt(b)).pause).toBe(1);
  await baoYt(b, DUNG);
  await expect(nut).toHaveText("Bật nhạc");
  await expect(chu).toHaveText("Đã tắt nhạc");

  // Back cua trinh duyet: action da refresh() sau khi luu, nen quay lai khong co tam bia va van la Da tat nhac.
  await b.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Kệ sách", exact: true }).click();
  await expect(b).toHaveURL(new RegExp("/ke-sach$"));
  await b.goBack();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}$`));
  await expect(b.locator(".doc__khung")).toBeVisible();
  await expect(b.getByRole("button", { name: "Mở sách" })).toHaveCount(0);
  await expect(chu).toHaveText("Đã tắt nhạc");

  await b.reload();
  await expect(b.locator(".doc__khung")).toBeVisible();
  await expect(b.getByRole("button", { name: "Mở sách" })).toHaveCount(0);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await expect(nut).toHaveText("Bật nhạc");
  await expect(chu).toHaveText("Đã tắt nhạc");
  expect(await ghiYt(b)).toEqual({ created: 1, play: 0, pause: 0 });

  // Lua chon cua nguoi nay khong anh huong nguoi kia.
  await a.goto(`/sach/${id}`);
  await expect(a.getByRole("button", { name: "Mở sách" })).toBeVisible();
  await expect(theNhac(a).chu).toHaveText("Nhạc phát khi mở sách");
});

test("mo niem phong qua redirect giu nguyen trang va trinh phat: YT.Player chi tao mot lan, iframe khong roi DOM", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], CAU_DO);
  const [s] = await niemPhongCua(id);
  await datNhac(id, MA);
  await giaYoutube(b);

  await b.goto(`/sach/${id}`);
  const { the, nut } = theNhac(b);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await b.getByRole("button", { name: "Mở sách" }).click();
  await baoYt(b, PHAT);
  await expect(nut).toHaveText("Tắt nhạc");
  await expect(the.locator(".nhac-the__may iframe")).toHaveCount(1);
  // Danh dau tai lieu, giu tham chieu toi iframe va ghi lai neu iframe (hay mot nut cha cua no) bi go khoi DOM.
  await b.evaluate(() => {
    const w = window as unknown as { cungTaiLieu: boolean; khungCu: Element | null; khungDoi?: boolean };
    const iframe = document.querySelector(".nhac-the__may iframe");
    w.cungTaiLieu = true;
    w.khungCu = iframe;
    new MutationObserver((ms) => {
      if (ms.some((m) => [...m.removedNodes].some((n) => n === iframe || (iframe !== null && n.contains(iframe))))) w.khungDoi = true;
    }).observe(document.body, { childList: true, subtree: true });
  });

  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await khung.getByLabel("Câu trả lời").fill("quán mây");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=${s.id}$`));
  await expect(b.getByRole("region", { name: "Đã mở trang" })).toBeVisible();
  await expect(b.locator(".sach")).toContainText(BI_MAT);
  await expect(b.getByRole("button", { name: "Mở sách" })).toHaveCount(0);
  expect(await b.evaluate(() => {
    const w = window as unknown as { cungTaiLieu?: boolean; khungCu?: Element | null; khungDoi?: boolean };
    return { cungTaiLieu: w.cungTaiLieu, cungKhung: document.querySelector(".nhac-the__may iframe") === w.khungCu, khungDoi: typeof w.khungDoi };
  }), "khong tai lai tai lieu, iframe khong bao gio roi DOM").toEqual({ cungTaiLieu: true, cungKhung: true, khungDoi: "undefined" });
  expect(await ghiYt(b)).toEqual({ created: 1, play: 1, pause: 0 });
  await expect(nut).toHaveText("Tắt nhạc");
});

test("sach khong nhac khong co the nhac va khong goi YouTube; loi vao ?trang khong co bia; 375x812 nut Mo sach va trinh phat cung trong man hinh; khong tran ngang", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);

  const goiYoutube: string[] = [];
  a.on("request", (r) => {
    if (r.url().includes("youtube")) goiYoutube.push(r.url());
  });
  const khongNhac = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  await dangToThang(khongNhac, "Tờ một");
  await a.goto(`/sach/${khongNhac}`);
  await expect(a.locator(".doc__khung")).toBeVisible();
  await expect(a.locator(".doc-head")).toBeVisible();
  // Sach chia se khong nhac van co cot phai (khung Loi hoi dap), nhung khong co the nhac nao.
  await expect(a.locator(".doc-luoi")).toHaveCount(1);
  await expect(a.getByRole("region", { name: "Lời hồi đáp" })).toBeVisible();
  await expect(a.locator(".nhac-the")).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Mở sách" })).toHaveCount(0);
  expect(goiYoutube).toEqual([]);

  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");
  await datNhac(id, MA);
  await giaYoutube(a);
  const { the, nut, chu } = theNhac(a);

  await a.goto(`/sach/${id}?trang=1`);
  await expect(a.locator(".doc__khung")).toBeVisible();
  await expect(a.getByRole("button", { name: "Mở sách" })).toHaveCount(0);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await expect(nut).toHaveText("Bật nhạc");
  await expect(chu).toHaveText("Nhạc chưa phát");
  expect(await ghiYt(a)).toEqual({ created: 1, play: 0, pause: 0 });

  await a.setViewportSize({ width: 375, height: 812 });
  await a.goto(`/sach/${id}`);
  const mo = a.getByRole("button", { name: "Mở sách" });
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  const [hopMo, hopMay, hopNut] = await Promise.all([hop(mo), hop(the.locator(".nhac-the__may")), hop(nut)]);
  expect(hopMo.y, "Mo sach trong man hinh").toBeGreaterThanOrEqual(0);
  expect(hopMay.y + hopMay.height, "ca trinh phat trong man hinh").toBeLessThanOrEqual(812);
  expect(Math.min(hopMay.width, hopMay.height), "trinh phat 200x200").toBeGreaterThanOrEqual(200);
  expect(Math.min(hopMo.height, hopNut.height), "vung bam 44px").toBeGreaterThanOrEqual(44);
  // Khong gi de len trinh phat: diem giua khung la chinh iframe.
  const giua = await a.evaluate(() => {
    const r = document.querySelector(".nhac-the__may")?.getBoundingClientRect();
    return r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName : undefined;
  });
  expect(giua).toBe("IFRAME");
  expect(await tranNgang(a)).toEqual([]);

  // Khong tran ngang o moi be rong, ca luc con tam bia lan khi da mo sach.
  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tam bia ${width}px`).toEqual([]);
  }

  // Vong lap tren doi qua nhieu be rong, nen quay lai dung 375x812 truoc khi bam. O be rong nay
  // luoi mot cot, the nhac nam sau noi dung sach nen thuong ngoai khung nhin luc bam Mo sach: sach van mo ma khong
  // tu phat. Nguoi doc bam Bat nhac ngay canh khung video thi trang cuon toi trinh phat roi moi phat.
  await a.setViewportSize({ width: 375, height: 812 });
  await mo.click();
  await expect(a.locator(".doc__khung")).toBeVisible();
  expect(await ghiYt(a)).toEqual({ created: 1, play: 0, pause: 0 });
  await expect(chu).toHaveText("Nhạc chưa phát");
  await expect(nut).toHaveText("Bật nhạc");

  // Bam bang phim tu cho dang dung, focus khong cuon (nhu test 740x360): click cua Playwright tu cuon nut va trinh
  // phat ngay tren no vao tam nhin, nen chi cach nay chung minh chinh trang cuon toi trinh phat.
  expect(quaNuaTrongKhung(await khungCua(the.locator(".nhac-the__may")), 375, 812), "truoc khi bam, trinh phat chua hien qua nua").toBe(false);
  await nut.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await a.keyboard.press("Enter");
  await expect.poll(async () => (await ghiYt(a)).play).toBe(1);
  const hopSauCuon = await hop(the.locator(".nhac-the__may"));
  expect(hopSauCuon.y, "da cuon toi trinh phat").toBeGreaterThanOrEqual(0);
  // scrollIntoView nearest dat day khung sat mep duoi; bo cuc co phan le pixel (vd 812.05) nen cho le toi 1px.
  expect(hopSauCuon.y + hopSauCuon.height, "trinh phat trong man hinh sau khi cuon").toBeLessThanOrEqual(812 + 1);
  const [luc] = await lucPhat(a);
  expect(quaNuaTrongKhung(luc, luc.rong, luc.cao), "luc phat, hon nua trinh phat dang hien").toBe(true);
  await baoYt(a, PHAT);
  await expect(nut).toHaveText("Tắt nhạc");

  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `da mo sach ${width}px`).toEqual([]);
  }
});

test("man ngang 740x360: Mo sach khi trinh phat chua hien qua nua thi khong phat; Bat nhac cuon toi trinh phat roi moi phat", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");
  await datNhac(id, MA);
  await giaYoutube(a);
  const { the, nut, chu } = theNhac(a);
  const may = the.locator(".nhac-the__may");

  await a.setViewportSize({ width: 740, height: 360 });
  await a.goto(`/sach/${id}`);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await a.getByRole("button", { name: "Mở sách" }).click();
  await expect(a.locator(".doc__khung")).toBeFocused();
  expect(await ghiYt(a)).toEqual({ created: 1, play: 0, pause: 0 });
  await expect(nut).toHaveText("Bật nhạc");
  await expect(chu).toHaveText("Nhạc chưa phát");

  // Bam Bat nhac bang phim tu cho dang dung: focus khong cuon, de chinh trang phai cuon toi trinh phat truoc khi phat.
  expect(quaNuaTrongKhung(await khungCua(may), 740, 360), "truoc khi bam, trinh phat chua hien qua nua").toBe(false);
  await nut.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await a.keyboard.press("Enter");
  await expect.poll(async () => (await ghiYt(a)).play).toBe(1);
  const [luc] = await lucPhat(a);
  expect(quaNuaTrongKhung(luc, luc.rong, luc.cao), "luc phat, hon nua trinh phat dang hien").toBe(true);
  // Cuon cua chinh trang dua dinh trinh phat len gan mep tren: nav khong dinh nen khong de len.
  expect((await gocTren(a)).goc, "740x360: khong gi de len hai goc tren trinh phat").toEqual(["IFRAME", "IFRAME"]);
  await baoYt(a, PHAT);
  await expect(nut).toHaveText("Tắt nhạc");
});

test("khong gi de len trinh phat o moi be rong: 768x600 dinh trinh phat sat mep tren, 1280 cuon 300px", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ một", "Tờ hai");
  await datNhac(id, MA);
  await giaYoutube(a);
  const { nut } = theNhac(a);

  // 768px: luoi mot cot, the nhac nam sau cuon sach; cuon cho dinh trinh phat cham mep tren khung nhin.
  await a.setViewportSize({ width: 768, height: 600 });
  await a.goto(`/sach/${id}`);
  await expect(nut).toHaveAttribute("aria-disabled", "false");
  await a.getByRole("button", { name: "Mở sách" }).click();
  await expect(a.locator(".doc__khung")).toBeFocused();
  // Sach hai to ngan, trang het truoc khi dinh trinh phat len toi mep tren: noi dai tai lieu ben duoi <main> (thay cho
  // mot trang dai hon) roi moi cuon. Phan noi them nam sau moi thu nen khong doi vi tri trinh phat.
  await a.evaluate(() => {
    const r = document.querySelector(".nhac-the__may")?.getBoundingClientRect();
    if (!r) throw new Error("khong co .nhac-the__may");
    const dem = document.createElement("div");
    dem.style.height = `${window.innerHeight}px`;
    document.body.append(dem);
    window.scrollBy(0, r.top);
  });
  const hep = await gocTren(a);
  expect(Math.abs(hep.dinh), "768: dinh trinh phat sat mep tren").toBeLessThanOrEqual(1);
  expect(hep.goc, "768: khong gi de len hai goc tren trinh phat").toEqual(["IFRAME", "IFRAME"]);

  // 1280px: the nhac dinh o cot phai; cuon 300px thi nav da troi di, the nhac dung cach mep tren mot khoang.
  await a.setViewportSize({ width: 1280, height: 600 });
  await a.evaluate(() => window.scrollTo(0, 300));
  const rong = await gocTren(a);
  expect(rong.cuon, "1280: da cuon 300px").toBe(300);
  expect(rong.goc, "1280: khong gi de len hai goc tren trinh phat").toEqual(["IFRAME", "IFRAME"]);
});
