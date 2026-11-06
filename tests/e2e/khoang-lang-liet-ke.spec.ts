import { expect, test, type Page } from "@playwright/test";
import { resetDb } from "./db";
import { dangKemNiemPhong, khongLo, niemPhongCua } from "./niem-phong";
import {
  dangTrang,
  datNhac,
  docSach,
  doiNgayTaoSach,
  dongContextCu,
  ghiCamXuc,
  ghiThu,
  haiNguoiDaVao,
  taoSach,
} from "./kho-sach";
import { thangKhoa, tenThang } from "@/lib/tam-trang/lich";
import { thangVuaKhep } from "@/lib/thu";

/*
 * Khoang Lang: liet ke route (task 15).
 *
 * Mot test duy nhat tu di het moi route va bat ro ri: mat hien thi moi them sau tu dong bi soi
 * ma khong can ai viet them test. Route dong lay ID THAT tu du lieu sau khi seed, khong hard-code.
 *
 * Seed (A = Manh, B = Linh; B la doi phuong cua A):
 * - A tao sach chia se, dang 1 trang; B xin viet cung tren sach do (de nghi dang cho toi A).
 * - B tao sach chia se, dang 1 trang thuong (cau doc nhat) + 1 trang niem phong trao doi (cau hoi doc nhat).
 * - B tha tam trang qua UI (dang giu, kem nhan doc nhat) + gui thu thang vua khep (noi dung doc nhat)
 *   + tha cam xuc + dat nhac cho sach cua B.
 * - A luu 1 nhap tren sach cua minh (noi dung cua minh, phai con nguyen ca khi bat co).
 *
 * Moi route, 4 buoc: (1) tat co -> noi dung doi phuong CO hien (kiem soat duong, chuoi seed doc nhat);
 * (2) bat co QUA UI CAI DAT THAT (bam checkbox, khong ghi SQL); (3) toan bo body khong chua ten doi phuong
 * lan chuoi seed; (4) tat co lai -> hien lai. Chong pass rong: route rong thi fail; kiem soat duong khong
 * thay thi fail (seed hong thi test do chu khong xanh oan).
 *
 * Ngoai le co chu: /ban-nhap chi co noi dung cua minh theo thiet ke nen khong co kiem soat duong ve doi
 * phuong — chi kiem no tai duoc va khong ro ri; man lam viec (/viet, /sua, /sua-luot) chi kiem tai duoc
 * va khong ro ri TEN (theo Q2), khong kiem noi dung to (xem Q1). Thu thang mo ra la danh dau da doc nen
 * phan kiem noi dung thu dat CUOI buoc (1), va buoc (4) khong kiem lai la thu troi.
 */

test.beforeEach(resetDb);
test.afterEach(dongContextCu);

const TEN_SACH_A = "Sổ Tay Mùa Thu KHOANG-LANG";
const TEN_SACH_B = "Sổ Tay Mùa Mưa KHOANG-LANG";
const CAU_TRANG_B = "Chiều mưa KHOANG-LANG-SEED rơi trên mái tôn.";
const CAU_NIEM_PHONG = "Nội dung niêm phong KHOANG-LANG-SEED chưa ai mở.";
const CAU_HOI = "Câu hỏi KHOANG-LANG-SEED của Linh?";
const NHAN_TAM_TRANG = "Nắng chiều KHOANG-LANG-SEED";
const THU_TEXT = "Thư KHOANG-LANG-SEED gửi Mạnh, tháng này mưa nhiều.";
const NHAP_A = "Nháp KHOANG-LANG-SEED của Mạnh chưa đăng.";

const oKhoangLang = (p: Page): ReturnType<Page["getByRole"]> =>
  p.getByRole("checkbox", { name: "Bật Khoảng Lặng" });

/**
 * Ten doi phuong khong duoc xuat hien trong HTML (ca payload RSC) khi bat co. Kiem theo ranh gioi tu
 * (\b) chu khong kiem chuoi tran: "LinhVat" — ten component mascot ("linh vat") — chua "Linh" lam
 * chuoi con va nam trong payload cua moi trang co Chip, kiem tran se do oan.
 */
async function khongLoTen(p: Page, ten: string): Promise<void> {
  const html = await p.content();
  const thoat = ten.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(html).not.toMatch(new RegExp(`\\b${thoat}\\b`));
}

/** Bat/tat co qua UI Cai dat that, doi luu xong (o danh dau bat lai sau khi luu). */
async function datKhoangLang(p: Page, bat: boolean): Promise<void> {
  await p.goto("/cai-dat");
  await p.waitForLoadState("networkidle");
  if (bat) await oKhoangLang(p).check();
  else await oKhoangLang(p).uncheck();
  await expect(oKhoangLang(p)).toBeChecked({ checked: bat });
  await expect(oKhoangLang(p)).toBeEnabled();
}

test("khoang lang: liet ke route, tat co thay doi phuong, bat co khong thay gi, tat lai hien lai", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const { a, b, tenCuaB } = await haiNguoiDaVao(browser);
  expect(tenCuaB).toBe("Linh");
  const THANG_KHEP = thangVuaKhep(new Date());
  const KHOA = thangKhoa(THANG_KHEP);
  const TEN_THANG = tenThang(THANG_KHEP);
  // So nhac thang chi mo cho thang DA KHEP (thang hien tai thi 404) — kiem route thang khac o thang vua khep.
  const THANG_NHAC = KHOA;

  // Seed: sach cua A + de nghi cua B; sach cua B + trang thuong + trang niem phong trao doi.
  const idA = await taoSach(a, TEN_SACH_A, "chia-se");
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText("Sáng nay Mạnh chạy bộ quanh hồ.");
  expect(await dangTrang(a)).toBe(1);
  await a.waitForLoadState("networkidle");
  await docSach(b, idA);
  await b.getByRole("button", { name: "Xin viết cùng" }).click();
  await b
    .getByRole("group", { name: "Gửi lời xin tới Mạnh?" })
    .getByRole("button", { name: "Gửi lời xin" })
    .click();
  await expect(b.getByText("Đã xin, chờ Mạnh")).toBeVisible();

  const idB = await taoSach(b, TEN_SACH_B, "chia-se");
  await b.locator(".viet-chu .ProseMirror").click();
  await b.keyboard.insertText(CAU_TRANG_B);
  expect(await dangTrang(b)).toBe(1);
  await b.waitForLoadState("networkidle");
  await b.goto(`/sach/${idB}/viet-tiep`);
  await b.getByRole("button", { name: "Viết trang" }).click();
  await expect(b).toHaveURL(new RegExp(`/sach/${idB}/viet$`));
  await dangKemNiemPhong(b, [CAU_NIEM_PHONG], { kind: "trao-doi", question: CAU_HOI });

  // Tam trang cua B qua UI (dang giu) + thu + cam xuc + nhac. Hop "Tha tam trang" chi co tren /ke-sach
  // (ThaTamTrang render o ke-sach/page.tsx), KHONG co tren /tam-trang — tha o Lich hoa la sai trang:
  // getByRole(name) khop substring tren accessible name nen bam nham nut khac ma hop khong mo.
  // Cho trang hydrate xong moi bam; kiem hop mo that roi moi di tiep; bam truot thi bam lai.
  await b.goto("/ke-sach");
  await b.waitForLoadState("networkidle");
  await expect(async () => {
    await b.getByRole("button", { name: "Thả tâm trạng", exact: true }).click();
    await expect(b.locator("label.o", { hasText: "Mưa phùn" })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await b.locator("label.o", { hasText: "Mưa phùn" }).click();
  await b.getByLabel("Lời nhắn").fill(NHAN_TAM_TRANG);
  await b.getByLabel("Lời nhắn").fill(NHAN_TAM_TRANG);
  await b.getByRole("button", { name: "Thả", exact: true }).click();
  await expect(b.getByText("Đã thả Mưa phùn. Giữ trong 24 giờ.")).toBeAttached();
  await ghiThu("Linh", KHOA, THU_TEXT);
  await ghiCamXuc("Linh", { loai: "yeu", giayTruoc: 5 });
  await datNhac(idB, "dQw4w9WgXcQ");
  // O nhac mo dau lay gio tao sach lam thang: doi ngay tao sach B ve giua thang vua khep de bai nhac
  // cua B roi vao thang do (giong dau-thoi-gian.spec: doiNgayTaoSach + GIUA_THANG_TRUOC).
  await doiNgayTaoSach(idB, new Date(Date.UTC(THANG_KHEP.y, THANG_KHEP.m - 1, 15, 5)));
  const seal = (await niemPhongCua(idB)).find((s) => s.kind === "trao-doi");
  expect(seal).toBeDefined();
  const sealId = seal!.id;

  // Nhap cua A (noi dung cua minh).
  await a.goto(`/sach/${idA}/viet`);
  await a.locator(".viet-chu .ProseMirror").click();
  await a.keyboard.insertText(NHAP_A);
  await expect(a.getByText(/^Đã lưu lúc \d{2}:\d{2}$/)).toBeVisible({ timeout: 10_000 });

  // Chuoi cua doi phuong: ten sach + moi chuoi seed doc nhat (noi dung). Khong duoc xuat hien o bat ky
  // dau trong HTML khi bat co (khongLo doc ca du lieu RSC nhung trong trang). Ten doi phuong kiem RIENG
  // theo ranh gioi tu (khongLoTen): "Linh" la chuoi con cua "LinhVat" — ten component mascot ("linh vat")
  // nam trong payload RSC cua moi trang co Chip, nen kiem chuoi tran se do oan mai.
  const CHUOI_SEED = [
    TEN_SACH_B,
    CAU_TRANG_B,
    CAU_NIEM_PHONG,
    CAU_HOI,
    NHAN_TAM_TRANG,
    THU_TEXT,
  ];
  // Chi chuoi NOI DUNG (khong ten sach): dung cho trang cua chinh cuon do — tieu de la chu de cua trang
  // nen van hien theo quyet dinh da ap dung (giu tieu de khi mo sach doi phuong bang URL truc tiep);
  // chi noi dung to (trang, niem phong, tam trang, thu) moi phai an.
  const NOI_DUNG_SEED = CHUOI_SEED.filter((s) => s !== TEN_SACH_B);

  type RouteKiem = {
    url: string;
    /** Mo sach sau khi goto (man doc mo qua tam bia). */
    mo?: boolean;
    /** Kiem soat duong khi tat co (hoac chi kiem tai duoc, voi man lam viec / ban-nhap). */
    tat: (p: Page) => Promise<void>;
    /** Bat co thi trang 404 thay vi chi an noi dung (trang tra loi). */
    bat404?: boolean;
    /** Trang cua chinh cuon do: tieu de sach van hien (chu de trang), chi kiem chuoi noi dung. */
    chiNoiDung?: boolean;
  };
  const routes: RouteKiem[] = [
    {
      url: "/ke-sach",
      tat: async (p) => {
        await expect(p.locator(".ke-thu")).toHaveText(`Linh đã viết thư ${TEN_THANG} cho bạn`);
        await expect(p.locator(".loi-moi__chu")).toContainText(
          `Linh xin viết cùng ${TEN_SACH_A}`,
        );
        await expect(p.locator("body")).toContainText(TEN_SACH_B);
        await expect(p.getByRole("region", { name: "Tâm trạng của Linh" })).toBeVisible();
      },
    },
    {
      // Tam trang tren /tam-trang hien o lich hoa: khung chi tiet ngay hom nay (chon mac dinh)
      // co ghi chu doc nhat cua Linh. (Vung troi "Tam trang cua Linh" chi co tren /ke-sach.)
      url: "/tam-trang",
      tat: async (p) => {
        await expect(p.locator(".chi-tiet__nhan")).toContainText(NHAN_TAM_TRANG);
      },
    },
    {
      url: "/cai-dat",
      tat: async (p) => {
        await expect(p.getByRole("heading", { name: "Họ gửi bạn" })).toBeVisible();
        await expect(p.locator("body")).toContainText("Linh");
      },
    },
    {
      // Ban nhap chi co noi dung cua minh theo thiet ke: kiem tai duoc + nhap cua minh con do.
      url: "/ban-nhap",
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(TEN_SACH_A);
      },
    },
    {
      url: "/dau-thoi-gian",
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(TEN_SACH_B);
      },
    },
    {
      url: `/dau-thoi-gian/${idB}`,
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(TEN_SACH_B);
      },
      chiNoiDung: true,
    },
    {
      url: `/dau-thoi-gian/thang/${THANG_NHAC}`,
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(TEN_SACH_B);
      },
    },
    {
      url: `/sach/${idB}`,
      mo: true,
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(CAU_TRANG_B);
        await expect(p.locator("body")).toContainText(CAU_HOI);
      },
      chiNoiDung: true,
    },
    {
      url: `/sach/${idB}/tra-loi/${sealId}`,
      tat: async (p) => {
        await expect(p.locator("body")).toContainText(CAU_HOI);
      },
      bat404: true,
    },
    {
      // Man lam viec: chi kiem tai duoc + khong ro ri ten (Q2), khong kiem noi dung to (Q1).
      url: `/sach/${idA}/viet`,
      tat: async (p) => {
        await expect(p.locator(".viet-chu .ProseMirror")).toBeVisible();
      },
    },
    {
      url: `/sach/${idA}/sua`,
      tat: async (p) => {
        await expect(p.getByLabel("Tên sách")).toBeVisible();
      },
    },
    {
      url: `/sach/${idA}/sua-luot/1`,
      tat: async (p) => {
        // Trang nay render RoundEditor truc tiep, khong co <main>: kiem trinh soan thao hien.
        await expect(p.locator(".viet-chu .ProseMirror")).toBeVisible();
      },
    },
  ];
  expect(routes.length).toBeGreaterThan(0);

  // Buoc (1): tat co, moi route phai thay noi dung doi phuong (kiem soat duong).
  let daVao = 0;
  for (const r of routes) {
    await a.goto(r.url);
    if (r.mo === true) await moSach(a);
    await r.tat(a);
    daVao += 1;
  }
  expect(daVao).toBe(routes.length);

  // Noi dung thu: mo la thu troi (danh dau da doc) nen kiem CUOI buoc (1).
  await a.goto(`/tam-trang#thu-${KHOA}`);
  await a.waitForLoadState("networkidle");
  await a
    .getByRole("button", { name: `Linh gửi bạn thư ${TEN_THANG}. Bấm để đọc` })
    .click();
  const hopThu = a.getByRole("dialog", { name: `Thư ${TEN_THANG} của Linh` });
  await expect(hopThu.locator(".thu-la__than")).toContainText(THU_TEXT);

  // Buoc (2)+(3): gieo lai mot cam xuc moi (de lop Chip co thu de lo neu co hong), bat co qua UI that,
  // roi moi route phai sach ten doi phuong va chuoi seed.
  await ghiCamXuc("Linh", { loai: "yeu", giayTruoc: 5 });
  await datKhoangLang(a, true);
  daVao = 0;
  for (const r of routes) {
    if (r.bat404 === true) {
      const res = await a.goto(r.url);
      expect(res?.status()).toBe(404);
    } else {
      await a.goto(r.url);
      if (r.mo === true) await moSach(a);
      await khongLo(a, ...(r.chiNoiDung === true ? NOI_DUNG_SEED : CHUOI_SEED));
      await khongLoTen(a, "Linh");
    }
    daVao += 1;
  }
  expect(daVao).toBe(routes.length);

  // Buoc (4): tat co lai qua UI, noi dung doi phuong hien lai (kiem diem o 2 route chinh).
  await datKhoangLang(a, false);
  await a.goto("/ke-sach");
  await expect(a.locator(".loi-moi__chu")).toContainText(`Linh xin viết cùng ${TEN_SACH_A}`);
  await expect(a.locator("body")).toContainText(TEN_SACH_B);
  await a.goto(`/sach/${idB}`);
  await moSach(a);
  await expect(a.locator("body")).toContainText(CAU_TRANG_B);
  await expect(a.locator("body")).toContainText(CAU_HOI);
});

async function moSach(p: Page): Promise<void> {
  const nut = p.getByRole("button", { name: "Mở sách" });
  await expect(async () => {
    await nut.click({ timeout: 2_000 });
    await expect(nut).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
