import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetDb } from "./db";
import {
  biaCua, dangToThang, dangTrang, datDauLuotMoi, datNhac, dongContextCu, haiNguoiDaVao, nhacCua, nhacTheoLuot, taoSach, veCuoiTaiLieu,
} from "./kho-sach";
import { dangKemNiemPhong } from "./niem-phong";
import { BE_RONG } from "./vung-bam";
import { giaYoutube } from "./youtube-gia";

/*
 * Man Sua sach (chu du an duyet 28/09): cung thu tu voi trang Sach moi, Bia va Nhac nen la hai dong thoi gian theo luot,
 * thu gon mac dinh. Bam mot moc thi bang chon rũ xuống duoi moc; chon la luu, roi bang cuon len. Day la cho duy nhat sua
 * duoc mot o bia hay o nhac da co, nen moi buoc deu kiem thang trong database.
 */

const MA = "dQw4w9WgXcQ";
const MA_HAI = "5qap5aO4i9A";

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

/** Tao mot cuon va dang hai luot, moi luot mot to. Tra ma sach. */
async function haiLuot(page: Page, ten: string): Promise<string> {
  const id = await taoSach(page, ten, "chia-se");
  await page.locator(".viet-chu .ProseMirror").click();
  await page.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(page);
  await page.goto(`/sach/${id}/viet`);
  await page.locator(".viet-chu .ProseMirror").click();
  await page.keyboard.insertText("Lượt thứ hai.");
  await dangTrang(page);
  return id;
}

/** Mo mot dong thoi gian (bam dong tom tat) va tra ve khung cua no. */
async function moDong(page: Page, nhan: "Bìa" | "Nhạc nền"): Promise<Locator> {
  const muc = page.getByRole("group", { name: nhan, exact: true });
  const tom = muc.getByRole("button", { name: /Theo lượt$/ });
  await expect(tom).toHaveAttribute("aria-expanded", "false");
  await tom.click();
  await expect(muc.getByRole("button", { name: /Thu gọn$/ })).toHaveAttribute("aria-expanded", "true");
  return muc;
}

/**
 * Bang bia co the dai hon khung cuon cua no, nen mot o co the dang nam ngoai phan thay duoc. Keo o vao tam nhin roi bam
 * vao chinh cai nhan bao no, dung nhu nguoi dung lam: o radio that nam kin duoi nhan, khong ai bam thang vao no.
 */
async function bamNhanBia(bang: Locator, chon: string): Promise<void> {
  const nhan = bang.locator(chon);
  await nhan.scrollIntoViewIfNeeded();
  await nhan.click();
}
const oBia = (khoa: string) => `label.swatch:has(input[value="${khoa}"]:not([data-anh]))`;

test("thu tu cac truong nhu trang Sach moi, khong con khung Noi dung, hai dong thoi gian thu gon san", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");
  await a.goto(`/sach/${id}/sua`);

  const cao = async (l: Locator) => {
    const hop = await l.boundingBox();
    if (!hop) throw new Error("khong do duoc truong");
    return hop.y;
  };
  const thuTu = [
    await cao(a.getByLabel("Tên sách")),
    await cao(a.getByRole("group", { name: "Bìa", exact: true })),
    await cao(a.getByRole("group", { name: "Nhạc nền", exact: true })),
    await cao(a.getByRole("group", { name: "Ai đọc được", exact: true })),
  ];
  expect(thuTu).toEqual([...thuTu].sort((x, y) => x - y));
  await expect(a.getByText("Nội dung", { exact: true })).toHaveCount(0);
  await expect(a.locator('a[href*="/sua-luot/"]')).toHaveCount(0);
  for (const ma of ["bia", "nhac"]) await expect(a.locator(`#${ma}-mo`)).toHaveAttribute("inert", "");
});

test("dat bia cho mot luot: chon la luu, bang cuon len, Esc thu bang, Hoan tac tra lai; ke lay bia moi nhat", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");
  await a.goto(`/sach/${id}/sua`);
  const bia = await moDong(a, "Bìa");
  await expect(a.locator("#bia-mo .tg-o")).toHaveCount(3);

  // Moc cuoi la luot thu hai, giu bia truoc. Esc thu bang chon va tra focus ve moc.
  const moc2 = a.locator("#bia-moc-2");
  await expect(moc2).toContainText("Giữ bìa trước");
  await moc2.click();
  const bang2 = a.getByRole("group", { name: "Bìa lượt 2", exact: true });
  await expect(bang2.getByRole("radio", { name: "Giữ bìa trước" })).toBeChecked();
  await a.keyboard.press("Escape");
  await expect(moc2).toHaveAttribute("aria-expanded", "false");
  await expect(moc2).toBeFocused();

  // Chon bia khom truc: luu ngay, bang cuon len, focus ve moc, dong bao co Hoan tac.
  await moc2.click();
  await bamNhanBia(bang2, oBia("khom-truc"));
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa", "khom-truc"]);
  await expect(moc2).toHaveAttribute("aria-expanded", "false");
  await expect(moc2).toBeFocused();
  await expect(moc2).toContainText("Khóm trúc");
  await expect(moc2).toContainText("Đang dùng");
  await expect(bia.locator(".tg__bao")).toContainText("Đã lưu bìa lượt 2.");

  await bia.getByRole("button", { name: "Hoàn tác" }).click();
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa"]);
  await expect(bia.locator(".tg__bao")).toHaveText("Đã trả lại như cũ.");
  await expect(moc2).toContainText("Giữ bìa trước");

  // Dat lai khom truc, roi doi o MO DAU: ke van ve bia moi nhat.
  await moc2.click();
  await bamNhanBia(bang2, oBia("khom-truc"));
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa", "khom-truc"]);
  await a.locator("#bia-moc-0").click();
  const bang0 = a.getByRole("group", { name: "Bìa lúc tạo sách", exact: true });
  // O mo dau khong bo duoc: khong co lua chon giu bia truoc.
  await expect(bang0.getByRole("radio", { name: "Giữ bìa trước" })).toHaveCount(0);
  await bamNhanBia(bang0, oBia("trang-nuoc"));
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["trang-nuoc", "khom-truc"]);

  await a.goto("/ke-sach");
  await expect(a.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".bia--khom-truc")).toBeVisible();
});

test("chon Giu bia truoc thi bo o bia cua luot do", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");
  await a.goto(`/sach/${id}/sua`);
  await moDong(a, "Bìa");

  const moc1 = a.locator("#bia-moc-1");
  await moc1.click();
  const bang1 = a.getByRole("group", { name: "Bìa lượt 1", exact: true });
  await bamNhanBia(bang1, oBia("hoa-dao"));
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa", "hoa-dao"]);
  // Luot sau giu bia cua luot nay: bia nho cua moc 2 la hoa dao, mo di.
  await expect(a.locator("#bia-moc-2 .tg-dong__bia--giu.bia--hoa-dao")).toBeVisible();

  await moc1.click();
  await bamNhanBia(bang1, "label.swatch--giu");
  await expect.poll(async () => (await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa"]);
  await expect(moc1).toContainText("Giữ bìa trước");
  await expect(a.locator("#bia-moc-0")).toContainText("Đang dùng");
});

test("nhac theo luot: dan link la luu, Tat nhac tu mot luot thi man doc khong con khung nhac nen", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await haiLuot(a, "Chuyện chưa kể");
  await datNhac(id, MA);
  await a.goto(`/sach/${id}`);
  await expect(a.getByRole("heading", { name: "Nhạc nền" })).toBeVisible();

  await a.goto(`/sach/${id}/sua`);
  const nhac = await moDong(a, "Nhạc nền");
  await expect(a.locator("#nhac-mo .tg-o")).toHaveCount(3);
  await expect(a.locator("#nhac-moc-0")).toContainText("Đang phát");
  await expect(a.locator("#nhac-moc-1")).toContainText("Phát tiếp");

  // Luot 1: chon Mot bai, dan link, doc ra video la luu.
  const moc1 = a.locator("#nhac-moc-1");
  await moc1.click();
  const bang1 = a.getByRole("group", { name: "Nhạc lượt 1", exact: true });
  await bang1.getByRole("radio", { name: "Một bài", exact: true }).check();
  await bang1.getByRole("textbox", { name: "Link YouTube" }).fill(`https://youtu.be/${MA_HAI}`);
  await expect.poll(async () => (await nhacTheoLuot(id)).map((o) => o.youtubeId)).toEqual([MA, MA_HAI]);
  await expect(moc1).toHaveAttribute("aria-expanded", "false");
  await expect(moc1).toContainText("Đang phát");
  await expect(nhac.locator(".tg__bao")).toContainText("Đã lưu nhạc lượt 1.");

  // Luot 2: Tat nhac. O mo dau van giu ma cu (lich su khong bi viet lai), nhung nhac hien hanh la o moi nhat: im.
  await a.locator("#nhac-moc-2").click();
  await a.getByRole("group", { name: "Nhạc lượt 2", exact: true }).getByRole("radio", { name: "Tắt nhạc", exact: true }).check();
  await expect.poll(async () => (await nhacTheoLuot(id)).map((o) => o.youtubeId)).toEqual([MA, MA_HAI, null]);
  await expect(a.locator("#nhac-moc-2")).toContainText("Tắt nhạc từ lượt này");
  await expect(nhac.getByRole("button", { name: /Theo lượt$|Thu gọn$/ })).toContainText("Không có nhạc");
  expect(await nhacCua(id)).toBe(MA);
  await a.goto(`/sach/${id}`);
  await expect(a.getByRole("heading", { name: "Nhạc nền" })).toHaveCount(0);
});

/*
 * Ba man dung khung .tao (Sach moi, Sua sach, Viet tiep) o 320px: form va the xem truoc nam tron trong khung. Truoc day ten
 * sach dai tren the xem truoc (mot dong, dau ba cham) va svg bia (be rong mac dinh 300px) dat be rong toi thieu cho luoi
 * .tao va luoi .xem-truoc, day ca hai ra 312px trong khung 272px; phan tran bi mot to tien overflow-x: clip cat mat, nen
 * cong tranNgang (chi tinh phan con thay) khong bat duoc. Do thang mep phai o day, voi ten dai.
 */
test("o 320px form va the xem truoc cua Sach moi, Sua sach, Viet tiep nam tron trong cot", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const TEN = "Những bữa sáng ở quán cà phê cũ đầu ngõ";
  const id = await taoSach(a, TEN, "chia-se");
  await dangToThang(id, "Lượt đầu tiên.");
  await a.setViewportSize({ width: 320, height: 900 });
  for (const duong of ["/sach/moi", `/sach/${id}/sua`, `/sach/${id}/viet-tiep`]) {
    await a.goto(duong);
    await expect(a.locator(".xem-truoc")).toBeVisible();
    if (duong === "/sach/moi") await a.getByLabel("Tên sách").fill(TEN);
    await expect(a.locator(".xem-truoc .book__ten")).toHaveText(TEN);
    // Moi phan tu trong khung (khong nam trong mot to tien tu cat phan tran cua no) phai nam tron trong mep phai khung.
    const tran = await a.evaluate(() => {
      const tao = document.querySelector<HTMLElement>(".tao");
      if (!tao) throw new Error("khong thay khung .tao");
      const phai = tao.getBoundingClientRect().right;
      const tuCat = (el: Element) => {
        for (let cha = el.parentElement; cha && cha !== tao; cha = cha.parentElement) {
          if (getComputedStyle(cha).overflowX !== "visible") return true;
        }
        return false;
      };
      return Array.from(tao.querySelectorAll("*"))
        .filter((el) => el.getBoundingClientRect().right > phai + 0.5 && !tuCat(el))
        .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}: ${Math.round(el.getBoundingClientRect().right)} > ${Math.round(phai)}`);
    });
    expect(tran, `${duong}: tran mep phai cua khung`).toEqual([]);
  }
});

test("cuon cua nguoi kia: man sua sach khong toi duoc", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const r = await b.goto(`/sach/${id}/sua`);
  expect(r?.status()).toBe(404);
});

/** Doi moi nhip chuyen dong (mo, thu, rũ) chay xong. */
async function xongNhip(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((h) => h.playState !== "running"));
}

/*
 * Anh chup de cham giao dien (CLAUDE.md muc 5 buoc 6): Sua sach (thu gon; mo hai dong thoi gian voi bang chon duoi mot
 * moc), Sua luot (chu vua them, chu cu bi xoa; luot niem phong) va hai trang Dau thoi gian, o bon be rong bat buoc cong
 * 1280, ca hai che do chuyen dong. Chi chay khi dat CHUP_DOT_BON=1; anh nam trong test-results/dot-bon.
 */
test("anh chup sua sach, sua luot va dau thoi gian de cham giao dien", async ({ browser }) => {
  test.skip(process.env.CHUP_DOT_BON !== "1", "chi chay khi cham giao dien: dat CHUP_DOT_BON=1");
  test.setTimeout(900_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Những bữa sáng ở quán cũ", "chia-se");
  await datNhac(id, MA);
  await dangToThang(id, "Chiều nay anh đi ngang hiệu sách cũ ở góc phố.", "Em có nhớ quán nước đầu hẻm không.");
  await datDauLuotMoi(id, { cover: "chim-bay" });
  await dangToThang(id, "Mai anh sẽ kể tiếp chuyện hôm đó.");
  await datDauLuotMoi(id, { cover: "cau-go", youtubeId: null });
  await dangToThang(id, "Tối nay trời trở gió.");
  await datDauLuotMoi(id, { youtubeId: MA_HAI });
  const idNiem = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, ["Em tới sớm hơn giờ hẹn bốn mươi phút.", "Quán nhỏ tới mức chỉ có bốn cái bàn."], {
    kind: "cau-do", question: "Quán tên gì?", answers: ["quan may"], hints: [],
  });
  await giaYoutube(a);

  const thu = "test-results/dot-bon";
  for (const giam of [false, true]) {
    await a.emulateMedia({ reducedMotion: giam ? "reduce" : "no-preference" });
    const hau = giam ? "-giam" : "";
    for (const w of [...BE_RONG, 1280]) {
      await a.setViewportSize({ width: w, height: 900 });

      await a.goto(`/sach/${id}/sua`);
      await expect(a.getByLabel("Tên sách")).toBeVisible();
      await a.screenshot({ path: `${thu}/sua-sach-gon-${w}${hau}.png`, fullPage: true });
      await moDong(a, "Bìa");
      await a.locator("#bia-moc-2").click();
      await xongNhip(a);
      await a.screenshot({ path: `${thu}/sua-sach-bia-${w}${hau}.png`, fullPage: true });
      await a.locator("#bia-moc-2").click();
      await moDong(a, "Nhạc nền");
      await a.locator("#nhac-moc-3").click();
      await xongNhip(a);
      await a.screenshot({ path: `${thu}/sua-sach-nhac-${w}${hau}.png`, fullPage: true });

      // Sua luot 2: xoa chu "đó" o cuoi va viet them, de thay ca chu moi lan chu cu bi xoa.
      await a.goto(`/sach/${id}/sua-luot/2`);
      const giay = a.locator(".viet-chu .ProseMirror");
      await expect(giay).toHaveAttribute("contenteditable", "true");
      await giay.click();
      await veCuoiTaiLieu(a);
      for (let i = 0; i < 3; i++) await a.keyboard.press("Backspace");
      await a.keyboard.insertText("ấy, và cả chuyện con mèo.");
      await expect(a.locator(".viet-chu .chu-mat")).toHaveCount(1);
      await a.screenshot({ path: `${thu}/sua-luot-${w}${hau}.png`, fullPage: true });
      await a.getByRole("button", { name: "Hủy" }).click();
      await a.getByRole("button", { name: "Bỏ thay đổi" }).click();
      await a.waitForURL(new RegExp(`/sach/${id}[?]trang=[0-9]+$`));

      await a.goto(`/sach/${idNiem}/sua-luot/1`);
      await expect(a.locator(".viet-chu .ProseMirror")).toHaveAttribute("contenteditable", "true");
      await a.screenshot({ path: `${thu}/sua-luot-niem-phong-${w}${hau}.png`, fullPage: true });

      await a.goto(`/dau-thoi-gian/${id}`);
      await expect(a.locator(".dtg-nhac__may iframe")).toBeAttached();
      await a.screenshot({ path: `${thu}/dau-thoi-gian-${w}${hau}.png`, fullPage: true });
      await a.goto("/dau-thoi-gian");
      await expect(a.locator(".dtg-dong").first()).toBeVisible();
      await a.screenshot({ path: `${thu}/dau-thoi-gian-chon-${w}${hau}.png`, fullPage: true });
    }
  }
});
