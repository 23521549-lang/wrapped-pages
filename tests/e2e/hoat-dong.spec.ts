import { test, expect, type Locator, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocJson } from "@/lib/doc/types";
import * as schema from "@/server/db/schema";
import { publishDraft } from "@/server/library/drafts";
import { assertE2eDatabase, resetDb } from "./db";
import { e2eUrls } from "./env";
import { CHO_ARGON2_MS, dangTrang, dongContextCu, haiNguoiDaVao, taoSach, tranNgang, vietTranTrang } from "./kho-sach";
import { dangKemNiemPhong, khongLo } from "./niem-phong";
import { rethrowSafely } from "./safe-error";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const HOP_THOI_GIAN = "Gửi em của năm ba mươi tuổi.";
const SAI_1 = "quán cà phê góc phố";
const SAI_2 = "tiệm trà sữa cổng trường";
const TEN_MOI = "Linh Nhi";
const LOI_NHAN_MOI = "hien nha hom mua";

/** Khung Hoat dong cua trang dang mo. */
const khung = (p: Page): Locator => p.locator("section.hoat-dong");
/** Vung cuon cua khung Hoat dong; chi co khi co it nhat mot dong. */
const cuon = (p: Page): Locator => p.getByRole("region", { name: "Hoạt động gần đây" });
/** Dong cua vung cuon co chua chu nay. */
const dong = (p: Page, chu: string): Locator => cuon(p).getByRole("listitem").filter({ hasText: chu });

/**
 * Dang soLan to, moi lan mot to, vao cuon bookId bang chinh publishDraft cua may chu: moi lan ghi dung mot su kien
 * dang-trang nhu khi bam Dang trang, chi nhanh hon di qua man viet. Chi chay tren mqce_e2e; loi khong keo chuoi ket noi.
 */
async function dangQuaMayChu(bookId: string, soLan: number): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const [{ chu }] = await sql<{ chu: string }[]>`select owner_id as chu from books where id = ${bookId}`;
    const db = drizzle(sql, { schema });
    for (let i = 1; i <= soLan; i++) {
      const to: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Tờ số ${i}.` }] }] };
      if (!(await publishDraft(db, chu, bookId, [to]))) throw new Error("dangQuaMayChu tu choi: publishDraft tra null");
    }
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("resetDb tu choi") || e.message.startsWith("dangQuaMayChu tu choi"))) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

test("ke moi: ca hai thay o trong; trang moi cua sach chia se hien cho ca hai va dan toi dung to, sach rieng tu chi chu sach thay", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);

  // Ke trong van co khung Hoat dong; chua co dong nao thi khong co vung cuon.
  for (const [p, nguoiKia] of [[a, tenCuaB], [b, tenCuaA]] as const) {
    await expect(p.getByRole("heading", { name: "Kệ còn trống." })).toBeVisible();
    await expect(khung(p).getByRole("heading", { level: 2, name: "Hoạt động", exact: true })).toBeVisible();
    await expect(khung(p).locator(".hoat-dong__trong b")).toHaveText("Chưa có gì mới");
    await expect(khung(p).locator(".hoat-dong__trong .meta")).toHaveText(`${nguoiKia} đăng trang hay mở một trang khóa thì tin hiện ở đây.`);
    await expect(cuon(p)).toHaveCount(0);
  }

  // Dang qua man viet that: action goi publishDraft, su kien duoc ghi trong cung giao dich.
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await vietTranTrang(a);
  const soTo = await dangTrang(a);
  await b.reload();
  const dongCuaB = cuon(b).getByRole("link", { name: `${tenCuaA} đăng ${soTo} trang mới trong Chuyện chưa kể` });
  await expect(dongCuaB).toHaveAttribute("href", `/sach/${id}?trang=1`);
  await expect(dongCuaB.locator(".hoat-dong__chu b")).toHaveText("Chuyện chưa kể");
  await expect(dongCuaB.locator("time")).toHaveAttribute("datetime", new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$"));
  // Yeu cau dot ba diem 19: khong gach chan chu o bat ky dau. Dong Hoat dong la mot trong bon cho cu, va no chi do
  // duoc o day - noi that su co mot dong gan sach. Re chuot thi cau doi sang muc chinh chu khong moc them gach chan.
  const chu = dongCuaB.locator(".hoat-dong__chu");
  expect(await chu.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
  await dongCuaB.hover();
  expect(await chu.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");

  await a.goto("/ke-sach");
  await expect(cuon(a).getByRole("link", { name: `Bạn đăng ${soTo} trang mới trong Chuyện chưa kể` }))
    .toHaveAttribute("href", `/sach/${id}?trang=1`);

  await dongCuaB.click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));

  // Sach rieng tu: chu sach thay dong cua minh; nguoi kia khong co dong nao, ke ca trong HTML va du lieu RSC.
  const rieng = await taoSach(a, "Thư gửi năm ba mươi", "rieng-tu");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(HOP_THOI_GIAN);
  expect(await dangTrang(a)).toBe(1);
  await a.goto("/ke-sach");
  await expect(cuon(a).getByRole("link", { name: "Bạn đăng 1 trang mới trong Thư gửi năm ba mươi" }))
    .toHaveAttribute("href", `/sach/${rieng}?trang=1`);
  await expect(cuon(a).getByRole("listitem")).toHaveCount(2);
  // Cuon rieng tu cua chinh chu sach la trang gan nhat: doan trich lam mo, an voi trinh doc man hinh, nhan Rieng tu de len.
  const ganNhat = a.getByRole("article", { name: "Một trang trong sách" });
  await expect(ganNhat.locator(".vua-viet__chu--mo")).toHaveAttribute("aria-hidden", "true");
  await expect(ganNhat.locator(".vua-viet__chu--mo")).toHaveText(HOP_THOI_GIAN);
  await expect(ganNhat.locator(".trang-che--giua")).toHaveText("Riêng tưMở sách để đọc");
  await expect(ganNhat.getByRole("link", { name: "Viết tiếp" })).toHaveAttribute("href", `/sach/${rieng}/viet`);

  await b.goto("/ke-sach");
  await expect(cuon(b).getByRole("listitem")).toHaveCount(1);
  await khongLo(b, "Thư gửi năm ba mươi", HOP_THOI_GIAN, rieng);
});

test("cau do: chu sach thay mot dong thu sai gop 2 lan va dong mo duoc; nguoi mo khong thay dong thu sai; khong lo chuoi da go", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] });

  await b.goto(`/sach/${id}`);
  const cauDo = b.getByRole("region", { name: "Câu đố", exact: true });
  for (const [doan, conLai] of [[SAI_1, 4], [SAI_2, 3]] as const) {
    await cauDo.getByLabel("Câu trả lời").fill(doan);
    await cauDo.getByRole("button", { name: "Mở trang" }).click();
    await expect(cauDo.locator(".con-lan")).toHaveText(`Chưa đúng. Còn ${conLai} lần`);
  }
  await cauDo.getByLabel("Câu trả lời").fill("quán mây");
  await cauDo.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1&mo=`));

  // Chu sach: hai lan sai cung ngay gop mot dong co chip dem, khong bao gio kem chuoi da go.
  await a.goto("/ke-sach");
  await expect(cuon(a).getByRole("listitem")).toHaveCount(3);
  const thuSai = dong(a, "chưa đúng");
  await expect(thuSai).toHaveCount(1);
  await expect(thuSai.locator(".hoat-dong__chu")).toHaveText(`${tenCuaB} thử trang 1 trong Chuyện chưa kể, chưa đúng`);
  await expect(thuSai.locator(".chip")).toHaveText(["Câu đố", "2 lần"]);
  await expect(thuSai.getByRole("link")).toHaveAttribute("href", `/sach/${id}?trang=1`);
  await expect(dong(a, "mở được").locator(".hoat-dong__chu")).toHaveText(`${tenCuaB} mở được trang 1 trong Chuyện chưa kể`);
  await expect(dong(a, "mở được").locator(".chip")).toHaveText(["Câu đố"]);
  await khongLo(a, SAI_1, SAI_2);

  // Nguoi mo: thay dong cua minh va dong dang trang cua chu sach, khong co dong thu sai nao.
  await b.goto("/ke-sach");
  await expect(cuon(b).getByRole("listitem")).toHaveCount(2);
  await expect(dong(b, "mở được").locator(".hoat-dong__chu")).toHaveText("Bạn mở được trang 1 trong Chuyện chưa kể");
  await expect(dong(b, "đăng").locator(".hoat-dong__chu")).toHaveText(`${tenCuaA} đăng 1 trang mới trong Chuyện chưa kể`);
  await expect(cuon(b).getByText("chưa đúng")).toHaveCount(0);
  await khongLo(b, SAI_1, SAI_2);
});

test("doi mat khau: nguoi bi doi van dang nhap va thay dong dam khong lien ket; nguoi doi thay cau cua minh", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);

  // Cung cac buoc cua doi-biet-danh.spec.ts: dien, qua buoc xac nhan, doi mat khau moi hien mot lan.
  await a.goto("/cai-dat");
  await a.getByLabel("Biệt danh mới cho người kia").fill(TEN_MOI);
  await a.getByLabel("Lời nhắn bí mật mới").fill(LOI_NHAN_MOI);
  await a.getByRole("button", { name: "Đổi tên" }).click();
  await a.getByRole("button", { name: "Xác nhận đổi" }).click();
  const matKhauMoi = a.getByTestId("mat-khau-moi");
  await expect(matKhauMoi).toBeVisible({ timeout: CHO_ARGON2_MS });
  const matKhau = (await matKhauMoi.innerText()).trim();

  // Doi ten khong xoa phien: B tai lai van o ke sach.
  await b.reload();
  await expect(b).toHaveURL(new RegExp("/ke-sach$"));
  const cuaB = dong(b, "đổi mật khẩu");
  await expect(cuaB).toHaveCount(1);
  await expect(cuaB.locator(".hoat-dong__chu b")).toHaveText(`${tenCuaA} vừa đổi mật khẩu của bạn`);
  await expect(cuaB.locator(".hoat-dong__ghi")).toHaveText(`Máy này vẫn đăng nhập. Hỏi ${tenCuaA} mật khẩu mới để vào ở máy khác.`);
  await expect(cuaB.getByRole("link")).toHaveCount(0);
  await khongLo(b, matKhau, LOI_NHAN_MOI);

  await a.goto("/ke-sach");
  const cuaA = dong(a, "đổi mật khẩu");
  await expect(cuaA.locator(".hoat-dong__chu")).toHaveText(`Bạn đổi mật khẩu của ${TEN_MOI}`);
  await expect(cuaA.locator("b")).toHaveCount(0);
  await expect(cuaA.getByRole("link")).toHaveCount(0);
  await khongLo(a, matKhau, LOI_NHAN_MOI);
});

test("khung cuon: man rong cao dung bang cuon sach mo, man hep toi da 340px, an thanh cuon, cuon bang phim, tieu de ngay dinh, co vet mo, khong tran ngang", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangQuaMayChu(id, 20);

  await a.setViewportSize({ width: 1280, height: 900 });
  await a.goto("/ke-sach");
  const vung = cuon(a);
  await expect(vung.getByRole("listitem")).toHaveCount(20);

  /** Chieu cao cua khung Hoat dong va cua cuon sach mo, cung max-height tinh ra cua khung. */
  const doCao = () => a.evaluate(() => {
    const hd = document.querySelector("section.hoat-dong");
    const sach = document.querySelector(".sach-mo");
    return {
      khung: hd?.getBoundingClientRect().height ?? Number.NaN,
      sach: sach?.getBoundingClientRect().height ?? Number.NaN,
      maxHeight: hd ? getComputedStyle(hd).maxHeight : "",
    };
  });
  // Man rong: dung bang cuon sach mo ben canh (lech toi da 1px do lam tron), khong dai hon du co 20 dong.
  const rongDo = await doCao();
  expect(rongDo.maxHeight).toBe("none");
  expect(rongDo.sach).toBeGreaterThan(340);
  expect(Math.abs(rongDo.khung - rongDo.sach)).toBeLessThanOrEqual(1);
  expect(await vung.evaluate((el) => {
    const s = getComputedStyle(el);
    const mo = getComputedStyle(el, "::after");
    const ngay = el.querySelector("h3");
    return {
      thanhCuon: s.getPropertyValue("scrollbar-width"),
      tranNgang: s.overflowX,
      cuonDuoc: el.scrollHeight > el.clientHeight,
      mo: {
        content: mo.content, position: mo.position, bottom: mo.bottom,
        coCao: Number.parseFloat(mo.height) > 0, nen: mo.backgroundImage.startsWith("linear-gradient"),
      },
      ngay: ngay === null ? null : getComputedStyle(ngay).position,
    };
  })).toEqual({
    thanhCuon: "none", tranNgang: "hidden", cuonDuoc: true,
    mo: { content: '""', position: "sticky", bottom: "0px", coCao: true, nen: true },
    ngay: "sticky",
  });

  // Man rong: cuon sach mo va khung Hoat dong cung mot hang, mep tren va mep duoi trung nhau.
  const hop = () => a.evaluate(() => Object.fromEntries(["vua-viet", "hoat-dong", "ngan"].map((c) => {
    const r = document.querySelector(`.${c}`)?.getBoundingClientRect();
    return [c, { tren: r?.top ?? Number.NaN, duoi: r?.bottom ?? Number.NaN }];
  })));
  const rong = await hop();
  expect(Math.abs(rong["vua-viet"].tren - rong["hoat-dong"].tren)).toBeLessThanOrEqual(1);
  expect(Math.abs(rong["vua-viet"].duoi - rong["hoat-dong"].duoi)).toBeLessThanOrEqual(1);

  // Ban phim: Tab tu nut duy nhat cua cuon sach mo (cuon cua chinh minh nen la Viet tiep) vao vung cuon; mui ten va PageDown cuon vung.
  await a.getByRole("article", { name: "Một trang trong sách" }).getByRole("link", { name: "Viết tiếp" }).focus();
  await a.keyboard.press("Tab");
  await expect(vung).toBeFocused();
  const cuonToi = () => vung.evaluate((el) => el.scrollTop);
  await a.keyboard.press("ArrowDown");
  await expect.poll(cuonToi).toBeGreaterThan(0);
  const sauMuiTen = await cuonToi();
  await a.keyboard.press("PageDown");
  await expect.poll(cuonToi).toBeGreaterThan(sauMuiTen);

  // Tab tiep vao dong dau: vong focus van ve, ve vao trong de vung cuon khong cat mat.
  await a.keyboard.press("Tab");
  const dauTien = vung.getByRole("link").first();
  await expect(dauTien).toBeFocused();
  // Trinh duyet lam tron outline-offset khi doc lai qua getComputedStyle, nen dung mot khoang thay vi chuoi dung:
  // van doi vao trong (am), khong bao gio ra ngoai vien cua chinh outline (>= -3, vi outline-width la 2.5px).
  const vong = await dauTien.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, offset: Number.parseFloat(s.outlineOffset) };
  });
  expect(vong.style).toBe("solid");
  expect(vong.offset).toBeLessThan(0);
  expect(vong.offset).toBeGreaterThanOrEqual(-3);

  for (const width of [320, 375, 414, 768, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }

  // Man hep: cuon sach mo, roi khung Hoat dong cao toi da 340px, roi ke; dong du 44px de cham.
  await a.setViewportSize({ width: 375, height: 812 });
  await expect.poll(async () => {
    const h = await hop();
    return h["vua-viet"].duoi <= h["hoat-dong"].tren && h["hoat-dong"].duoi <= h.ngan.tren;
  }).toBe(true);
  const hepDo = await doCao();
  expect(hepDo.maxHeight).toBe("340px");
  expect(hepDo.khung).toBeLessThanOrEqual(340);
  expect(await vung.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await vung.locator(".hoat-dong__dong").first().evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});
