import { test, expect, type Page, type Request } from "@playwright/test";
import type { ListItemNode, ParagraphNode } from "@/lib/doc/types";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, toDaDang } from "./kho-sach";
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
const CAU_MOI = "Quán đó giờ đã đổi chủ, nhưng con mèo vẫn nằm trên bậc cửa.";
const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn.";
const DA_SUA = new RegExp("^Đã sửa lúc [0-9]{2}:[0-9]{2}$");
const VUA = "Vừa một trang";
const TRAN = "Đã tràn khỏi trang, cần gọn lại";
const VUA_SUA_NOI_KHAC = "Trang này vừa được sửa ở nơi khác. Tải lại để xem bản mới.";

/** Doan van cua mot to trong database, theo thu tu. */
function doanCua(content: unknown): string[] {
  const doc = content as { content: { type: string; content?: { text?: string }[] }[] };
  return doc.content.filter((n) => n.type === "paragraph").map((n) => (n.content ?? []).map((t) => t.text ?? "").join(""));
}

/** Man sua cua to dang mo: doi trinh soan thao phia trinh duyet dung xong (immediatelyRender false). */
async function moManSua(p: Page, bookId: string, so: number): Promise<void> {
  await p.goto(`/sach/${bookId}/sua-trang/${so}`);
  await expect(p.getByRole("heading", { level: 1, name: `Sửa trang ${so}` })).toBeVisible();
  await expect(p.locator(".viet-chu .ProseMirror")).toHaveAttribute("contenteditable", "true");
}

/** Chon het chu cua to dang sua roi thay bang chu moi. */
async function thayChu(p: Page, chu: string): Promise<void> {
  await p.locator(".viet-chu .ProseMirror").click();
  await p.keyboard.press("ControlOrMeta+A");
  await p.keyboard.press("Delete");
  await p.keyboard.insertText(chu);
}

test("chu sach sua mot to, nguoi kia thay chu moi va dong Da sua luc, khong co nut sua nao", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);

  await a.goto(`/sach/${id}?trang=2`);
  await a.getByRole("link", { name: "Sửa trang 2", exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/sua-trang/2$`));
  await expect(a.locator(".viet-chu .ProseMirror")).toHaveText(TO_2);
  await expect(a.locator("#vua-trang")).toHaveText(VUA);
  await thayChu(a, CAU_MOI);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=2$`));
  await expect(a.locator(".trang-ghi .trang-ghi__sua")).toHaveText(DA_SUA);
  const sau = await toDaDang(id, 2);
  expect(doanCua(sau?.content)).toEqual([CAU_MOI]);
  expect(sau?.editedAt).not.toBeNull();
  expect(doanCua((await toDaDang(id, 1))?.content)).toEqual([TO_1]);
  expect(doanCua((await toDaDang(id, 3))?.content)).toEqual([TO_3]);
  expect((await toDaDang(id, 1))?.editedAt).toBeNull();

  await b.goto(`/sach/${id}?trang=2`);
  // Ban rong mac dinh 1280: cap to van la (1, 2) roi (3), to sua nam dung cho cu.
  await expect(b.locator(".doc__dem")).toHaveText("Trang 1-2 / 3");
  await expect(b.locator(".sach .to-giay--trai")).toContainText(TO_1);
  await expect(b.locator(".sach .to-giay--phai")).toContainText(CAU_MOI);
  await expect(b.locator(".sach")).not.toContainText(TO_2);
  await expect(b.locator(".trang-ghi .trang-ghi__sua")).toHaveCount(1);
  await expect(b.locator(".trang-ghi .trang-ghi__sua")).toHaveText(DA_SUA);
  await expect(b.locator('a[href*="/sua-trang/"]')).toHaveCount(0);
  await b.keyboard.press("ArrowRight");
  await expect(b.locator(".doc__dem")).toHaveText("Trang 3 / 3");
  await expect(b.locator(".trang-ghi")).toHaveCount(0);
  expect((await b.goto(`/sach/${id}/sua-trang/2`))?.status()).toBe(404);
});

test("tran qua mot to thi khoa Luu thay doi; gon lai thi luu, man doc ngat trang dung cho da do", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);
  const truoc = await toDaDang(id, 1);

  await moManSua(a, id, 1);
  const trangThai = a.locator("#vua-trang");
  const luu = a.getByRole("button", { name: "Lưu thay đổi" });
  const giay = a.locator(".viet-chu .ProseMirror");
  await giay.click();
  await a.keyboard.press("ControlOrMeta+End");
  for (let i = 0; i < 30 && !(await trangThai.innerText()).includes(TRAN); i++) {
    await a.keyboard.press("Enter");
    await a.keyboard.insertText(DOAN);
    // Cho bo do chay lai sau moi doan (120ms sau lan go cuoi): dung ngay khi vua tran, de to gon lai gan day nhat.
    await a.waitForTimeout(250);
  }
  // Dau ! dung truoc chu la ky hieu an voi trinh doc man hinh.
  await expect(trangThai).toHaveText(`!${TRAN}`);
  await expect(luu).toBeDisabled();
  await expect(a.locator(".het-cho")).toHaveAttribute("data-hien", "co");
  expect(await toDaDang(id, 1)).toEqual(truoc);

  // Xoa tung chu tu cuoi toi khi vua mot to: to luu ra gan day, phep so o man doc moi co nghia.
  for (let i = 0; i < 200 && (await trangThai.innerText()) !== VUA; i++) {
    await a.keyboard.press("ControlOrMeta+Backspace");
    // Bo do chi chay 120ms sau lan go cuoi (useMeasure): cho qua moc do roi moi doc trang thai.
    await a.waitForTimeout(250);
  }
  await expect(trangThai).toHaveText(VUA);
  await expect(luu).toBeEnabled();
  expect(await toDaDang(id, 1)).toEqual(truoc);
  await luu.click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));

  const doan = doanCua((await toDaDang(id, 1))?.content).filter((d) => d.trim() !== "");
  expect(doan.length).toBeGreaterThan(3);
  const cuoi = doan[doan.length - 1].trim();
  for (const width of [375, 1280]) {
    await a.setViewportSize({ width, height: 900 });
    await a.goto(`/sach/${id}?trang=1`);
    await expect(a.locator(".doc__dem")).toHaveText(width === 1280 ? "Trang 1-2 / 3" : "Trang 1 / 3");
    const to1 = a.locator(".sach .to-giay").filter({ hasText: TO_1 });
    await expect(to1).toHaveCount(1);
    // Doan cuoi da luu nam tron trong to giay cua man doc: bo cuc doc khong day no ra ngoai to.
    const dongCuoi = to1.locator(".giay-noi-dung p").filter({ hasText: cuoi.slice(-24) }).last();
    await expect(dongCuoi).toBeVisible();
    const [hopTo, hopDong] = await Promise.all([to1.boundingBox(), dongCuoi.boundingBox()]);
    expect(hopTo && hopDong, `${width}`).toBeTruthy();
    if (hopTo && hopDong) expect(hopDong.y + hopDong.height, `${width}px: doan cuoi trong to`).toBeLessThanOrEqual(hopTo.y + hopTo.height);
    if (width === 1280) await expect(a.locator(".sach .to-giay--phai")).toHaveText(new RegExp(TO_2));
  }
  await a.goto(`/sach/${id}?trang=2`);
  await expect(a.locator(".sach")).toContainText(TO_2);
});

test("to niem phong khong sua duoc qua giao dien, HTML khong lo chu cua to", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a } = await haiNguoiDaVao(browser);
  const idDo = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["quan may"], hints: [] });
  const idHen = await taoSach(a, "Hẹn năm sau", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "hen-gio", opensAt: await gioSau(a, 60 * 60 * 1000) });

  for (const bookId of [idDo, idHen]) {
    await a.goto(`/sach/${bookId}?trang=1`);
    await expect(a.locator(".trang-ghi .trang-ghi__khoa")).toHaveText("Trang niêm phong không sửa được");
    await expect(a.locator('a[href*="/sua-trang/"]')).toHaveCount(0);
    await expect(a.getByRole("link", { name: "Sửa trang 1" })).toHaveCount(0);

    await a.goto(`/sach/${bookId}/sua-trang/1`);
    await expect(a.getByRole("heading", { level: 1, name: "Không sửa được" })).toBeVisible();
    await expect(a.getByRole("link", { name: "Về trang 1" })).toHaveAttribute("href", `/sach/${bookId}?trang=1`);
    await expect(a.locator(".ProseMirror")).toHaveCount(0);
    await khongLo(a, BI_MAT);
  }
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

test("goi thang action: to niem phong, trinh duyet nguoi kia va Origin la deu bi tu choi, database khong doi", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const idNiem = await taoSach(a, "Thư chưa gửi", "chia-se");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["quan may"], hints: [] });
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);
  const goc = new URL(a.url()).origin;

  await moManSua(a, id, 2);
  await thayChu(a, CAU_MOI);
  const gui = a.waitForRequest((r) => r.method() === "POST" && r.headers()["next-action"] !== undefined);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  const y = ghiYeuCau(await gui);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=2$`));
  expect(y.than[0]).toBe(id);
  expect(y.than[1]).toBe(2);
  expect(typeof y.than[3]).toBe("string");

  const chup = async () => ({ niem: await toDaDang(idNiem, 1), to2: await toDaDang(id, 2) });
  const banDau = await chup();
  expect(doanCua(banDau.to2?.content)).toEqual([CAU_MOI]);
  // Moc phien ban hien tai cua to 2: than phat lai dung moc nay, nen chi quyen hay Origin moi chan duoc no.
  const mocTo2 = (banDau.to2?.editedAt ?? banDau.to2?.publishedAt)?.toISOString();
  const docLa = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Chữ lạ gửi thẳng." }] }] };

  // (a) Chu sach, vi tri cua to niem phong cau do, moc that cua to do.
  const mocNiem = banDau.niem?.publishedAt.toISOString();
  const ra = await phatLai(a, y, [idNiem, 1, docLa, mocNiem], goc);
  expect(ra.text).toContain("Trang niêm phong không sửa được.");
  expect(await chup()).toEqual(banDau);

  // (b) Nguoi kia, cookie cua nguoi kia, dung than goc va dung than voi moc hien tai.
  for (const than of [y.than, [id, 2, docLa, mocTo2]]) {
    const rb = await phatLai(b, y, than, goc);
    expect(rb.text).toContain("Không tìm thấy trang này.");
    expect(await chup()).toEqual(banDau);
  }

  // (c) Chu sach, Origin la: Next tu choi truoc khi chay action.
  const rc = await phatLai(a, y, [id, 2, docLa, mocTo2], "https://la.example");
  expect(rc.status).not.toBe(200);
  expect(rc.text).not.toContain("Chữ lạ gửi thẳng.");
  expect(await chup()).toEqual(banDau);

  // Doi chung: cung cach phat lai, dung chu sach va dung Origin thi ghi that. Ba lan tren bi chan vi luat, khong vi cach goi.
  const rd = await phatLai(a, y, [id, 2, docLa, mocTo2], goc);
  expect(rd.status).toBeLessThan(400);
  expect(doanCua((await toDaDang(id, 2))?.content)).toEqual(["Chữ lạ gửi thẳng."]);
});

test("to bat dau giua danh sach giu dau noi tiep sau khi sua, man doc ngat trang dung cho cu", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  const doanVan = (chu: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text: chu }] });
  const muc = (chu: string, noiTiep = false): ListItemNode =>
    noiTiep ? { type: "listItem", noiTiep: true, content: [doanVan(chu)] } : { type: "listItem", content: [doanVan(chu)] };
  await dangToThang(
    id,
    { type: "doc", content: [doanVan("Những thứ anh mang theo:"), { type: "bulletList", content: [muc("Một chiếc ô cũ"), muc("Cuốn sổ bìa xanh")] }] },
    { type: "doc", content: [{ type: "bulletList", content: [muc("và cây bút em tặng", true), muc("Một gói trà")] }, doanVan("Vậy là đủ.")] },
  );

  await moManSua(a, id, 2);
  const vung = a.locator(".viet-chu .ProseMirror");
  await expect(vung.locator("li")).toHaveCount(2);
  await expect(vung.locator("li.noi-tiep")).toHaveCount(1);
  await expect(vung.locator("li").first()).toHaveClass(/noi-tiep/);
  // Trinh soan thao dat con tro o cuoi to, tuc cuoi doan van: chi sua doan van, khong cham danh sach.
  await a.keyboard.insertText(" Mình đi thôi.");
  await expect(vung.locator("p").last()).toHaveText("Vậy là đủ. Mình đi thôi.");
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=2$`));

  const luu = (await toDaDang(id, 2))?.content as { content: { type: string; content?: { noiTiep?: boolean }[] }[] };
  expect(luu.content[0].type).toBe("bulletList");
  expect(luu.content[0].content?.[0].noiTiep).toBe(true);
  expect(luu.content[0].content?.[1].noiTiep).toBeUndefined();
  expect(doanCua(luu)).toEqual(["Vậy là đủ. Mình đi thôi."]);

  await b.goto(`/sach/${id}?trang=2`);
  await expect(b.locator(".doc__dem")).toHaveText("Trang 1-2 / 2");
  const to2 = b.locator(".sach .to-giay--phai");
  await expect(to2.locator("li")).toHaveCount(2);
  await expect(to2.locator("li.noi-tiep")).toHaveCount(1);
  await expect(to2.locator("li").first()).toHaveClass(/noi-tiep/);
  await expect(b.locator(".sach .to-giay--trai li")).toHaveCount(2);
  await expect(b.locator(".sach .to-giay--trai li.noi-tiep")).toHaveCount(0);
});

test("hai the cung sua mot to: the luu sau bi tu choi voi loi tai lai, khong ghi de ban vua luu", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);
  const the2 = await a.context().newPage();

  await moManSua(a, id, 2);
  await moManSua(the2, id, 2);
  await thayChu(a, CAU_MOI);
  await a.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=2$`));
  const daLuu = await toDaDang(id, 2);

  await thayChu(the2, "Chữ của thẻ thứ hai.");
  await the2.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(the2.locator(".viet-dau .luu--loi")).toHaveText(VUA_SUA_NOI_KHAC);
  await expect(the2).toHaveURL(new RegExp(`/sach/${id}/sua-trang/2$`));
  expect(await toDaDang(id, 2)).toEqual(daLuu);
  await expect(the2.locator(".viet-chu .ProseMirror")).toHaveText("Chữ của thẻ thứ hai.");

  await the2.getByRole("button", { name: "Tải lại" }).click();
  const hoi = the2.getByRole("group", { name: "Bỏ các thay đổi trên trang này?" });
  await expect(hoi.getByRole("button", { name: "Sửa tiếp" })).toBeFocused();
  await hoi.getByRole("button", { name: "Tải bản mới" }).click();
  await expect(the2.locator(".viet-chu .ProseMirror")).toHaveText(CAU_MOI);
  await expect(the2.locator(".viet-dau .luu--loi")).toHaveCount(0);
});

test("roi man sua chua luu: quay lai thi khoi phuc chu dang sua, Dung ban da dang va hop Huy tra focus dung cho", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, TO_1, TO_2, TO_3);
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
  await expect(a.getByText("Đã khôi phục chữ đang sửa dở.")).toHaveCount(0);

  await giay.click();
  await a.keyboard.insertText(" Thêm một câu.");
  await a.getByRole("button", { name: "Hủy" }).click();
  const hoi = a.getByRole("group", { name: "Bỏ các thay đổi trên trang này?" });
  await expect(hoi.getByRole("button", { name: "Sửa tiếp" })).toBeFocused();
  await a.keyboard.press("Escape");
  await expect(hoi).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Hủy" })).toBeFocused();
  await a.getByRole("button", { name: "Hủy" }).click();
  await a.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  expect(doanCua((await toDaDang(id, 1))?.content)).toEqual([TO_1]);
});
