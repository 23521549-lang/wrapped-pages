import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn. ";

/**
 * So to sau khi bo xep trang on dinh. Dem ngay sau khi go xong co the roi vao luc bo xep trang con dang dung
 * them to, nen doi phong chu nap xong (phong nap tre lam xep lai), roi doc so to, so dau ngat trang va
 * dau man viet CUNG MOT LUOT trong mot page.evaluate (doc cac gia tri lien quan trong cung mot
 * khung hinh) - doc rieng tung gia tri bang cac lenh locator tach biet co the roi vao hai ban ve khac nhau
 * cua bo xep trang duoi tai may (soToOnDinh tung tra 3 to trong khi .ngat-trang da len 4 to).
 * Lap toi khi so dau ngat dung bang so to tru mot, dau man viet khop so to, va da co it nhat hai to.
 */
async function soToOnDinh(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let soTo = 0;
  await expect(async () => {
    const { sheets, breaks, header } = await page.evaluate(() => ({
      sheets: document.querySelectorAll(".viet-to").length,
      breaks: document.querySelectorAll(".ngat-trang").length,
      header: document.querySelector(".viet-dau")?.textContent ?? "",
    }));
    expect(sheets).toBeGreaterThanOrEqual(2);
    expect(breaks).toBe(sheets - 1);
    expect(header).toContain(`${sheets} trang`);
    soTo = sheets;
  }).toPass({ timeout: 15_000 });
  return soTo;
}

/**
 * Hinh hoc cua tai lieu dang soan, doc bang SO KY TU chu khong bang toa do (toa do doi theo thu phong va cuon
 * trang, con "cho nay nam truoc ky tu thu bao nhieu" la dung cai bo xep trang quyet dinh):
 * - `ngat`: moi cho ngat trang nam truoc ky tu thu bao nhieu cua ca tai lieu;
 * - `dong`: trong tung doan, ky tu dau moi dong xuong hang nam o vi tri nao.
 *
 * `dong` la phep do nhay hon `ngat`: bo xep trang dung dung danh sach dau dong nay (xem measure.ts dauDong) de
 * tinh cho ngat, nen mot thay doi lam dich MOT dong o giua tai lieu bi bat ngay ca khi no chua du de day mot
 * cho ngat sang ky tu khac.
 */
async function hinhHocChu(page: Page): Promise<{ ngat: number[]; dong: number[][] }> {
  return page.evaluate(() => {
    const goc = document.querySelector(".viet-chu .ProseMirror");
    if (!goc) return { ngat: [], dong: [] };
    const ngat = Array.from(document.querySelectorAll(".viet-chu .ngat-trang"), (el) => {
      const khoang = document.createRange();
      khoang.setStart(goc, 0);
      khoang.setEndBefore(el);
      return khoang.toString().length;
    });
    const khoang = document.createRange();
    const dong = Array.from(goc.querySelectorAll("p"), (p) => {
      const chu: Text[] = [];
      const di = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let n = di.nextNode(); n; n = di.nextNode()) if ((n as Text).length > 0) chu.push(n as Text);
      const dau: number[] = [];
      let truoc: number | null = null;
      let viTri = 0;
      for (const n of chu) {
        for (let i = 0; i < n.length; i++, viTri++) {
          khoang.setStart(n, i);
          khoang.setEnd(n, i + 1);
          const hop = khoang.getClientRects();
          if (hop.length === 0) continue;
          const dinh = hop[hop.length - 1].top;
          if (truoc === null || dinh > truoc + 0.5) {
            dau.push(viTri);
            truoc = dinh;
          }
        }
      }
      return dau;
    });
    return { ngat, dong };
  });
}

test("viet qua mot to thi chu tran sang to sau, dung o dinh vung chu", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }

  const tos = a.locator(".viet-to");
  const soTo = await soToOnDinh(a);

  const ngat = a.locator(".ngat-trang");
  await expect(ngat).toHaveCount(soTo - 1);
  for (let i = 0; i < soTo - 1; i++) {
    const kd = (await ngat.nth(i).boundingBox())!;
    const to = (await tos.nth(i + 1).boundingBox())!;
    const k = to.width / 360;
    // Day khoi dem = dinh vung chu cua to sau (dinh to + padding tren 36px, da thu phong).
    expect(Math.abs(kd.y + kd.height - (to.y + 36 * k))).toBeLessThan(2);
  }
});

/**
 * Rao view.composing: doi decoration ngat trang giua luc bo go dang ghep chu (Telex dung dau) se lam hong
 * chu dang go. Phat that su hai su kien CompositionEvent tren DOM cua ProseMirror - day la cach
 * prosemirror-view tu dat/xoa co view.composing (khong phu thuoc IME that cua he dieu hanh), nen day la
 * phep thu trung dich, khong phai gia lap suong.
 */
test("dang ghep chu thi hoan xep trang lai; xep xong luc bo go ket thuc", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  const editor = a.locator(".viet-chu .ProseMirror");
  await editor.click();

  const ngat = a.locator(".ngat-trang");
  await expect(ngat).toHaveCount(0);

  await editor.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));

  // Du chu de tran qua nhieu to neu xep trang chay ngay - dung de kiem tra viec do co bi hoan lai hay khong.
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }

  // Van dang "ghep chu": du da qua rat lau so voi CHO_MS (120ms) cua usePagedLayout, xep trang van chua chay.
  await a.waitForTimeout(400);
  await expect(ngat).toHaveCount(0);
  await expect(a.locator(".viet-dau")).toContainText("1 trang");

  await editor.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));

  const soTo = await soToOnDinh(a);
  await expect(ngat).toHaveCount(soTo - 1);
});

/*
 * Dau "doan tren ke" khong duoc dich cho ngat trang di mot ly nao. Man viet ve dau nay bang mot
 * <span class="doan-ke"> nam ngay trong dong van, con man doc bo han dau (DocView khong boc mark nay), nen neu
 * cai span do cham toi hinh hoc cua dong chu thi hai man se ngat trang khac cho nhau - dieu CLAUDE.md muc 1 cam.
 * Bai kiem CSS o tests/unit/doan-ke.test.ts chi canh duoc danh sach thuoc tinh trong tep .css; chi trinh duyet
 * that moi tra loi duoc cau hoi "them mot phan tu inline vao giua dong chu co lam xuong dong khac di khong".
 * Danh dau CA tai lieu de moi to deu mang dau, ke ca chu nam hai ben tung cho ngat.
 */
test("danh dau doan tren ke khong doi so to va khong doi cho ngat trang", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Chuyện chưa kể", "chia-se");
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  for (let i = 0; i < 10; i++) {
    await a.keyboard.insertText(DOAN.repeat(2).trim());
    await a.keyboard.press("Enter");
  }

  const soTruoc = await soToOnDinh(a);
  const truoc = await hinhHocChu(a);
  expect(truoc.ngat).toHaveLength(soTruoc - 1);
  // Chu phai that su xuong dong nhieu lan, neu khong thi phep so sanh ben duoi khong chung minh dieu gi.
  expect(truoc.dong.filter((d) => d.length > 1).length).toBeGreaterThanOrEqual(10);
  await expect(giay.locator("span.doan-ke")).toHaveCount(0);

  await giay.click();
  await a.keyboard.press("Control+a");
  await a.getByRole("button", { name: "Chọn làm đoạn trên kệ" }).click();
  await expect(a.getByRole("button", { name: "Bỏ đoạn trên kệ" })).toHaveAttribute("aria-pressed", "true");
  // Dau nam that tren chu cua ca tai lieu, khong phai mot goc: it nhat mot vet to cho moi doan da go.
  expect(await giay.locator("span.doan-ke").count()).toBeGreaterThanOrEqual(10);

  expect(await soToOnDinh(a)).toBe(soTruoc);
  expect(await hinhHocChu(a)).toEqual(truoc);
});
