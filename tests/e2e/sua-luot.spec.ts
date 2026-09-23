import { test, expect, type Page, type Request } from "@playwright/test";
import { resetDb } from "./db";
import {
  cacToCua, dangToThang, dangTrang, dongContextCu, haiNguoiDaVao, taoSach, toDaDang, toDaXemCua, veCachCatCu, veCuoiTaiLieu, vietTranTrang,
} from "./kho-sach";
import { dangKemNiemPhong, gioSau, khongLo } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const TO_1 = "Chiều nay anh đi ngang hiệu sách cũ ở góc phố.";
const TO_2 = "Em có nhớ quán nước đầu hẻm không, cái quán có con mèo mướp.";
const TO_3 = "Mai anh sẽ kể tiếp chuyện hôm đó.";
const TO_4 = "Tối nay trời trở gió.";
const CAU_MOI = "Quán đó giờ đã đổi chủ, nhưng con mèo vẫn nằm trên bậc cửa.";
const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn.";
const DONG_NGAN = "Dòng ngắn";
const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const DA_SUA = new RegExp("^Đã sửa lúc [0-9]{2}:[0-9]{2}$");
const VUA_SUA_NOI_KHAC = "Lượt này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.";
const HOI = "Bỏ các thay đổi trong lượt này?";

/** Chu cac doan cap cao nhat cua mot to trong database, theo thu tu. */
function doanCua(content: unknown): string[] {
  const doc = content as { content: { type: string; content?: { text?: string }[] }[] };
  return doc.content.filter((n) => n.type === "paragraph").map((n) => (n.content ?? []).map((t) => t.text ?? "").join(""));
}

/** Nut trong cung cua khoi cuoi cua mot to: de biet to co ket thuc bang mot lan xuong dong (Shift+Enter) khong. */
function nutCuoiCua(content: unknown): string {
  const doc = content as { content: { type: string; content?: { type: string }[] }[] };
  const khoi = doc.content[doc.content.length - 1];
  return khoi.content?.[khoi.content.length - 1]?.type ?? khoi.type;
}

/** Noi dung to bo moi dau noiTiep, de so to cat theo cach cu voi to cat lai. */
function khongDau(content: unknown): unknown {
  return JSON.parse(JSON.stringify(content, (k, v: unknown) => (k === "noiTiep" ? undefined : v)));
}

/** Man sua luot dang mo: doi trinh soan thao phia trinh duyet dung xong. */
async function moManSua(p: Page, bookId: string, luot: number, trang?: number): Promise<void> {
  await p.goto(`/sach/${bookId}/sua-luot/${luot}${trang ? `?trang=${trang}` : ""}`);
  await expect(p.getByRole("heading", { level: 1, name: `Sửa lượt ${luot}` })).toBeVisible();
  await expect(p.locator(".viet-chu .ProseMirror")).toHaveAttribute("contenteditable", "true");
}

/** Chon het chu cua luot dang sua roi thay bang chu moi. */
async function thayChu(p: Page, chu: string): Promise<void> {
  await p.locator(".viet-chu .ProseMirror").click();
  await p.keyboard.press("ControlOrMeta+A");
  await p.keyboard.press("Delete");
  await p.keyboard.insertText(chu);
}

/** Go them doan dai o cuoi luot toi khi man sua cat du soTo to. */
async function goToiKhi(p: Page, soTo: number): Promise<void> {
  await p.locator(".viet-chu .ProseMirror").click();
  await veCuoiTaiLieu(p);
  for (let i = 0; i < 60 && (await p.locator(".viet-to").count()) < soTo; i++) {
    await p.keyboard.press("Enter");
    await p.keyboard.insertText(DOAN);
    // Bo do chi chay 120ms sau lan go cuoi (useMeasure): cho qua moc do roi moi dem to.
    await p.waitForTimeout(200);
  }
  await expect.poll(() => p.locator(".viet-to").count()).toBeGreaterThanOrEqual(soTo);
}

test("sua luot lam tang so to: to sau doi theo, nguoi kia doc dung thu tu, Da sua luc chi duoi to cua luot da sua", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2);
  await dangToThang(id, TO_3);

  await a.goto(`/sach/${id}?trang=2`);
  await a.getByRole("link", { name: "Sửa trang 2", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/sua-luot/1[?]trang=2$`));
  const giay = a.locator(".viet-chu .ProseMirror");
  await expect(giay).toContainText(TO_1);
  await expect(giay).toContainText(TO_2);
  await expect(giay).not.toContainText(TO_3);
  await goToiKhi(a, 4);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));

  const cacTo = await cacToCua(id);
  expect(cacTo.map((t) => t.position)).toEqual(cacTo.map((_, i) => i + 1));
  expect(cacTo.filter((t) => t.roundId === cacTo[0].roundId).length).toBeGreaterThanOrEqual(4);
  const cuoi = cacTo[cacTo.length - 1];
  expect(cuoi.roundId).not.toBe(cacTo[0].roundId);
  expect(doanCua(cuoi.content)).toEqual([TO_3]);
  expect(doanCua(cacTo[0].content)[0]).toBe(TO_1);

  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto(`/sach/${id}?trang=1`);
  await expect(b.locator(".trang-ghi .trang-ghi__sua")).toHaveText(DA_SUA);
  await expect(b.locator('a[href*="/sua-luot/"]')).toHaveCount(0);
  await b.goto(`/sach/${id}?trang=${cacTo.length}`);
  await expect(b.locator(".doc__dem")).toHaveText(`Trang ${cacTo.length} / ${cacTo.length}`);
  await expect(b.locator(".sach")).toContainText(TO_3);
  await expect(b.locator(".trang-ghi")).toHaveCount(0);
  expect((await b.goto(`/sach/${id}/sua-luot/1`))?.status()).toBe(404);
});

test("sua luot lam giam so to: to sau lui lai, to da xem cua nguoi kia doi theo", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);
  await dangToThang(id, TO_4, "Hết.");
  await b.setViewportSize({ width: 375, height: 900 });
  await b.goto(`/sach/${id}?trang=5`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 5 / 5");
  await expect.poll(() => toDaXemCua(id), { timeout: 10_000 }).toEqual([5]);

  await moManSua(a, id, 1);
  await thayChu(a, "Gọn lại một trang.");
  await expect(a.getByText("1 trang", { exact: true })).toBeVisible();
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));

  expect((await cacToCua(id)).map((t) => doanCua(t.content))).toEqual([["Gọn lại một trang."], [TO_4], ["Hết."]]);
  expect(await toDaXemCua(id)).toEqual([3]);
  await b.goto(`/sach/${id}?trang=2`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 2 / 3");
  await expect(b.locator(".sach")).toContainText(TO_4);
});

test("luot con niem phong khong sua duoc o moi loi vao, HTML khong lo chu; mo roi thi sua duoc", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const idDo = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["quan may"], hints: [] });
  const idHen = await taoSach(a, "Hẹn năm sau", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "hen-gio", opensAt: await gioSau(a, 60 * 60 * 1000) });

  for (const bookId of [idDo, idHen]) {
    await a.goto(`/sach/${bookId}?trang=1`);
    await expect(a.locator(".trang-ghi .trang-ghi__khoa").first()).toHaveText("Đang niêm phong, chưa sửa được");
    await expect(a.locator('a[href*="/sua-luot/"]')).toHaveCount(0);
    await a.goto(`/sach/${bookId}/sua`);
    await expect(a.locator(".luot").first()).toContainText("Lượt 1 · trang 1");
    await expect(a.locator(".luot__khoa")).toHaveText("Đang niêm phong");
    await expect(a.locator('a[href*="/sua-luot/"]')).toHaveCount(0);
    await a.goto(`/sach/${bookId}/sua-luot/1`);
    await expect(a.getByRole("heading", { level: 1, name: "Không sửa được" })).toBeVisible();
    await expect(a.getByRole("link", { name: "Về trang 1" })).toHaveAttribute("href", `/sach/${bookId}?trang=1`);
    await expect(a.locator(".ProseMirror")).toHaveCount(0);
    await khongLo(a, BI_MAT);
  }

  // Nguoi kia giai dung cau do: luot mo voi ca hai, chu sach sua duoc ngay.
  await b.goto(`/sach/${idDo}`);
  const khung = b.getByRole("region", { name: "Câu đố", exact: true });
  await khung.getByLabel("Câu trả lời").fill("quan may");
  await khung.getByRole("button", { name: "Mở trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${idDo}[?]trang=1&mo=`));
  await a.goto(`/sach/${idDo}?trang=1`);
  await a.getByRole("link", { name: "Sửa trang 1", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${idDo}/sua-luot/1$`));
  await expect(a.locator(".viet-chu .ProseMirror")).toContainText(BI_MAT);
});

test("duong dan sua mot to cu chuyen 308 sang dung luot va dung to; nguoi kia va to la nhan 404", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2);
  await dangToThang(id, TO_3);
  const dich = (r: { headers(): Record<string, string> }) => {
    const u = new URL(r.headers()["location"]);
    return `${u.pathname}${u.search}`;
  };
  const r2 = await a.request.get(`/sach/${id}/sua-trang/2`, { maxRedirects: 0 });
  expect(r2.status()).toBe(308);
  expect(dich(r2)).toBe(`/sach/${id}/sua-luot/1?trang=2`);
  expect(r2.headers()["cache-control"]).toContain("no-store");
  expect(dich(await a.request.get(`/sach/${id}/sua-trang/3`, { maxRedirects: 0 }))).toBe(`/sach/${id}/sua-luot/2`);
  expect((await b.request.get(`/sach/${id}/sua-trang/2`, { maxRedirects: 0 })).status()).toBe(404);
  expect((await a.request.get(`/sach/${id}/sua-trang/9`, { maxRedirects: 0 })).status()).toBe(404);
  await a.goto(`/sach/${id}/sua-trang/2`);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/sua-luot/1[?]trang=2$`));
  await expect(a.getByRole("heading", { level: 1, name: "Sửa lượt 1" })).toBeVisible();
});

/** Yeu cau POST that cua server action vua gui, du de phat lai. */
type YeuCau = { url: string; headers: Record<string, string>; than: unknown[] };

function ghiYeuCau(r: Request): YeuCau {
  const h = r.headers();
  const headers: Record<string, string> = { "next-action": h["next-action"], "content-type": h["content-type"], accept: h.accept ?? "text/x-component" };
  if (h["next-router-state-tree"]) headers["next-router-state-tree"] = h["next-router-state-tree"];
  return { url: r.url(), headers, than: JSON.parse(r.postData() ?? "null") as unknown[] };
}

/** Phat lai yeu cau action tu context cua trang p (cookie cua chinh nguoi do), voi than va Origin tuy chon. */
async function phatLai(p: Page, y: YeuCau, than: unknown[], origin: string): Promise<{ status: number; text: string }> {
  const res = await p.request.post(y.url, { headers: { ...y.headers, origin }, data: JSON.stringify(than), maxRedirects: 0 });
  return { status: res.status(), text: await res.text() };
}

test("goi thang action: trinh duyet nguoi kia va Origin la deu bi tu choi, database khong doi", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2);
  const goc = new URL(a.url()).origin;

  await moManSua(a, id, 1);
  await thayChu(a, CAU_MOI);
  const gui = a.waitForRequest((r) => r.method() === "POST" && r.headers()["next-action"] !== undefined);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  const y = ghiYeuCau(await gui);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(y.than[0]).toBe(id);
  expect(typeof y.than[1]).toBe("string");
  expect(Array.isArray(y.than[2])).toBe(true);
  expect(typeof y.than[3]).toBe("string");

  const banDau = await cacToCua(id);
  const moc = (await toDaDang(id, 1))?.editedAt?.toISOString();
  const laThu = [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Chữ lạ gửi thẳng." }] }] }];

  // Nguoi kia, cookie cua nguoi kia, dung than goc va dung than voi moc hien tai.
  for (const than of [y.than, [id, y.than[1], laThu, moc]]) {
    const rb = await phatLai(b, y, than, goc);
    expect(rb.text).toContain("Không tìm thấy lượt này.");
    expect(await cacToCua(id)).toEqual(banDau);
  }

  // Chu sach, Origin la: Next tu choi truoc khi chay action.
  const rc = await phatLai(a, y, [id, y.than[1], laThu, moc], "https://la.example");
  expect(rc.status).not.toBe(200);
  expect(await cacToCua(id)).toEqual(banDau);

  // Doi chung: cung cach phat lai, dung chu sach va dung Origin thi ghi that.
  const rd = await phatLai(a, y, [id, y.than[1], laThu, moc], goc);
  expect(rd.status).toBeLessThan(400);
  expect((await cacToCua(id)).map((t) => doanCua(t.content))).toEqual([["Chữ lạ gửi thẳng."]]);
});

test("hai the cung sua mot luot: the luu sau bi tu choi voi loi tai lai, khong ghi de ban vua luu", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2);
  const the2 = await a.context().newPage();

  await moManSua(a, id, 1);
  await moManSua(the2, id, 1);
  await thayChu(a, CAU_MOI);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  const daLuu = await cacToCua(id);

  await thayChu(the2, "Chữ của thẻ thứ hai.");
  await the2.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(the2.locator(".viet-dau .luu--loi")).toHaveText(VUA_SUA_NOI_KHAC);
  await expect(the2).toHaveURL(new RegExp(`/sach/${id}/sua-luot/1$`));
  expect(await cacToCua(id)).toEqual(daLuu);
  await expect(the2.locator(".viet-chu .ProseMirror")).toHaveText("Chữ của thẻ thứ hai.");

  await the2.getByRole("button", { name: "Tải lại" }).click();
  const hoi = the2.getByRole("group", { name: HOI });
  await expect(hoi.getByRole("button", { name: "Sửa tiếp" })).toBeFocused();
  await hoi.getByRole("button", { name: "Tải bản mới" }).click();
  await expect(the2.locator(".viet-chu .ProseMirror")).toHaveText(CAU_MOI);
  await expect(the2.locator(".viet-dau .luu--loi")).toHaveCount(0);
});

test("roi man sua chua luu: quay lai thi khoi phuc chu dang sua, Dung ban da dang va hop Huy tra focus dung cho", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1);
  const giay = a.locator(".viet-chu .ProseMirror");

  await moManSua(a, id, 1);
  await thayChu(a, CAU_MOI);
  // Lien ket tren thanh dieu huong di phia client, khong phat beforeunload: chu phai con nho ban tam.
  await a.getByRole("link", { name: "Kệ sách" }).click();
  await expect(a).toHaveURL(new RegExp("/ke-sach$"));
  await moManSua(a, id, 1);
  await expect(a.getByText("Đã khôi phục chữ đang sửa dở.")).toBeVisible();
  await expect(giay).toHaveText(CAU_MOI);
  await a.getByRole("button", { name: "Dùng bản đã đăng" }).click();
  await expect(giay).toHaveText(TO_1);

  await giay.click();
  await a.keyboard.insertText(" Thêm một câu.");
  await a.getByRole("button", { name: "Hủy" }).click();
  const hoi = a.getByRole("group", { name: HOI });
  await expect(hoi.getByRole("button", { name: "Sửa tiếp" })).toBeFocused();
  await a.keyboard.press("Escape");
  await expect(hoi).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Hủy" })).toBeFocused();
  await a.getByRole("button", { name: "Hủy" }).click();
  await a.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect((await cacToCua(id)).map((t) => doanCua(t.content))).toEqual([[TO_1]]);
});

test("sua to cuoi cua mot luot dai: cac to truoc giu nguyen noi dung va cho ngat, ca voi to cat theo cach cu", async ({ browser }) => {
  test.setTimeout(420_000);
  const { a } = await haiNguoiDaVao(browser);
  for (const cachCu of [false, true]) {
    const id = await taoSach(a, cachCu ? "Lượt cắt cũ" : "Lượt cắt mới", "chia-se");
    await vietTranTrang(a);
    const so = await dangTrang(a);
    expect(so).toBeGreaterThanOrEqual(2);
    if (cachCu) await veCachCatCu(id);
    const truoc = await cacToCua(id);
    if (!cachCu) expect(JSON.stringify(truoc.slice(1).map((t) => t.content))).toContain("noiTiep");

    await moManSua(a, id, 1, so);
    // Noi roi xep trang lai phai ra dung so to cu truoc khi sua gi.
    await expect.poll(() => a.locator(".viet-to").count()).toBe(so);
    await veCuoiTaiLieu(a);
    await a.keyboard.insertText(" Thêm.");
    await a.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));

    const sau = await cacToCua(id);
    const giu = truoc.length - 1;
    expect(sau.slice(0, giu).map((t) => khongDau(t.content)), cachCu ? "cach cu" : "cach moi")
      .toEqual(truoc.slice(0, giu).map((t) => khongDau(t.content)));
    if (!cachCu) expect(sau.slice(0, giu).map((t) => t.content)).toEqual(truoc.slice(0, giu).map((t) => t.content));
    expect(JSON.stringify(sau[sau.length - 1].content)).toContain("Thêm.");
  }
});

test("to ket thuc bang xuong dong ngay bien to: luu ma khong doi gi thi khong ghi gi, cho ngat van y nguyen", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Xuống dòng cuối tờ", "chia-se");

  // Mot doan duy nhat, moi dong them bang Shift+Enter: khi to thu hai hien ra, cho ngat nam ngay sau mot lan xuong dong.
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  await a.keyboard.insertText(DOAN);
  for (let i = 0; i < 40 && (await a.locator(".viet-to").count()) < 2; i++) {
    await a.keyboard.press("Shift+Enter");
    await a.keyboard.insertText(`${DONG_NGAN} ${i}.`);
    // Bo do chi chay 120ms sau lan go cuoi (useMeasure): cho qua moc do roi moi dem to.
    await a.waitForTimeout(200);
  }
  await expect.poll(() => a.locator(".viet-to").count()).toBe(2);
  expect(await dangTrang(a)).toBe(2);

  const truoc = await cacToCua(id);
  expect(truoc).toHaveLength(2);
  expect(nutCuoiCua(truoc[0].content), "to dau ket thuc bang xuong dong").toBe("hardBreak");
  expect(JSON.stringify(truoc[1].content)).toContain("noiTiep");

  // Mo man sua, khong dong toi chu nao, luu: noi roi cat lai phai ra dung hai to cu, va database khong duoc doi gi.
  await moManSua(a, id, 1);
  await expect.poll(() => a.locator(".viet-to").count()).toBe(2);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(await cacToCua(id)).toEqual(truoc);
  expect((await toDaDang(id, 1))?.editedAt, "luu ma khong doi gi thi luot khong mang moc da sua").toBeNull();
  await expect(a.locator(".trang-ghi__sua")).toHaveCount(0);

  // Cung bien to nhung la to cat theo cach cu (khong co dau noiTiep): noi bang luat xuong dong, cho ngat van y nguyen.
  await veCachCatCu(id);
  const cu = await cacToCua(id);
  await moManSua(a, id, 1);
  await expect.poll(() => a.locator(".viet-to").count()).toBe(2);
  await veCuoiTaiLieu(a);
  await a.keyboard.insertText(" Thêm.");
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  const sau = await cacToCua(id);
  expect(sau[0].content, "to dau giu nguyen tung ky tu").toEqual(cu[0].content);
  expect(nutCuoiCua(sau[0].content)).toBe("hardBreak");
  expect(JSON.stringify(sau[sau.length - 1].content)).toContain("Thêm.");
});
