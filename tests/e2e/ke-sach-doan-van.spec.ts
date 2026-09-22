import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { BE_RONG } from "./media";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const CAC_TO = ["Tờ một: sáng mưa.", "Tờ hai: trưa nắng.", "Tờ ba: chiều gió.", "Tờ bốn: tối trăng."];

test("chu sach bam vao khung sach mo: man doc mo dung to cua doan trich; nut Viet tiep van la nut rieng", async ({ browser }) => {
  const { a } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, ...CAC_TO);

  await a.goto("/ke-sach");
  const ganNhat = a.getByRole("article", { name: "Một trang trong sách" });
  const lien = ganNhat.getByRole("link", { name: new RegExp("^Đọc Chuyện chưa kể tại trang [1-4]$") });
  const href = (await lien.getAttribute("href")) ?? "";
  const so = Number(new RegExp(`^/sach/${id}[?]trang=([1-4])$`).exec(href)?.[1]);
  expect(so, `href cua khung: ${href}`).toBeGreaterThan(0);
  await expect(ganNhat.locator(".vua-viet__chu")).toHaveText(CAC_TO[so - 1]);
  await expect(ganNhat.locator(".sach-mo__so")).toHaveText(String(so));
  const vietTiep = ganNhat.getByRole("link", { name: "Viết tiếp" });
  await expect(vietTiep).toHaveAttribute("href", `/sach/${id}/viet`);
  expect(await ganNhat.locator("a a").count(), "khong co lien ket long trong lien ket").toBe(0);

  // Cung ngay tai lai van la to do.
  await a.reload();
  await expect(lien).toHaveAttribute("href", href);

  // Ban phim: lien ket khung dung truoc nut chinh.
  await lien.focus();
  await a.keyboard.press("Tab");
  await expect(vietTiep).toBeFocused();

  // Bam thang vao giua doan trich (chuot that, khong qua kiem cua Playwright): lop phu nhan cu bam.
  const hop = await ganNhat.locator(".vua-viet__chu").boundingBox();
  if (!hop) throw new Error("khong thay doan trich");
  await a.mouse.click(hop.x + hop.width / 2, hop.y + hop.height / 2);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=${so}$`));
  await expect(a.locator(".sach")).toContainText(CAC_TO[so - 1]);

  // Nut chinh nam tren lop phu: bam dung giua nut (chuot that) van toi dung dich cua nut.
  await a.goto("/ke-sach");
  // Nut o chan trang trai co the nam duoi mep khung nhin: cuon toi truoc, chuot khong bam duoc ngoai khung nhin.
  await vietTiep.scrollIntoViewIfNeeded();
  const nut = await vietTiep.boundingBox();
  if (!nut) throw new Error("khong thay nut Viet tiep");
  await a.mouse.click(nut.x + nut.width / 2, nut.y + nut.height / 2);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}/viet$`));

  await a.goto("/ke-sach");
  for (const width of BE_RONG) {
    await a.setViewportSize({ width, height: 900 });
    expect(await tranNgang(a), `tran ngang o ${width}px`).toEqual([]);
  }
  // Man hep: van bam duoc khung (lop phu phu ca cot don).
  await a.setViewportSize({ width: 375, height: 900 });
  await ganNhat.locator(".vua-viet__chu").scrollIntoViewIfNeeded();
  const hopHep = await ganNhat.locator(".vua-viet__chu").boundingBox();
  if (!hopHep) throw new Error("khong thay doan trich o man hep");
  await a.mouse.click(hopHep.x + hopHep.width / 2, hopHep.y + hopHep.height / 2);
  await expect(a).toHaveURL(new RegExp(`/sach/${id}[?]trang=${so}$`));
});

test("nguoi kia chua doc gi: khung mo to chua doc ke tiep (to 1), khong lo chu cua to chua doc nao khac", async ({ browser }) => {
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, ...CAC_TO);

  await b.goto("/ke-sach");
  const ganNhat = b.getByRole("article", { name: "Một trang trong sách" });
  await expect(ganNhat.getByRole("link", { name: "Đọc Chuyện chưa kể tại trang 1" })).toHaveAttribute("href", `/sach/${id}?trang=1`);
  await expect(ganNhat.locator(".vua-viet__chu")).toHaveText(CAC_TO[0]);
  await expect(ganNhat.getByRole("link", { name: "Đọc tiếp" })).toHaveAttribute("href", `/sach/${id}`);
  const html = await b.content();
  for (const chu of CAC_TO.slice(1)) expect(html, chu).not.toContain(chu);

  await ganNhat.getByRole("link", { name: "Đọc Chuyện chưa kể tại trang 1" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${id}[?]trang=1$`));
  await expect(b.locator(".sach")).toContainText(CAC_TO[0]);
});
