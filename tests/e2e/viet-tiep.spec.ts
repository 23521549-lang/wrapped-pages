import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { biaCua, dangTrang, docSach, dongContextCu, haiNguoiDaVao, nhacCua, taoSach } from "./kho-sach";
import { chonBia } from "./media";

/*
 * Trang Viet tiep: chon bia va nhac cho LUOT SAP DANG roi mo man viet. Truoc chang nay, san pham khong co cach nao doi
 * bia hay nhac cua mot cuon sau khi tao, va moi lan dang deu khong sinh o bia lan o nhac nao. Tep nay di tron ba duong
 * cua spec muc 13.
 */

const MA = "dQw4w9WgXcQ";

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

test("chon bia va nhac moi o trang Viet tiep: the tren ke mang bia moi, man doc phat nhac moi", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(a);

  // Luot dau tien chi co o bia MO DAU do createBook chen.
  expect((await biaCua(id)).map((o) => [o.roundId === null, o.cover])).toEqual([[true, "nui-xa"]]);

  await docSach(a, id);
  await a.getByRole("link", { name: "Viết tiếp" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet-tiep$`));
  await a.getByRole("radio", { name: "Bìa cành hoa đào" }).check();
  await a.getByLabel("Nhạc nền").fill(`https://youtu.be/${MA}`);
  await a.getByRole("button", { name: "Viết trang" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));

  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt thứ hai.");
  await dangTrang(a);

  // Hai o bia: o mo dau giu nguyen tranh cu, o cua luot vua dang mang tranh moi.
  const bia = await biaCua(id);
  expect(bia.map((o) => o.cover)).toEqual(["nui-xa", "hoa-dao"]);
  expect(bia[1].roundId).not.toBeNull();
  expect(await nhacCua(id)).toBeNull();

  // The tren ke lay bia MOI NHAT. Loc theo .cuon chu khong theo vai tro listitem: dong Hoat dong cung la listitem va
  // cung mang ten sach, nen mot bo loc theo chu se cham vao no truoc.
  await a.goto("/ke-sach");
  await expect(a.locator(".cuon", { hasText: "Chuyện chưa kể" }).locator(".bia--hoa-dao")).toBeVisible();
});

test("khong chon gi o trang Viet tiep: cuon giu nguyen bia va nhac, dong thoi gian khong dai ra", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Sổ tay chạy bộ", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(a);

  await a.goto(`/sach/${id}/viet-tiep`);
  await expect(a.getByRole("radio", { name: /Giữ bìa đang dùng/ })).toBeChecked();
  await a.getByRole("button", { name: "Viết trang" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt thứ hai.");
  await dangTrang(a);

  // Van dung mot o bia (o mo dau), khong sinh o nao cho luot vua dang.
  expect((await biaCua(id)).map((o) => o.cover)).toEqual(["nui-xa"]);
  expect(await nhacCua(id)).toBeNull();
});

test("tai nhieu anh bia lien tiep roi chon lai anh dau tien: moi anh con trong bang", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(a);

  await a.goto(`/sach/${id}/viet-tiep`);
  const bang = a.getByRole("group", { name: "Bìa" });
  const demO = () => bang.getByRole("radio").count();
  const truoc = await demO();

  await chonBia(a, "anh-1.jpg");
  await expect.poll(demO).toBe(truoc + 1);
  await chonBia(a, "anh-2.jpg");
  await expect.poll(demO).toBe(truoc + 2);

  // Anh dau van chon lai duoc: khong o nao bi the cho.
  const anh = bang.getByRole("radio", { name: /Ảnh của bạn/ });
  await expect(anh).toHaveCount(2);
  await anh.last().check();
  await expect(anh.last()).toBeChecked();

  await a.getByRole("button", { name: "Viết trang" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));

  // Mo lai trang: ca hai anh van con trong kho, va anh vua chon van dang duoc chon.
  await a.goto(`/sach/${id}/viet-tiep`);
  await expect(bang.getByRole("radio", { name: /Ảnh của bạn/ })).toHaveCount(2);
  await expect(bang.getByRole("radio", { name: /Ảnh của bạn/ }).last()).toBeChecked();
});

test("trang Viet tiep khong co o ten sach va khong co muc Ai doc duoc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.goto(`/sach/${id}/viet-tiep`);
  await expect(a.getByLabel("Tên sách")).toHaveCount(0);
  await expect(a.getByRole("group", { name: "Ai đọc được" })).toHaveCount(0);
  await expect(a.getByRole("group", { name: "Bìa" })).toBeVisible();
  await expect(a.getByLabel("Nhạc nền")).toBeVisible();
});

test("cuon cua nguoi kia: trang Viet tiep tra 404", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const r = await b.goto(`/sach/${id}/viet-tiep`);
  expect(r?.status()).toBe(404);
});

/**
 * O dang chon co nam tron trong phan thay duoc cua khung cuon bang bia khong. Chi trinh duyet that do duoc: jsdom tra 0
 * cho moi toa do, nen bai don vi khong the thay bang bia mo ra bi cuon lech.
 */
async function oChonTrongKhung(page: Page): Promise<string> {
  return page.evaluate(() => {
    const vung = document.querySelector(".cuon-vung");
    const o = vung?.querySelector("input:checked")?.closest(".swatch");
    if (!vung || !o) return "khong thay o dang chon";
    const k = vung.getBoundingClientRect();
    const r = o.getBoundingClientRect();
    if (r.top >= k.top - 1 && r.bottom <= k.bottom + 1) return "trong khung";
    return `ngoai khung: o ${Math.round(r.top)} toi ${Math.round(r.bottom)}, khung ${Math.round(k.top)} toi ${Math.round(k.bottom)}`;
  });
}

test("mo trang Viet tiep thi o dang chon nam trong phan thay duoc cua bang bia, ca o dau bang lan o giua bang", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Lượt đầu tiên.");
  await dangTrang(a);
  // Man hep: luoi hai cot, bang bia cao gap may lan khung cuon.
  await a.setViewportSize({ width: 375, height: 800 });

  await a.goto(`/sach/${id}/viet-tiep`);
  await expect(a.getByRole("radio", { name: /Giữ bìa đang dùng/ })).toBeChecked();
  expect(await oChonTrongKhung(a), "o dau bang").toBe("trong khung");

  // O o giua bang: chon roi gui (ban nhap giu lua chon), mo lai trang.
  const hoaDao = a.locator('label.swatch:has(input[value="hoa-dao"]:not([data-anh]))');
  await hoaDao.scrollIntoViewIfNeeded();
  await hoaDao.click();
  await a.getByRole("button", { name: "Viết trang" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));
  await a.goto(`/sach/${id}/viet-tiep`);
  await expect(a.getByRole("radio", { name: "Bìa cành hoa đào" })).toBeChecked();
  expect(await oChonTrongKhung(a), "o giua bang").toBe("trong khung");
});
