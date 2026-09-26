import { test, expect } from "@playwright/test";
import { resetDb } from "./db";
import { dangToThang, dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { dangKemNiemPhong, gioSau, khongLo, niemPhongCua } from "./niem-phong";

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const HE_LO = "Em tới sớm hơn giờ hẹn bốn mươi phút.";
const BI_MAT = "Quán nhỏ tới mức chỉ có bốn cái bàn, cô chủ hỏi em đợi ai.";
const HOP_THOI_GIAN = "Gửi em của năm ba mươi tuổi.";

test("nguoi kia thay dung so trang khoa, luot moi nhat con khoa nen tren ke chi con dong he lo", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");
  await dangToThang(id, "Tờ mở đầu.");
  await dangKemNiemPhong(a, [HE_LO, BI_MAT], { kind: "cau-do", question: "Quán tên gì?", answers: ["Quán Mây"], hints: [] });

  await b.goto("/ke-sach");
  const the = b.locator(".cuon", { hasText: "Chuyện chưa kể" });
  await expect(the.locator(".dh--khoa")).toHaveText("1 trang khóa");
  await expect(the.locator(".dh--moi")).toHaveText("2 trang mới");
  await expect(b.locator(".ke-dau__phu")).toHaveText("1 cuốn, 2 trang mới");
  // Doan trich den tu luot dang moi nhat (spec 2026-09-22 muc 10); luot do con niem phong voi nguoi kia, nen khung sach
  // dung dong he lo cua chinh no chu khong lui ve chu that cua luot cu. Man doc van mo o to doc duoc dau tien (to 1).
  const ganNhat = b.getByRole("article", { name: "Một trang trong sách" });
  await expect(ganNhat.locator(".trang-khoa .he-lo")).toHaveText(HE_LO);
  await expect(ganNhat.locator(".vua-viet__chu")).toHaveCount(0);
  await expect(ganNhat.getByRole("link", { name: "Đọc Chuyện chưa kể từ trang 1" })).toHaveAttribute("href", `/sach/${id}?trang=1`);
  await expect(ganNhat.getByRole("link", { name: "Đọc tiếp" })).toHaveAttribute("href", `/sach/${id}`);
  await expect(b.getByRole("list", { name: "Chú giải" }).getByRole("listitem")).toHaveText([
    "Trang mới chưa đọc", "Trang khóa cần vượt thử thách", "Riêng tư chỉ mình bạn thấy",
  ]);
  await khongLo(b, BI_MAT, "quan may", "Quán Mây");

  // Chu sach khong bi cau do cua minh khoa: khong dem, doan trich la chu that.
  await a.goto("/ke-sach");
  const theA = a.locator(".cuon", { hasText: "Chuyện chưa kể" });
  await expect(theA.locator(".dau-hieu")).toHaveCount(0);
  await expect(a.locator(".ke-dau__phu")).toHaveText("1 cuốn");
  const ganNhatA = a.getByRole("article", { name: "Một trang trong sách" });
  await expect(ganNhatA.locator(".trang-khoa")).toHaveCount(0);
  // Doan trich den tu luot dang moi nhat (spec 2026-09-22 muc 10): cau do khong khoa chu sach, va luot moi nhat chi co
  // to 2, nen ho thay chu that cua to 2 chu khong phai to 1 cua luot cu.
  await expect(ganNhatA.getByRole("link", { name: "Đọc Chuyện chưa kể tại trang 2" })).toHaveAttribute("href", `/sach/${id}?trang=2`);
  await expect(ganNhatA.locator(".vua-viet__chu")).toContainText(BI_MAT);

  // Hen gio khoa ca chu sach, ke ca tren sach rieng tu. To cuoi khoa thang the rieng tu: chi dong he lo, khong lam mo chu that.
  const rieng = await taoSach(a, "Thư gửi năm ba mươi", "rieng-tu");
  await dangKemNiemPhong(a, [HOP_THOI_GIAN, BI_MAT], { kind: "hen-gio", opensAt: await gioSau(a, 86_400_000) });
  await a.goto("/ke-sach");
  await expect(a.locator(".ke-dau__phu")).toHaveText("2 cuốn");
  const theRieng = a.locator(".cuon", { hasText: "Thư gửi năm ba mươi" });
  await expect(theRieng.locator(".dh--khoa")).toHaveText("1 trang khóa");
  await expect(theRieng.locator(".dh--rieng")).toHaveText("Riêng tư");
  await expect(ganNhatA.locator(".trang-khoa .he-lo")).toHaveText(HOP_THOI_GIAN);
  const khoaA = ganNhatA.locator(".trang-khoa");
  await expect(khoaA.locator(".nhoe")).toHaveAttribute("aria-hidden", "true");
  expect(await khoaA.locator(".nhoe").evaluate((el) => el.textContent)).toBe("");
  await expect(khoaA.locator(".trang-che--duoi")).toHaveText("Trang khóa, vượt thử thách để đọc");
  // Dong he lo khong phai chu cua mot to: khong in so trang, nhan lien ket noi noi man doc bat dau.
  await expect(ganNhatA.locator(".sach-mo__so")).toHaveCount(0);
  await expect(ganNhatA.getByRole("link", { name: "Đọc Thư gửi năm ba mươi từ trang 1" })).toHaveAttribute("href", `/sach/${rieng}?trang=1`);
  await expect(ganNhatA.locator(".vua-viet__chu")).toHaveCount(0);
  await khongLo(a, BI_MAT);

  // Sach rieng tu cua nguoi kia khong co o bat ky dau trong trang, ke ca thuoc tinh va du lieu RSC.
  await b.goto("/ke-sach");
  await expect(b.locator(".ke-dau__phu")).toHaveText("1 cuốn, 2 trang mới");
  await khongLo(b, "Thư gửi năm ba mươi", HOP_THOI_GIAN);

  // Duong doc to niem phong va duong tra loi cua sach rieng tu: 404 giong het mot cuon khong ton tai.
  const [hop] = await niemPhongCua(rieng);
  for (const d of [
    `/sach/${rieng}?trang=1&mo=${hop.id}`,
    `/sach/${rieng}/tra-loi/${hop.id}`,
    `/sach/00000000-0000-4000-8000-000000000000?trang=1&mo=${hop.id}`,
  ]) {
    expect((await b.goto(d))?.status(), d).toBe(404);
  }

  // Cuon co toi ba dau hieu va dong phu dai hon khong lam tran ngang o man hep.
  for (const p of [a, b]) {
    await p.goto("/ke-sach");
    for (const width of [320, 375]) {
      await p.setViewportSize({ width, height: 900 });
      expect(await tranNgang(p), `tran ngang o ${width}px`).toEqual([]);
    }
  }
});
