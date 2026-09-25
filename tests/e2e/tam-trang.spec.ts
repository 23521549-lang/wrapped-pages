import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, ghiTamTrang, haiNguoiDaVao, tranNgang } from "./kho-sach";
import { BE_RONG_CHAM, vungBamNho, type MienTru } from "./vung-bam";
import { khoangThang, thangCua, thangKhoa, thangTruoc } from "@/lib/tam-trang/lich";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** Nam be rong phai khong tran ngang: bon be rong bat buoc va man rong. */
const NAM_BE_RONG = [320, 375, 414, 768, 1280];

/** Hai be rong cam ung phai do vung bam o Lich hoa: o ngay hep nhat o 320, va be rong cham chung cua ca web. */
const BE_RONG_DO_BAM = new Set([320, BE_RONG_CHAM]);

/**
 * Mien tru vung bam:
 * - .o input: radio that cua o chon troi, an 1px sau nhan (ThaTamTrang.tsx). Nam TRONG <label class="o">, bam bat ky dau
 *   tren o troi hay ten deu chon radio; nhan cao hon 80px va rong it nhat mot phan ba hop chon.
 * - o-ngay-lich-hoa (spec 6.4): o ngay cua Lich hoa o man hep. Bay cot ngay (va cot nhan ten) phai vua be ngang
 *   320 toi 414px, nen o rong khoang 37px o 320 va 39px o 375. O cao tu 100px, va moi ngay doc du trong khung chi
 *   tiet ben duoi. Van do: o nao hep hon O_NGAY_MIN la loi.
 */
const MIEN_TRU_HOP: MienTru[] = [{ phanTu: ".o input", vungBam: "label.o" }];
const O_NGAY = /^button "[0-9]{1,2} tháng [0-9]{1,2}[.]/;
/** Nguong be ngang cua o ngay: so do that la ~37px o 320 va ~39px o 375; duoi nguong nay la CSS lich da hong. */
const O_NGAY_MIN = 36;
const canhNgan = (dong: string) => Number(/canh ngan ([0-9.]+)px/.exec(dong)?.[1] ?? "0");

/**
 * Tha mot tam trang qua hop chon, TREN trang dang mo: khong dieu huong. Sau khi tha, trang tu lam moi tai cho (props
 * ve lai tu may chu) chu khong tai lai, nen moi phep do bat dau truoc do - vi du mot PerformanceObserver dem xo dich -
 * van con song de doc ket qua cua chinh lan tha nay (phat hien F13).
 */
async function thaTaiCho(p: Page, w: Weather, nhan = ""): Promise<void> {
  await p.getByRole("button", { name: "Thả tâm trạng" }).click();
  await p.locator("label.o", { hasText: TROI[w].ten }).click();
  if (nhan !== "") await p.getByLabel("Lời nhắn").fill(nhan);
  await p.getByRole("button", { name: "Thả", exact: true }).click();
}

/** Mo Ke sach roi tha mot tam trang, doi loi bao cua vung aria-live. */
async function tha(p: Page, w: Weather, nhan = ""): Promise<void> {
  await p.goto("/ke-sach");
  await thaTaiCho(p, w, nhan);
  await expect(p.getByText(`Đã thả ${TROI[w].ten}. Giữ trong 24 giờ.`)).toBeAttached();
}

/**
 * Doi moi hoat hinh trong mot khoi chay xong roi moi do. Hop chon mo ra bang hoat hinh tha-mo (mo dan va dich len
 * 6px): do dung luc no dang chay thi moi so do le mot phan ti pixel, va mot o cao dung 44px doc ra 43.99999 - tuc
 * mot bao dong gia cua phep do vung bam. Luat 44px noi ve bo cuc luc nghi, nen doi cho khoi nghi da roi hay do.
 */
async function choHoatHinhXong(p: Page, bo: string): Promise<void> {
  await p.locator(bo).evaluate(async (el) => {
    await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)));
  });
}

/** Mau cua mot token tren trang dang mo, do bang mot phan tu thu. */
function mauToken(p: Page, token: string): Promise<string> {
  return p.evaluate((t) => {
    const thu = document.createElement("span");
    thu.style.color = `var(${t})`;
    document.body.append(thu);
    const mau = getComputedStyle(thu).color;
    thu.remove();
    return mau;
  }, token);
}

/**
 * Dinh cua mot phan tu, do tu dau TAI LIEU chu khong tu mep khung nhin. boundingBox() cua Playwright do theo khung
 * nhin, nen mot lan cuon trang - vi du khi hop "Thả tâm trạng" mo ra va keo tieu diem theo - lam no doi tuy y du bo
 * cuc khong xo dich mot diem anh nao. Loi hua cua dai troi la ve BO CUC, nen phep do phai bo cuon ra ngoai.
 */
const dinhTaiLieu = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().y + globalThis.scrollY);

/**
 * Bat dem xo dich bo cuc tren trang dang mo. Doc lai bang xoDich(): tong gia tri layout-shift ke tu luc bat.
 * Dai troi hua khong xo dich gi trong hay sau khi doi cho, nen con so nay phai dung bang 0.
 */
async function demXoDich(p: Page): Promise<void> {
  await p.evaluate(() => {
    const w = window as unknown as { xoDich?: number };
    w.xoDich = 0;
    new PerformanceObserver((ds) => {
      for (const d of ds.getEntries()) w.xoDich = (w.xoDich ?? 0) + (d as unknown as { value: number }).value;
    }).observe({ type: "layout-shift", buffered: false });
  });
}

/**
 * Tong xo dich da dem duoc. Doi mot khung hinh roi mot vong microtask truoc khi doc: tay nghe cua PerformanceObserver
 * chay sau khi trinh duyet ve xong, doc ngay co the doc truoc mot ban ghi vua sinh ra.
 */
const xoDich = (p: Page) => p.evaluate(async () => {
  await new Promise((xong) => requestAnimationFrame(() => setTimeout(() => xong(null), 0)));
  return (window as unknown as { xoDich?: number }).xoDich ?? -1;
});

/**
 * Doi vong song chinh lan duoc it nhat `mocMs` cua chinh no. Day la moc "dang giua luc song lan" do chinh trang bao,
 * khong phai mot khoang cho dem gio: neu song khong chay thi ham nay do chu khong lang le cho qua.
 */
async function choSongLanToi(p: Page, mocMs: number): Promise<void> {
  await p.waitForFunction((moc) => {
    const el = document.querySelector(".troi-cua-so .troi--dang-song");
    return el !== null && el.getAnimations().some((a) => Number(a.currentTime ?? 0) >= moc);
  }, mocMs, { timeout: 10_000 });
}

/**
 * Doi vong song tan han: cac lop tam da bi go va troi vua hien khong con o trang thai dang lan. Moc nay do chinh
 * song.ts dat ra (don dep o SONG_HET), nen phep do sau no la phep do tren trang thai nghi that su.
 */
async function choSongTan(p: Page): Promise<void> {
  await expect(p.locator(".song-vong")).toHaveCount(0, { timeout: 10_000 });
  await expect(p.locator(".troi--dang-song")).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Doi lan do bo cuc "luc ranh" cua dai troi chay xong: font tai xong (dai troi do lai sau moc do), roi xep mot viec
 * ranh cua rieng minh - viec ranh chay theo thu tu xep hang nen viec cua dai troi chac chan da chay truoc.
 */
async function choDoLucRanh(p: Page): Promise<void> {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((xong) => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => xong(null), { timeout: 1000 });
      else setTimeout(() => xong(null), 200);
    });
  });
}

/**
 * Doi toi khi tay nghe cua dai troi da gan xong (trang hydrate xong): pointerover vao dung o cua so bat lop
 * troi-cua-so--san, ma chi ganSong moi bat lop do, nen day la dau hieu that. Bo lop ngay khi thay, de phep do bat
 * dau tu dung trang thai nghi. Can thiet vi tren ho so tiet che, hydrate co the con dang chay sau networkidle.
 */
async function choTayNghe(p: Page): Promise<void> {
  await p.waitForFunction(() => {
    const dai = document.querySelector(".troi-cua-so");
    const nut = dai?.querySelector(".cua-so");
    if (dai === null || dai === undefined || nut === null || nut === undefined) return false;
    nut.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    const xong = dai.classList.contains("troi-cua-so--san");
    if (xong) nut.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }));
    return xong;
  }, null, { timeout: 30_000 });
}

/**
 * An xuong o cua so bang mot su kien that roi doi DUNG mot khung hinh, tra ve do tre va nhung gi da co mat trong
 * khung hinh dau tien. Do trong trang de khong tinh ca duong di ve cua giao thuc dieu khien.
 */
function doKhungDau(p: Page): Promise<{ ms: number; song: number; lan: number }> {
  return p.evaluate(async () => {
    const nut = document.querySelector<HTMLElement>(".troi-cua-so .troi[data-mat]:not(.troi--an) .cua-so");
    const t0 = performance.now();
    nut?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerType: "mouse" }));
    await new Promise((xong) => requestAnimationFrame(() => xong(null)));
    return {
      ms: performance.now() - t0,
      song: document.querySelectorAll(".troi-cua-so .song-vong .song-vong__o").length,
      lan: document.querySelectorAll(".troi-cua-so .troi--dang-song").length,
    };
  });
}

test("tha tam trang: nguoi kia thay bau troi voi tho co; nguoi tha thay troi cua minh mang nhan Ban va cham mau tren nut", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  await tha(a, "mua-phun", "Nhớ cậu một chút thôi.");
  await expect(a.getByRole("button", { name: "Thả tâm trạng" }).locator(".o-mau")).toHaveClass("o-mau troi--mua-phun");
  const troiMinh = a.getByRole("region", { name: "Tâm trạng của bạn" });
  await expect(troiMinh).toHaveClass("troi troi--mua-phun");
  await expect(troiMinh.locator(".troi__ai")).toHaveText("Bạn");
  // Spec muc 5 va yeu cau diem 3: bong hoa lich hoa hien o ca troi cua minh lan troi cua nguoi kia.
  await expect(troiMinh.getByRole("link", { name: "Xem lịch hoa" })).toHaveCount(1);
  await expect(troiMinh.locator(".troi__cuoi svg.hoa use")).toHaveAttribute("href", "#hoa-hue-mua");
  await expect(a.locator(".cua-so")).toHaveCount(0);

  await b.goto("/ke-sach");
  const troi = b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` });
  await expect(troi).toHaveClass("troi troi--mua-phun");
  const tho = troi.locator(".troi__tho");
  await expect(tho).toContainText("Tùy phong tiềm nhập dạ");
  await expect(tho).toContainText("Nhuận vật tế vô thanh");
  await expect(tho).not.toContainText(tenCuaA);
  await expect(troi.locator(".troi__giai")).toHaveText(TROI["mua-phun"].giai ?? "");
  await expect(troi.locator(".troi__nguon")).toHaveText("Đỗ Phủ, Xuân dạ hỉ vũ");
  await expect(troi.locator(".troi__nhan")).toHaveText("Nhớ cậu một chút thôi.");
  await expect(troi.locator(".troi__gio")).toHaveText(/^Thả lúc [0-9]{2}:[0-9]{2}$/);
  expect(await tho.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Lexend");
  expect(await troi.locator(".troi__giai").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Be Vietnam Pro");
  await expect(b.getByRole("button", { name: "Thả tâm trạng" }).locator(".o-mau")).toHaveClass("o-mau o-mau--trong");
  await expect(b.locator(".cua-so")).toHaveCount(0);

  await troi.getByRole("link", { name: "Xem lịch hoa" }).click();
  await expect(b).toHaveURL(new RegExp("/tam-trang$"));
  await expect(b.getByRole("heading", { level: 1, name: "Lịch hoa" })).toBeVisible();
});

test("tha tam trang moi thay tam trang cu; thu lai lam troi bien mat va bo bong khoi lich, ngay lui ve tam trang da bi thay", async ({ browser }) => {
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  await tha(a, "nang-am");
  await a.getByRole("button", { name: "Thả tâm trạng" }).click();
  await expect(a.locator(".tha__giu")).toContainText(/Bạn đang giữ Nắng ấm, còn (23|24) giờ[.]/);
  await a.locator("label.o", { hasText: "Giông" }).click();
  await a.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(a.getByText("Đã thả Giông. Giữ trong 24 giờ.")).toBeAttached();
  await b.goto("/ke-sach");
  await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toHaveClass("troi troi--giong");

  await a.getByRole("button", { name: "Thả tâm trạng" }).click();
  await a.getByRole("button", { name: "Thu lại" }).click();
  await expect(a.getByText("Đã thu lại tâm trạng.")).toBeAttached();
  await expect(a.locator(".tha__giu")).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Thả tâm trạng" }).locator(".o-mau")).toHaveClass("o-mau o-mau--trong");
  await b.reload();
  await expect(b.locator(".troi")).toHaveCount(0);

  // Giong da thu lai nen khong con tren lich; Nang am (bi thay, khong thu lai) la bong cua hom nay.
  await a.goto("/tam-trang");
  const homNay = a.getByRole("button", { name: new RegExp(`^[0-9]{1,2} tháng [0-9]{1,2}[.] ${tenCuaB}: chưa thả[.] ${tenCuaA}: Nắng ấm[.] Hôm nay$`) });
  await expect(homNay).toHaveAttribute("aria-pressed", "true");
});

test("lich hoa: tham so hong ve thang nay, chuyen thang, bong cuoi cung trong ngay, chi tiet, hoa nhuom theo troi", async ({ browser }) => {
  const { a, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const nay = thangCua(new Date());
  const truoc = thangTruoc(nay);
  const { from } = khoangThang(truoc);
  // Ngay 10 cua thang truoc, gio Viet Nam: from la 00:00 ngay 1.
  const ngay10 = (gio: number) => new Date(from.getTime() + (9 * 24 + gio) * 3_600_000);
  await ghiTamTrang(tenCuaB, "nang-am", ngay10(8));
  await ghiTamTrang(tenCuaB, "giong", ngay10(21), "Hôm nay nhiều chuyện quá.");
  await ghiTamTrang(tenCuaA, "mua-rao", ngay10(12));

  await a.goto("/tam-trang?thang=khong-hop-le");
  await expect(a.getByRole("heading", { level: 2, name: `Tháng ${nay.m}, ${nay.y}` })).toBeVisible();
  await expect(a.getByRole("button", { name: "Tháng sau" })).toBeDisabled();

  await a.getByRole("link", { name: "Tháng trước" }).click();
  await expect(a).toHaveURL(new RegExp(`/tam-trang[?]thang=${thangKhoa(truoc)}$`));
  await expect(a.getByRole("heading", { level: 2, name: `Tháng ${truoc.m}, ${truoc.y}` })).toBeVisible();
  await expect(a.locator(".thang__tong")).toHaveText(`${tenCuaB} ép 1 bông, ${tenCuaA} ép 1 bông`);
  const o10 = a.getByRole("button", { name: `10 tháng ${truoc.m}. ${tenCuaB}: Giông. ${tenCuaA}: Mưa rào` });
  await expect(o10.locator("svg.hoa")).toHaveCount(2);
  expect(await o10.locator("svg.hoa").first().evaluate((el) => getComputedStyle(el).color)).toBe(await mauToken(a, "--troi-giong-ink"));
  expect(await o10.locator("svg.hoa").last().evaluate((el) => getComputedStyle(el).color)).toBe(await mauToken(a, "--troi-mua-rao-ink"));

  await o10.click();
  await expect(o10).toHaveAttribute("aria-pressed", "true");
  const chiTiet = a.locator(".chi-tiet");
  await expect(chiTiet.locator("h2")).toHaveText(new RegExp(`, 10[.]${String(truoc.m).padStart(2, "0")}`));
  await expect(chiTiet).toContainText(`${tenCuaB}: giông`);
  await expect(chiTiet).toContainText("Bằng lăng, 21:00");
  await expect(chiTiet).toContainText("Hôm nay nhiều chuyện quá.");
  await expect(chiTiet).toContainText(`${tenCuaA}: mưa rào`);

  await a.getByRole("link", { name: "Tháng sau" }).click();
  await expect(a.getByRole("heading", { level: 2, name: `Tháng ${nay.m}, ${nay.y}` })).toBeVisible();
});

test("giam chuyen dong: bau troi dung yen, chop va vet sang an, hat mua nam rai rac, hop chon hien ngay", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  await tha(a, "giong");
  await b.goto("/ke-sach");
  const troi = b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` });
  await expect(troi.locator(".m-hat").first()).toHaveCSS("animation-name", "roi");
  await expect(troi.locator(".m-set")).toHaveCSS("display", "block");

  // Nut tam dung hieu ung (WCAG SC 2.2.2): dung han moi net ve, nho lua chon qua lan tai lai, va cho chay lai duoc.
  // Phan quyet B4 va yeu cau diem 21: mot cong tac dung chung cho moi hieu ung tu chay (bau troi hom nay, bia tu doi
  // cua plan sau), nen nhan khong duoc nhac rieng bau troi nua.
  const hat = troi.locator(".m-hat").first();
  const nutDung = b.getByRole("button", { name: "Tạm dừng hiệu ứng" });
  await expect(b.locator(".nut-dung")).not.toContainText("bầu trời");
  const hopNut = await nutDung.boundingBox();
  expect(Math.min(hopNut?.width ?? 0, hopNut?.height ?? 0), "vung bam nut tam dung").toBeGreaterThanOrEqual(44);
  await expect(hat).toHaveCSS("animation-play-state", "running");
  await nutDung.click();
  // Lop `troi-dung` nam tren the boc .troi-dai chu khong tren chinh the <section class="troi">: tu khi co khuon giu
  // cho chieu cao, dai troi luon co the boc chung cho ca che do mot troi lan che do hai troi. Van la dung mot lop ay,
  // va no van dung moi net ve - dong ngay duoi do chinh la phep do do.
  await expect(b.locator(".troi-dai")).toHaveClass(/troi-dung/);
  await expect(hat).toHaveCSS("animation-play-state", "paused");
  await expect(b.getByText("Hiệu ứng đã tạm dừng.")).toBeAttached();
  await b.reload();
  await expect(hat).toHaveCSS("animation-play-state", "paused");
  await b.getByRole("button", { name: "Cho hiệu ứng chạy" }).click();
  await expect(hat).toHaveCSS("animation-play-state", "running");
  await expect(b.getByText("Hiệu ứng chạy lại rồi.")).toBeAttached();

  await b.emulateMedia({ reducedMotion: "reduce" });
  await b.reload();
  await expect(troi.locator(".m-hat").first()).toHaveCSS("animation-name", "none");
  await expect(troi.locator(".m-set")).toHaveCSS("display", "none");
  await expect(troi.locator(".m-chop")).toHaveCSS("display", "none");
  expect(await troi.locator(".m-hat").first().evaluate((el) => getComputedStyle(el).top)).not.toBe("-30px");
  // Khong con gi chay de ma dung: nut bien han, khong de lai mot cong tac vo nghia trong hang cuoi.
  await expect(b.locator(".nut-dung")).toBeHidden();
  await b.getByRole("button", { name: "Thả tâm trạng" }).click();
  await expect(b.locator(".tha")).toHaveCSS("animation-name", "none");
});

test("o cua so: hai troi ve san xep chong, bam la song hien ngay, khong xo dich gi, focus o yen, co bao", async ({ browser }) => {
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  await tha(a, "mua-phun", "Nhớ cậu một chút thôi.");
  await tha(b, "nang-am");
  await b.goto("/ke-sach");
  const dai = b.locator(".troi-cua-so");
  // Ca hai bau troi da ve san, xep chong: doi cho khong phai dung lai DOM.
  await expect(dai.locator(".troi[data-mat]")).toHaveCount(2);
  await expect(dai.locator('.troi[data-mat="minh"] .troi__nen .m').first()).toBeAttached();
  await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toHaveClass("troi troi--mua-phun troi--cua-so");
  const o = b.getByRole("button", { name: "Xem trời của bạn" });
  await expect(o.locator(".cua-so__kinh")).toHaveClass("cua-so__kinh troi--nang-am");
  await expect(o.locator(".cua-so__chu")).toContainText("Trời của bạn");
  const hop = await o.boundingBox();
  expect(Math.min(hop?.width ?? 0, hop?.height ?? 0)).toBeGreaterThanOrEqual(44);

  // Moc do xo dich: dinh cua tieu de "Ke sach" va chieu cao dai truoc khi bam.
  const moc = b.getByRole("heading", { level: 1, name: "Kệ sách" });
  const mocTruoc = (await moc.boundingBox())?.y ?? -1;
  const caoTruoc = (await dai.boundingBox())?.height ?? -1;
  await choTayNghe(b);
  await demXoDich(b);

  // Do tre: tu luc an xuong toi khung hinh dau tien da co lop song va troi moi da bat dau lo ra.
  const dau = await doKhungDau(b);
  console.log(`[tam-trang] khung hinh dau tien, ho so thuong: ${dau.ms.toFixed(1)}ms`);
  expect(dau.song, "khung hinh dau tien chua co lop song").toBe(4);
  expect(dau.lan).toBe(1);
  expect(dau.ms, "song hien cham hon mot khung hinh").toBeLessThan(50);

  const troiMinh = b.getByRole("region", { name: "Tâm trạng của bạn" });
  await expect(troiMinh).toHaveClass(/troi--nang-am troi--cua-so/);
  await expect(troiMinh.locator(".troi__ai")).toHaveText("Bạn");
  // Spec muc 5 va yeu cau diem 3: bong hoa lich hoa hien o ca troi cua minh lan troi cua nguoi kia.
  await expect(troiMinh.getByRole("link", { name: "Xem lịch hoa" })).toHaveCount(1);
  const oLai = b.getByRole("button", { name: `Xem trời của ${tenCuaA}` });
  await expect(oLai).toBeFocused();
  await expect(b.getByText("Đang xem trời của bạn.")).toBeAttached();
  // Bam chuot thi khong co vong focus; go phim thi co lai.
  await expect(b.locator(".cua-so--im")).toHaveCount(1);
  await b.keyboard.press("Tab");
  await expect(b.locator(".cua-so--im")).toHaveCount(0);

  // Khong xo dich: do giua luc song lan (moc do chinh vong song bao) va sau khi song tan (moc do song.ts don dep).
  await choSongLanToi(b, 600);
  expect((await moc.boundingBox())?.y ?? -1).toBeCloseTo(mocTruoc, 2);
  expect((await dai.boundingBox())?.height ?? -1).toBeCloseTo(caoTruoc, 2);
  await choSongTan(b);
  expect((await moc.boundingBox())?.y ?? -1).toBeCloseTo(mocTruoc, 2);
  expect((await dai.boundingBox())?.height ?? -1).toBeCloseTo(caoTruoc, 2);
  expect(await xoDich(b), "co xo dich bo cuc").toBe(0);

  await b.emulateMedia({ reducedMotion: "reduce" });
  await oLai.click();
  await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toBeVisible();
  // Giam chuyen dong: doi ngay, khong lop song nao.
  await expect(b.locator(".song-vong")).toHaveCount(0);
  await expect(b.getByText(`Đang xem trời của ${tenCuaA}.`)).toBeAttached();

  // Khong luu: tai lai trang thi ve mac dinh, troi lon la cua nguoi kia.
  await b.reload();
  await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toBeVisible();
});

/**
 * CLS dung dinh nghia cua trinh duyet: chi cong nhung ban ghi layout-shift KHONG do mot cu bam vua xay ra
 * (hadRecentInput sai). Xo dich trong nua giay sau cu bam thi nguoi dung dang cho no, nen trinh duyet khong tinh.
 */
async function demCls(p: Page): Promise<void> {
  await p.evaluate(() => {
    const w = window as unknown as { cls?: number };
    w.cls = 0;
    new PerformanceObserver((ds) => {
      for (const d of ds.getEntries()) {
        const x = d as unknown as { value: number; hadRecentInput: boolean };
        if (!x.hadRecentInput) w.cls = (w.cls ?? 0) + x.value;
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
}

const cls = (p: Page) => p.evaluate(async () => {
  await new Promise((xong) => requestAnimationFrame(() => setTimeout(() => xong(null), 0)));
  return (window as unknown as { cls?: number }).cls ?? -1;
});

/*
 * Hop "Thả tâm trạng" nam giua dau ke va ke sach. Truoc day no chi dong SAU khi may chu tra loi, tuc thuong qua nua
 * giay sau cu bam, nen lan thu hop do bi tinh vao CLS: do duoc mot ban ghi 0,1349 tren `.dau-ke` ngay ca khi tat hieu
 * ung. Gio hop dong ngay trong luot bam. Bai nay dem tu TRUOC cu bam toi sau khi moi thu xong, o hai bo may.
 */
test("thay tam trang khong gay xo dich nao ngoai cua so cu bam: CLS bang 0 ca luot", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  // Da giu san mot tam trang, tuc dai troi da co tren trang: bai nay do lan THAY tam trang. Lan tha dau tien thi dai
  // troi xuat hien lan dau o dinh trang, mot viec khac han va khong thuoc bai nay.
  await tha(b, "nang-am");
  for (const giam of [false, true]) {
    await b.emulateMedia({ reducedMotion: giam ? "reduce" : "no-preference" });
    await b.goto("/ke-sach");
    await b.getByRole("button", { name: "Thả tâm trạng" }).click();
    await b.locator("label.o", { hasText: TROI[giam ? "mua-phun" : "giong"].ten }).click();
    // Doi hoat hinh mo hop chay xong, roi moi bat dem: chi do tu luc bam Tha.
    await b.waitForTimeout(400);
    await demCls(b);
    await b.getByRole("button", { name: "Thả", exact: true }).click();
    await expect(b.getByText(/Đã thả .+\. Giữ trong 24 giờ\./)).toBeAttached();
    // Cho het lan loang (neu co) va buoc don.
    await b.waitForTimeout(3500);
    const tong = await cls(b);
    console.log(`[tam-trang] CLS ca luot tha, ${giam ? "giam chuyen dong" : "chuyen dong thuong"}: ${tong}`);
    expect(tong, `CLS khi tha tam trang (${giam ? "giam" : "thuong"})`).toBe(0);
  }
});

test("thay tam trang: troi moi loang phu het troi cu, khong xo dich, xong thi sach", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await tha(b, "nang-am");
  await b.goto("/ke-sach");
  const dai = b.locator(".troi-dai");
  const moc = b.getByRole("heading", { level: 1, name: "Kệ sách" });
  const mocTruoc = await dinhTaiLieu(moc);
  const caoTruoc = (await dai.boundingBox())?.height ?? -1;
  // Tha bang thaTaiCho chu khong bang tha(): tha() mo dau bang mot lan goto, ma lan goto do xoa mat chinh cai
  // PerformanceObserver cua demXoDich (phan quyet M8, phat hien F13).
  await thaTaiCho(b, "giong", "Mưa cả buổi chiều, chẳng đi đâu được.");

  // Dang loang: co lop vet nuoc, trai troi cu van con va tro nang.
  await expect(b.locator(".loang .giot").first()).toBeAttached();
  /*
   * Bat dem xo dich o DAY chu khong truoc luc tha: bai nay dem MOI ban ghi layout-shift, ke ca ban ghi do chinh cu bam
   * sinh ra, ma hop "Thả tâm trạng" thu lai ngay trong luot bam la mot ban ghi nhu vay (trinh duyet danh dau
   * hadRecentInput va khong tinh no vao CLS). Viec "khong xo dich ngoai cua so cu bam" duoc do rieng, dung dinh nghia
   * CLS, o bai "thay tam trang khong gay xo dich nao ngoai cua so cu bam". Cua so o day om tu giua lan loang qua het buoc
   * don, tuc dung cho troi cu va lop vet nuoc bi go: khuc de xo dich nhat cua ca hieu ung.
   */
  await expect(b.locator(".tha")).toBeHidden();
  // Ban ghi layout-shift sinh ra luc trinh duyet VE, khong phai luc DOM doi, nen doi them hai khung hinh: bat dem
  // ngay sau khi `hidden` duoc dat la con dem nham chinh cu thu hop lai.
  await b.evaluate(() => new Promise((xong) => requestAnimationFrame(() => requestAnimationFrame(() => xong(null)))));
  await demXoDich(b);
  const soVet = await b.locator(".loang .giot").count();
  console.log(`[tam-trang] so vet nuoc cua lan loang o ${b.viewportSize()?.width}px: ${soVet}`);
  expect(soVet).toBeGreaterThan(0);
  await expect(b.locator(".troi--cu")).toHaveCount(1);
  await expect(b.locator(".troi--cu")).toHaveAttribute("inert", "");
  await expect(b.locator(".troi--dang-loang")).toHaveCount(1);
  // Khong xo dich ngay giua lan loang.
  expect(await dinhTaiLieu(moc)).toBeCloseTo(mocTruoc, 2);
  expect((await dai.boundingBox())?.height ?? -1).toBeCloseTo(caoTruoc, 2);

  // Sau 3,2 giay: khong con lop loang nao trong DOM, khong con trai troi cu nao, khong hoat hinh nao con chay.
  await b.waitForTimeout(3200);
  await expect(b.locator(".loang")).toHaveCount(0);
  await expect(b.locator(".troi--cu")).toHaveCount(0);
  await expect(b.locator(".troi--dang-loang")).toHaveCount(0);
  // Bo qua CSSAnimation: net ve cua bau troi chay mai mai theo CSS, chi hoat hinh do lan loang tao ra moi phai tan.
  expect(await b.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && !(a instanceof CSSAnimation)).length)).toBe(0);
  // Chieu cao dai troi khong doi mot chut nao du bai tho moi dai ngan khac bai cu.
  expect(await dinhTaiLieu(moc)).toBeCloseTo(mocTruoc, 2);
  expect((await dai.boundingBox())?.height ?? -1).toBeCloseTo(caoTruoc, 2);
  expect(await xoDich(b), "co xo dich bo cuc khi thay tam trang").toBe(0);

  // Giam chuyen dong: doi thang, khong lop loang nao.
  await b.emulateMedia({ reducedMotion: "reduce" });
  await thaTaiCho(b, "cau-vong");
  await expect(b.getByRole("region", { name: "Tâm trạng của bạn" })).toHaveClass(/troi--cau-vong/);
  await expect(b.locator(".loang")).toHaveCount(0);
  await expect(b.locator(".troi--cu")).toHaveCount(0);
});

test("o cua so: doi qua doi lai giua hai bau troi, bang chuot va bang ban phim", async ({ browser }) => {
  // Yeu cau diem 20: chu du an chua bam thu duoc tinh nang nay, nen bai o day phai that su doi CA HAI chieu.
  // Du lieu: ca hai nguoi cung dang giu mot tam trang, vi o cua so chi hien ra khi do.
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  await tha(a, "mua-phun", "Nhớ cậu một chút thôi.");
  await tha(b, "nang-am");
  await b.goto("/ke-sach");
  await expect(b.locator(".troi-cua-so .troi[data-mat]")).toHaveCount(2);
  await choTayNghe(b);

  // Doc lop theo [data-mat] chu khong theo vai tro: mat dang bi cat mang aria-hidden nen no khong con vai tro region
  // nao de ma tim: chinh dieu do la thu hai dong getByRole ngay duoi chung minh.
  const kia = b.locator(".troi[data-mat=\"kia\"]");
  const minh = b.locator(".troi[data-mat=\"minh\"]");
  const vungKia = b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` });
  const vungMinh = b.getByRole("region", { name: "Tâm trạng của bạn" });
  await expect(kia).not.toHaveClass(/troi--an/);
  await expect(minh).toHaveClass(/troi--an/);
  await expect(vungKia).toBeVisible();
  await expect(vungMinh).toHaveCount(0);

  // Chieu mot: bam chuot vao o cua so -> troi cua minh thanh troi lon.
  await b.getByRole("button", { name: "Xem trời của bạn" }).click();
  await choSongTan(b);
  await expect(minh).not.toHaveClass(/troi--an/);
  await expect(kia).toHaveClass(/troi--an/);
  await expect(vungMinh).toBeVisible();
  await expect(vungKia).toHaveCount(0);
  await expect(b.getByText("Đang xem trời của bạn.")).toBeAttached();

  // Chieu hai: tieu diem o lai tren o cua so cua mat vua len lon, bam Enter la quay ve troi cua nguoi kia.
  const oLai = b.getByRole("button", { name: `Xem trời của ${tenCuaA}` });
  await expect(oLai).toBeFocused();
  await b.keyboard.press("Enter");
  await choSongTan(b);
  await expect(kia).not.toHaveClass(/troi--an/);
  await expect(minh).toHaveClass(/troi--an/);
  await expect(vungKia).toBeVisible();
  await expect(b.getByText(`Đang xem trời của ${tenCuaA}.`)).toBeAttached();

  // Ca hai mat deu co bong hoa lich hoa (spec muc 5). Dem theo the chu khong theo vai tro: mat dang bi cat nam ngoai
  // cay truy cap nen getByRole khong voi toi no duoc.
  await expect(kia.locator(".troi__cuoi a[href=\"/tam-trang\"] svg.hoa")).toHaveCount(1);
  await expect(minh.locator(".troi__cuoi a[href=\"/tam-trang\"] svg.hoa")).toHaveCount(1);
});

test("khong con gach chan o dau: hai nut chu trong dai troi, nut chu tren thanh dieu huong, bo dem qua han", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await tha(b, "nang-am");
  await b.goto("/ke-sach");
  const gach = (bo: string) => b.locator(bo).first().evaluate((el) => getComputedStyle(el).textDecorationLine);

  expect(await gach(".troi .btn--chu")).toBe("none");
  await b.locator(".troi .btn--chu").first().hover();
  expect(await gach(".troi .btn--chu")).toBe("none");

  // Phat hien N9: do RIENG nut chu cua thanh dieu huong. Gop no voi .nav__link trong mot bo chon la phep do luon roi
  // vao .nav__link (dung truoc trong cay va chua bao gio co gach chan), tuc dung cai nut ma spec muc 4 dan phai kiem
  // thi khong duoc do lan nao.
  expect(await gach(".nav .btn--chu")).toBe("none");
  await b.locator(".nav .btn--chu").hover();
  expect(await gach(".nav .btn--chu")).toBe("none");

  // Bo dem qua han: go 81 ky tu thi bo dem doi sang kieu bao loi ma van khong gach chan.
  await b.getByRole("button", { name: "Thả tâm trạng" }).click();
  await b.getByLabel("Lời nhắn").fill("x".repeat(81));
  await expect(b.locator(".nhan__dem--qua")).toHaveCount(1);
  expect(await gach(".nhan__dem--qua")).toBe("none");
});

test("do cua may cham: khung hinh dau tien, gia nhan ban o kinh, va duong chua kip do bo cuc luc ranh", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b } = await haiNguoiDaVao(browser);
  // Hai bau troi nang net nhat: mua rao 92 net, giong 74 net. O cua so mang troi cua nguoi con lai.
  await tha(a, "mua-rao", "Mưa cả buổi chiều, chẳng đi đâu được.");
  await tha(b, "giong");
  await b.goto("/ke-sach");
  await expect(b.locator(".troi-cua-so .troi[data-mat]")).toHaveCount(2);

  // Ho so tiet che 4 lan: dung dieu kien may yeu ma dai troi phai chiu duoc.
  const cdp = await b.context().newCDPSession(b);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  // Gia cua mot lan nhan ban o kinh (viec da duoc chuyen ra khoi lan bam, lam san luc ranh).
  const gia = await b.evaluate(() => {
    const kinh = document.querySelector<HTMLElement>(".troi-cua-so .cua-so__kinh");
    if (kinh === null) return { net: 0, ms: -1 };
    for (let i = 0; i < 50; i++) kinh.cloneNode(true);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) kinh.cloneNode(true);
    return { net: kinh.querySelectorAll("*").length, ms: (performance.now() - t0) / 200 };
  });
  console.log(`[tam-trang] nhan ban o kinh (${gia.net} phan tu), tiet che 4 lan: ${gia.ms.toFixed(2)}ms mot lan`);
  expect(gia.net).toBeGreaterThan(50);

  // So do bo cuc da lam san luc ranh (requestIdleCallback timeout 400ms): lan bam chi bat song.
  await choDoLucRanh(b);
  const moc = b.getByRole("heading", { level: 1, name: "Kệ sách" });
  const mocTruoc = (await moc.boundingBox())?.y ?? -1;
  await choTayNghe(b);
  await demXoDich(b);
  const dau = await doKhungDau(b);
  console.log(`[tam-trang] khung hinh dau tien, tiet che 4 lan, da do san: ${dau.ms.toFixed(1)}ms`);
  expect(dau.song, "khung hinh dau tien chua co lop song").toBe(4);
  expect(dau.lan).toBe(1);
  expect(dau.ms, "may cham 4 lan: song van phai hien trong khoang mot khung hinh cua may do").toBeLessThan(200);

  // Suot ca vong song tren may cham: tieu de Ke sach khong nhuc nhich, khong mot don vi xo dich nao.
  await choSongLanToi(b, 600);
  expect((await moc.boundingBox())?.y ?? -1).toBeCloseTo(mocTruoc, 2);
  await choSongTan(b);
  expect((await moc.boundingBox())?.y ?? -1).toBeCloseTo(mocTruoc, 2);
  expect(await xoDich(b), "co xo dich bo cuc khi may cham").toBe(0);

  // Duong du phong: nguoi dung bam TRUOC khi lan do bo cuc luc ranh kip chay. Chan requestIdleCallback de lan bam nao
  // cung phai tu do bo cuc (doHinh dong bo trong tay nghe) - ca nay van phai ra song trong khung hinh dau tien.
  await b.addInitScript(() => {
    Object.defineProperty(window, "requestIdleCallback", { value: () => 0, configurable: true });
  });
  await b.reload();
  await expect(b.locator(".troi-cua-so .troi[data-mat]")).toHaveCount(2);
  await b.waitForLoadState("networkidle");
  expect(await b.evaluate(() => typeof (window as { requestIdleCallback?: unknown }).requestIdleCallback)).toBe("function");
  await choTayNghe(b);
  await demXoDich(b);
  const chuaDo = await doKhungDau(b);
  console.log(`[tam-trang] khung hinh dau tien, tiet che 4 lan, chua kip do luc ranh: ${chuaDo.ms.toFixed(1)}ms`);
  expect(chuaDo.song, "khung hinh dau tien chua co lop song").toBe(4);
  expect(chuaDo.lan).toBe(1);
  expect(chuaDo.ms, "duong du phong: do bo cuc ngay trong tay nghe van phai kip mot khung hinh cua may do").toBeLessThan(200);
  await choSongTan(b);
  expect(await xoDich(b), "co xo dich bo cuc o duong du phong").toBe(0);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});

test("nam be rong khong tran ngang; vung bam 44px o be rong cam ung, tru mien tru co ten", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  await tha(a, "cau-vong", "Vừa làm lành với sếp, nhẹ cả người.");
  await tha(b, "mua-rao");
  for (const width of NAM_BE_RONG) {
    await b.setViewportSize({ width, height: 900 });
    await b.goto("/ke-sach");
    await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toBeVisible();
    await b.getByRole("button", { name: "Thả tâm trạng" }).click();
    await expect(b.locator(".tha")).toBeVisible();
    await choHoatHinhXong(b, ".tha");
    expect(await tranNgang(b), `ke sach, hop chon mo, o ${width}px`).toEqual([]);
    if (width === BE_RONG_CHAM) expect(await vungBamNho(b, MIEN_TRU_HOP), "ke sach: vung bam").toEqual([]);

    await b.goto("/tam-trang");
    await expect(b.getByRole("heading", { level: 1, name: "Lịch hoa" })).toBeVisible();
    expect(await tranNgang(b), `lich hoa o ${width}px`).toEqual([]);
    // Do vung bam o CA 320 va 375: o ngay hep nhat o 320, nen mot mien tru do o 375 chua chung minh duoc gi cho 320.
    if (BE_RONG_DO_BAM.has(width)) {
      const nho = await vungBamNho(b);
      expect(nho.filter((dong) => !O_NGAY.test(dong)), `lich hoa o ${width}px: vung bam`).toEqual([]);
      for (const dong of nho.filter((d) => O_NGAY.test(d))) expect(canhNgan(dong), `${width}px: ${dong}`).toBeGreaterThanOrEqual(O_NGAY_MIN);
    }
  }
});

test("CSP: ke sach co bau troi va lich hoa khong vi pham chinh sach nao", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  await tha(a, "gio-thoang");
  await b.addInitScript(() => {
    const w = window as unknown as { viPhamCsp?: string[] };
    w.viPhamCsp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.viPhamCsp?.push(`${e.effectiveDirective} <- ${e.blockedURI}`);
    });
  });
  const dongCsp: string[] = [];
  b.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(m.text())) dongCsp.push(m.text());
  });
  for (const duong of ["/ke-sach", "/tam-trang"]) {
    await b.goto(duong);
    await expect(b.locator("main")).toBeVisible();
    expect(await b.evaluate(() => (window as unknown as { viPhamCsp?: string[] }).viPhamCsp ?? []), duong).toEqual([]);
  }
  expect(dongCsp).toEqual([]);
});

test("anh chup chin bau troi, hop chon va lich hoa de cham giao dien", async ({ browser }) => {
  test.skip(process.env.CHUP_TAM_TRANG !== "1", "chi chay khi cham giao dien: dat CHUP_TAM_TRANG=1");
  test.setTimeout(900_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  for (const w of WEATHERS) {
    await tha(a, w, w === "mua-phun" ? "Nhớ cậu một chút thôi." : "");
    for (const giam of [false, true]) {
      await b.emulateMedia({ reducedMotion: giam ? "reduce" : "no-preference" });
      for (const width of [375, 1280]) {
        await b.setViewportSize({ width, height: 900 });
        await b.goto("/ke-sach");
        await expect(b.getByRole("region", { name: `Tâm trạng của ${tenCuaA}` })).toHaveClass(`troi troi--${w}`);
        await b.screenshot({ path: `test-results/tam-trang/troi-${w}-${width}${giam ? "-giam" : ""}.png` });
      }
    }
  }
  await b.emulateMedia({ reducedMotion: "no-preference" });

  // Dai troi, hop chon va lich hoa o ca nam be rong, ca hai che do chuyen dong.
  await tha(b, "mua-phun");
  for (const width of NAM_BE_RONG) {
    for (const giam of [false, true]) {
      const hau = giam ? "-giam" : "";
      await a.emulateMedia({ reducedMotion: giam ? "reduce" : "no-preference" });
      await a.setViewportSize({ width, height: 900 });
      await a.goto("/ke-sach");
      await a.screenshot({ path: `test-results/tam-trang/cua-so-${width}${hau}.png` });
      await a.getByRole("button", { name: "Thả tâm trạng" }).click();
      await a.screenshot({ path: `test-results/tam-trang/hop-chon-${width}${hau}.png`, fullPage: true });
      await a.goto("/tam-trang");
      await a.screenshot({ path: `test-results/tam-trang/lich-hoa-${width}${hau}.png`, fullPage: true });
    }
    // Khoanh khac song dang lan va sau khi doi xong: chi co o che do chuyen dong thuong.
    await a.emulateMedia({ reducedMotion: "no-preference" });
    await a.goto("/ke-sach");
    await a.locator(".cua-so").first().click();
    // Chup dung pha cua song (moc do chinh vong song bao), roi chup lai sau khi song tan han.
    await choSongLanToi(a, 900);
    await a.screenshot({ path: `test-results/tam-trang/cua-so-song-${width}.png` });
    await choSongTan(a);
    await a.screenshot({ path: `test-results/tam-trang/cua-so-doi-${width}.png` });
  }
});
