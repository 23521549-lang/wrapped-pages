import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, datDauLuotMoi, datNhac, doiNgayTaoSach, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG, BE_RONG_CHAM, vungBamNhoCoLich, type MienTru } from "./vung-bam";
import { baoYt, danhSachYt, giaYoutube } from "./youtube-gia";
import { thangCua, thangKhoa, thangTruoc } from "@/lib/tam-trang/lich";

/*
 * Trang Dau thoi gian va ba loi vao cua no (diem 15 va 17 cua chu du an): muc tren thanh dieu huong dan qua trang chon
 * cuon, bam anh bia tren khung sach lon, va bam tieu de the Nhac nen. Cuon rieng tu cua nguoi kia phai la 404.
 */

const MA = "dQw4w9WgXcQ";
const MA_HAI = "5qap5aO4i9A";

/**
 * Mien tru vung bam (co ten va ly do; phan tu van duoc do, qua vung bam that cua no):
 * - .dtg-dong .nhap__ten: ten sach tren trang chon cuon cua Dau thoi gian chi cao mot dong chu, nhung ::after cua no phu
 *   kin ca dong (`.dtg-dong{ position: relative }`, `.dtg-dong .nhap__ten::after{ position: absolute; inset: 0 }`),
 *   nen ca dong - bia, ten va dong dem - la vung bam.
 */
const MIEN_TRU: MienTru[] = [{ phanTu: ".dtg-dong .nhap__ten", vungBam: "li.dtg-dong" }];

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

test("vao tu thanh dieu huong qua trang chon cuon, roi toi lich thang cua cuon do", async ({ browser }) => {
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
  // Lich thang cung khung voi Lich hoa (spec bo sung B4 ban hai): thang mo san la thang cua dau moi nhat, ngay chon san
  // la ngay cua dau do, va the ngay ke o mo dau.
  await expect(a.getByRole("heading", { level: 2, name: /^Tháng [0-9]{1,2}, [0-9]{4}$/ })).toBeVisible();
  await expect(a.locator(".ngay[aria-pressed='true'] .dtg-xap")).toBeVisible();
  await expect(a.locator(".dtg-ngay")).toContainText("1 lượt đăng: 1 bìa mới, 0 lần đổi nhạc.");
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
  // O nhac mo dau hien o lan nhac cua ngay tao sach.
  await expect(a.locator(".ngay[aria-pressed='true'] .dtg-cham")).toBeVisible();
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
      // O ngay cua lich hep nhat o 320, nen do ca 320 lan be rong cham chung.
      if (w === BE_RONG_CHAM || w === 320) expect(await vungBamNhoCoLich(a, MIEN_TRU), `${duong} o ${w}px: vung bam`).toEqual([]);
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

test("xap bia lon khong de len chu; trang chon cuon: ten sach dai xuong dong tron ven", async ({ browser }) => {
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

    // Thang mac dinh la thang cua dau moi nhat: o bia mo dau cua cuon vua tao. Cac to cua xap bia lon xoe nghieng ra
    // ngoai khung cua no, nen do tung to: khong to nao cham toi dong chu ben duoi.
    await a.goto(`/dau-thoi-gian/${id}`);
    const xl = a.getByRole("button", { name: "Xem 1 bìa của ngày này" });
    await expect(xl.locator(".dtg-xl__to svg")).toBeVisible();
    const day = await xl.locator(".dtg-xl__to").evaluateAll((cac) => Math.max(...cac.map((el) => el.getBoundingClientRect().bottom)));
    const chu = await xl.locator(".dtg-xl__chu").boundingBox();
    if (!chu) throw new Error("khong thay dong chu cua xap bia lon");
    expect(day, `xap bia de len chu o ${w}px`).toBeLessThanOrEqual(chu.y + 0.5);
  }
});

/** Thang truoc thang nay, theo gio Viet Nam, va 12 gio trua ngay 15 cua thang do. */
const THANG_TRUOC = thangTruoc(thangCua(new Date()));
const GIUA_THANG_TRUOC = new Date(Date.UTC(THANG_TRUOC.y, THANG_TRUOC.m - 1, 15, 5));

/**
 * Cuon co ba luot trong hom nay: luot 1 bia moi va bai MA, luot 2 bia moi va go nhac, luot 3 chi bai MA_HAI. Ngay tao
 * sach lui ve giua thang truoc, nen o bia mo dau nam o thang truoc va lich co nut Tháng trước.
 */
async function cuonBaLuot(a: Page): Promise<string> {
  const id = await taoSach(a, "Những bữa sáng", "chia-se");
  await dangToThang(id, "Lượt một.");
  await datDauLuotMoi(id, { cover: "chim-bay", youtubeId: MA });
  await dangToThang(id, "Lượt hai.");
  await datDauLuotMoi(id, { cover: "cau-go", youtubeId: null });
  await dangToThang(id, "Lượt ba.");
  await datDauLuotMoi(id, { youtubeId: MA_HAI });
  await doiNgayTaoSach(id, GIUA_THANG_TRUOC);
  return id;
}

/*
 * Chu du an chot 26/09 (spec bo sung B4 ban hai): nhac chi tu phat khi bam mot ngay, phat tuan tu va bo qua go nhac;
 * bam lai ngay dang phat thi phat tiep; xem bia va doi thang khong dung toi nhac; chi ngay khac moi doi (hay dung).
 */
test("nhac trong ngay: bam ngay moi phat tuan tu; xem bia va doi thang khong dung nhac; ngay khac thi dung", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await cuonBaLuot(a);
  await giaYoutube(a);
  await a.goto(`/dau-thoi-gian/${id}`);
  const nhac = a.getByRole("region", { name: "Nhạc trong ngày" });
  await expect(nhac.locator(".dtg-nhac__may iframe")).toBeAttached();
  await expect(nhac.getByRole("listitem")).toHaveCount(3);
  await expect(nhac.getByRole("listitem").nth(1)).toContainText("Gỡ nhạc nền");
  // Vua mo trang: khong phat gi.
  expect(await danhSachYt(a)).toEqual({ nap: [], dung: 0 });

  // Bam ngay hom nay (dang chon san nhung chua phat bai nao): phat bai dau.
  await a.locator(".ngay--nay").click();
  await expect.poll(async () => (await danhSachYt(a)).nap).toEqual([MA]);
  await baoYt(a, 1);
  await expect(nhac.locator(".dtg-nhac__chu")).toContainText("Đang phát, lượt 1");
  await expect(nhac.locator("[aria-current='true']")).toHaveCount(1);
  // Het bai: sang bai ke, bo qua o go nhac.
  await baoYt(a, 0);
  await expect.poll(async () => (await danhSachYt(a)).nap).toEqual([MA, MA_HAI]);
  // Bam lai dung ngay dang phat: phat tiep, khong nap lai.
  await a.locator(".ngay--nay").click();
  expect((await danhSachYt(a)).nap).toEqual([MA, MA_HAI]);

  // Xem bia: chong the giua man hinh, lat bang phim, dong bang Esc; nhac khong bi dung.
  await a.getByRole("button", { name: "Xem 2 bìa của ngày này" }).click();
  const hop = a.getByRole("dialog", { name: /^Bìa trong ngày / });
  await expect(hop).toBeVisible();
  await expect(hop.locator(".dtg-xem__dem")).toHaveText("Bìa 1 / 2");
  await expect(hop.getByRole("button", { name: /^Bìa 1 trên 2, lượt 1/ })).toBeFocused();
  await a.keyboard.press("ArrowRight");
  await expect(hop.locator(".dtg-xem__dem")).toHaveText("Bìa 2 / 2");
  await expect(hop.getByRole("link", { name: "Đọc từ trang 2" })).toHaveAttribute("href", `/sach/${id}?trang=2`);
  await a.keyboard.press("Escape");
  await expect(hop).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Xem 2 bìa của ngày này" })).toBeFocused();
  expect(await danhSachYt(a)).toEqual({ nap: [MA, MA_HAI], dung: 0 });

  // Doi thang ngay tai cho: duong dan ghi thang, nhac khong dung, trinh phat van o do.
  await a.getByRole("button", { name: "Tháng trước" }).click();
  await expect(a.getByRole("heading", { level: 2, name: `Tháng ${THANG_TRUOC.m}, ${THANG_TRUOC.y}` })).toBeVisible();
  await expect(a).toHaveURL(new RegExp(`[?]thang=${thangKhoa(THANG_TRUOC)}$`));
  expect(await danhSachYt(a)).toEqual({ nap: [MA, MA_HAI], dung: 0 });
  await expect(nhac.locator(".dtg-nhac__may iframe")).toBeAttached();

  // Ngay khac khong co nhac (ngay tao sach): dung han, khong con trinh phat.
  await a.getByRole("button", { name: new RegExp(`^15 tháng ${THANG_TRUOC.m}[.]`) }).click();
  await expect.poll(async () => (await danhSachYt(a)).dung).toBe(1);
  await expect(nhac).toContainText("Ngày này không đổi nhạc.");
  await expect(nhac.locator(".dtg-nhac__may")).toHaveCount(0);

  // Tai lai: duong dan mo dung thang da chon.
  await a.reload();
  await expect(a.getByRole("heading", { level: 2, name: `Tháng ${THANG_TRUOC.m}, ${THANG_TRUOC.y}` })).toBeVisible();
});

/** Phan tu tren cung o bon goc (lui vao 12px) va o giua khung phat nhac trong ngay. */
function diemTrenKhung(page: Page): Promise<(string | undefined)[]> {
  return page.evaluate(() => {
    const khung = document.querySelector(".dtg-nhac__may iframe");
    if (!khung) throw new Error("khong co khung phat");
    const r = khung.getBoundingClientRect();
    const diem = [[r.left + 12, r.top + 12], [r.right - 12, r.top + 12], [r.left + 12, r.bottom - 12], [r.right - 12, r.bottom - 12], [r.left + r.width / 2, r.top + r.height / 2]];
    return diem.map(([x, y]) => document.elementFromPoint(x, y)?.tagName);
  });
}

/**
 * Lat mot the (phim →) roi do chong the o tung khung hinh trong mot giay: do lech lon nhat so voi truoc khi lat, va co
 * phan tu nao cua trinh xem tran ra thanh cuon khong (chu du an 26/09: moi lan lat hien hai thanh cuon, khung bi nhay).
 */
function latVaDo(page: Page): Promise<{ lech: number; cuon: string[] }> {
  return page.evaluate(async () => {
    const boc = document.querySelector(".dtg-xem__boc");
    if (!boc) throw new Error("khong co chong the");
    const goc = boc.getBoundingClientRect();
    let lech = 0;
    const cuon = new Set<string>();
    const doCuon = () => {
      for (const el of [document.documentElement, ...document.querySelectorAll(".dtg-xem, .dtg-xem *")]) {
        const k = getComputedStyle(el);
        const doc = el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(k.overflowY);
        const ngang = el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(k.overflowX);
        if (doc || ngang) cuon.add(`${el.tagName.toLowerCase()}.${el.className}`);
      }
    };
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const batDau = performance.now();
    await new Promise<void>((xong) => {
      const khung = () => {
        const r = boc.getBoundingClientRect();
        lech = Math.max(lech, Math.abs(r.x - goc.x), Math.abs(r.y - goc.y), Math.abs(r.width - goc.width), Math.abs(r.height - goc.height));
        doCuon();
        if (performance.now() - batDau < 1000) requestAnimationFrame(khung);
        else xong();
      };
      requestAnimationFrame(khung);
    });
    return { lech, cuon: [...cuon] };
  });
}

/*
 * Luat trinh phat YouTube (CLAUDE.md, spec muc 5): khung it nhat 200x200 va khong lop nao de len no o bat ky be rong nao
 * - ke ca khi trinh xem bia phu ca man hinh: luc do the nhac noi TREN lop nen, o goc man rong va trai ngang day man hep.
 */
test("khung phat nhac trong ngay: toi thieu 200x200, khong gi de len ca khi trinh xem bia mo, o nam be rong", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await cuonBaLuot(a);
  await giaYoutube(a);
  for (const w of [320, 375, 414, 768, 1280]) {
    await a.setViewportSize({ width: w, height: 800 });
    await a.goto(`/dau-thoi-gian/${id}`);
    const khung = a.locator(".dtg-nhac__may iframe");
    await expect(khung).toBeAttached();
    await khung.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const hop = await khung.boundingBox();
    if (!hop) throw new Error("khong do duoc khung phat");
    expect(Math.min(hop.width, hop.height), `${w}px: khung phat`).toBeGreaterThanOrEqual(200);
    expect(await diemTrenKhung(a), `${w}px: trinh xem dong`).toEqual(Array(5).fill("IFRAME"));

    await a.getByRole("button", { name: "Xem 2 bìa của ngày này" }).click();
    await expect(a.getByRole("dialog")).toBeVisible();
    expect(await diemTrenKhung(a), `${w}px: trinh xem mo`).toEqual(Array(5).fill("IFRAME"));
    const noi = await khung.boundingBox();
    if (!noi) throw new Error("khong do duoc khung phat luc noi");
    expect(noi.y, `${w}px: the nhac noi nam tron trong khung nhin`).toBeGreaterThanOrEqual(0);
    expect(noi.y + noi.height).toBeLessThanOrEqual(800);
    expect(Math.min(noi.width, noi.height), `${w}px: khung phat luc noi`).toBeGreaterThanOrEqual(200);
    // Bia khong nam duoi the nhac: the nhac khong che mat chong the.
    const the = await a.locator(".dtg-the-bia[data-o='0']").boundingBox();
    if (!the) throw new Error("khong thay the bia tren cung");
    const chong = !(the.x + the.width <= noi.x || noi.x + noi.width <= the.x || the.y + the.height <= noi.y || noi.y + noi.height <= the.y);
    expect(chong, `${w}px: the bia va the nhac chong len nhau`).toBe(false);
    if (w === BE_RONG_CHAM || w === 320) expect(await vungBamNhoCoLich(a, MIEN_TRU), `${w}px: vung bam luc xem bia`).toEqual([]);
    expect(await tranNgang(a), `${w}px: tran ngang luc xem bia`).toEqual([]);
    // Lat the: chong the dung yen, khong thanh cuon nao hien ra.
    const lat = await latVaDo(a);
    expect(lat.cuon, `${w}px: thanh cuon luc lat`).toEqual([]);
    expect(lat.lech, `${w}px: chong the xe dich luc lat`).toBeLessThan(0.5);
    await expect(a.locator(".dtg-xem__dem")).toHaveText("Bìa 2 / 2");
    await a.keyboard.press("Escape");
    await expect(a.getByRole("dialog")).toHaveCount(0);
  }
});
