import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";
import { assertE2eDatabase, resetDb } from "./db";
import { e2eUrls, GROQ_GIA_CONG } from "./env";
import { choLanCuoiThay, datLanCuoiThay, dongContextCu, ghiThu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { rethrowSafely } from "./safe-error";

/*
 * Chip chu dong bat chuyen (dot nam 5e mo rong) tren trinh duyet that, voi may chu Groq gia RIENG o cong
 * GROQ_GIA_CONG: nhan dien cuoc goi chu dong bang dong "Sự kiện vừa xảy ra:" trong system prompt va tra cau co dinh
 * (khong dung may gia cua chip-tro-chuyen vi no nhai tin cuoi). Tha tam trang thi Chip hoi tham ngay trong bong bong;
 * mo trang / tao sach thi quet luc mo trang; loi da luu vao lich su de tra loi tiep duoc; tat tuNoi / Khoang Lang bat /
 * Chip dang ngu / dang go trong o nhap thi khong hien bong bong; loi chao thang khi ca hai cung toi.
 * a la Mạnh, b la Linh.
 */

/** Cau co dinh may Groq gia tra cho moi cuoc goi chu dong. */
const CAU_CO_DINH = "Chíp tò mò quá, kể Chíp nghe đi nào?";

/** Cac lan goi toi Groq gia: tin he thong, tin cuoi, va co phai cuoc goi chu dong khong. */
const daGoi: { heThong: string; cuoi: string; chuDong: boolean }[] = [];
/** Tre them cho cuoc goi chu dong (ms): de test cong focus co thoi gian dua tieu diem vao o nhap truoc khi loi ve. */
let treChuDongMs = 0;
let may: Server;

test.beforeAll(async () => {
  may = createServer((req, res) => {
    let than = "";
    req.on("data", (c: Buffer) => {
      than += c.toString("utf8");
    });
    req.on("end", async () => {
      const body = JSON.parse(than) as { messages: { role: string; content: string }[] };
      const heThong = body.messages.find((m) => m.role === "system")?.content ?? "";
      const cuoi = body.messages.at(-1)?.content ?? "";
      const chuDong = heThong.includes("Sự kiện vừa xảy ra:");
      daGoi.push({ heThong, cuoi, chuDong });
      if (chuDong && treChuDongMs > 0) await new Promise((r) => setTimeout(r, treChuDongMs));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: chuDong ? CAU_CO_DINH : `Chíp nghe rồi: **${cuoi}**` } }],
        }),
      );
    });
  });
  await new Promise<void>((ok) => may.listen(GROQ_GIA_CONG, "127.0.0.1", ok));
});

test.afterAll(async () => {
  await new Promise<void>((ok) => may.close(() => ok()));
});

test.beforeEach(async () => {
  daGoi.length = 0;
  treChuDongMs = 0;
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

/** So cuoc goi chu dong may Groq gia da thay. */
const soChuDong = () => daGoi.filter((g) => g.chuDong).length;

/** Xoa cooldown bong bong 10 phut o may khach de loi chu dong duoc hien ngay (loi chao dau da dat no). */
async function xoaNoiLuc(p: Page): Promise<void> {
  await p.evaluate(() => localStorage.removeItem("mqce-chip-noi-luc"));
}

/**
 * Doi cho bong bong loi chao dau tu dong dong (8 giay): neu con hien luc goi chu dong thi cooldown 10 phut chan
 * luon loi chu dong, nen moi test tich cuc deu doi het bong bong nay truoc khi kich hoat.
 */
async function choHetLoiChao(p: Page): Promise<void> {
  await expect(p.locator(".loi-lv--chao")).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Tha mot tam trang qua hop chon, tren trang dang mo. Bam mo hop toi da 3 lan: cai bam truoc khi React hydrat
 * xong se mat tac dung ma khong bao loi, nen chi bam mot lan thi hop co the khong mo duoi may tai.
 */
async function thaTaiCho(p: Page, w: Weather, nhan = ""): Promise<void> {
  const hop = p.locator("label.o", { hasText: TROI[w].ten });
  for (let lan = 0; lan < 3; lan++) {
    await p.getByRole("button", { name: "Thả tâm trạng" }).click();
    try {
      await expect(hop).toBeVisible({ timeout: 3_000 });
      break;
    } catch {
      // Hop chua mo (bam truoc hydrat): bam lai.
    }
  }
  await hop.click();
  if (nhan !== "") await p.getByLabel("Lời nhắn").fill(nhan);
  await p.getByRole("button", { name: "Thả", exact: true }).click();
}

/** Thu lai tam trang dang giu (mo hop roi bam "Thu lại"). */
async function thuLai(p: Page): Promise<void> {
  await p.getByRole("button", { name: "Thả tâm trạng" }).click();
  await p.getByRole("button", { name: "Thu lại" }).click();
}

/**
 * Tha tam trang cho toi khi bong bong chu dong hien (toi da 5 lan): moi co hoi Chip chi noi voi xac suat 60%,
 * lan nao truot thi thu lai roi tha troi khac. Kiem chu bong bong, khong chi hien, de khong nham loi chao.
 * Cua so 15 giay: duoi may tai, vong goi action + Groq co the ve muon.
 */
async function thaChoLoi(p: Page): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    await thaTaiCho(p, WEATHERS[i % WEATHERS.length]);
    try {
      await expect(p.locator(".loi-lv--chao .loi-lv__chu")).toHaveText(CAU_CO_DINH, { timeout: 15_000 });
      return true;
    } catch {
      // Truot xac suat: thu lai roi tha troi khac.
    }
    await thuLai(p);
  }
  return false;
}

/** Chu bong bong dang hien (null neu khong co bong bong nao). */
async function chuBongBong(p: Page): Promise<string | null> {
  const el = p.locator(".loi-lv--chao .loi-lv__chu");
  if ((await el.count()) === 0) return null;
  return el.textContent();
}

/**
 * Tai lai trang cho toi khi bong bong chu dong hien (toi da 4 lan). Lan dau kiem ngay tren trang vua mo
 * (quet chay luc mount, khong can tai lai); cac lan sau tai lai truoc. Moi lan doi toi da 15 giay, kiem chu
 * moi 300ms; neu may chu goi Groq giua chung (loi da sinh, ma da tieu thu) thi doi them 15 giay thay vi tai
 * lai vo ich. Cua so 15 giay (khong phai 10): luc may tai, lan quet co the ve muon hon 10 giay sau khi tai.
 */
/** Chan doan luc quet goi Groq xong ma bong bong khong hien: ghi lai trang thai client de biet cong nao chan. */
let chanDoanQuet = "";
async function ghiChanDoan(p: Page): Promise<void> {
  const t = await p.evaluate(() => {
    const khoa = localStorage.getItem("mqce-chip-noi-luc");
    const el = document.activeElement;
    const bb = document.querySelector(".loi-lv--chao");
    const chu = bb?.querySelector(".loi-lv__chu")?.textContent ?? null;
    return { khoa: khoa === null ? null : Date.now() - Number(khoa), focus: el?.tagName ?? null, bb: bb !== null, chu };
  });
  chanDoanQuet = JSON.stringify(t);
}

async function taiLaiChoLoi(p: Page): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    if (i > 0) {
      await p.reload();
    }
    // Xoa key SAU khi tai lai: mount o trang cu co the resolve muon (loi chao) va dat lai key sau lan xoa
    // truoc do; sau khi tai lai thi mount cu da chet (con=false) nen khong ai dat lai key nua.
    await xoaNoiLuc(p);
    const truoc = soChuDong();
    const den = Date.now() + 15_000;
    let thayGoi = false;
    while (Date.now() < den) {
      if ((await chuBongBong(p)) === CAU_CO_DINH) return true;
      if (soChuDong() > truoc) {
        thayGoi = true;
        break;
      }
      await p.waitForTimeout(300);
    }
    if (thayGoi) {
      await ghiChanDoan(p);
      // Cho them 15 giay (khong phai 8): bong bong chi bat dau song 8 giay tu luc hien, ma loi tra ve co the
      // cham hon luc goi Groq vai giay khi may tai (lan 9: loi ve sau ~8 giay vi load 3,44).
      const den2 = Date.now() + 15_000;
      while (Date.now() < den2) {
        if ((await chuBongBong(p)) === CAU_CO_DINH) return true;
        await p.waitForTimeout(300);
      }
      await ghiChanDoan(p);
      return false;
    }
  }
  return false;
}

/** Bat/tat Khoang Lang cho nguoi co biet danh ai, thang vao database e2e (theo mau cua kho-sach.ts). */
async function datKhoangLang(ai: string, bat: boolean): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const r = await sql`update accounts set khoang_lang = ${bat} where nickname = ${ai}`;
    if (r.count !== 1) throw new Error("datKhoangLang: khong tim thay nguoi");
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("resetDb tu choi") || e.message.startsWith("datKhoangLang:"))) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

/** Dat lai moc chu dong (chu_dong_luc, chu_dong_ma) cho nguoi co biet danh ai, thang vao database e2e. */
async function datLaiChuDong(ai: string): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const r = await sql`update chip_trang_thai set chu_dong_luc = null, chu_dong_ma = null
      where account_id = (select id from accounts where nickname = ${ai})`;
    if (r.count !== 1) throw new Error("datLaiChuDong: khong tim thay nguoi");
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("resetDb tu choi") || e.message.startsWith("datLaiChuDong:"))) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

/** Cho Chip ngu toi luc cho truoc (mot hang duy nhat khoa 'groq', dung chung ca hai nguoi). */
async function datChipNghi(den: Date): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    await sql`insert into chip_nghi (khoa, den) values ('groq', ${den})
      on conflict (khoa) do update set den = ${den}`;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("resetDb tu choi")) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

test("tha tam trang xong: Chip hoi tham ngay trong bong bong, loi da luu, tra loi tiep duoc", async ({ browser }) => {
  test.slow();
  const { a } = await haiNguoiDaVao(browser);
  // Hop ThaTamTrang chi co tren Ke sach (tam-trang/page.tsx khong render no): tha o day.
  await a.goto("/ke-sach");
  await choHetLoiChao(a);
  // Xoa cooldown bong bong 10 phut cua loi chao: khong thi bong bong truc tiep bi chan (dung thiet ke D1),
  // khong phai do duong goi truc tiep hong.
  await xoaNoiLuc(a);
  expect(await thaChoLoi(a), `khong thay bong bong; so cuoc goi chu dong toi Groq: ${soChuDong()}`).toBe(true);
  const loi = a.locator(".loi-lv--chao");
  await expect(loi.locator(".loi-lv__chu")).toHaveText(CAU_CO_DINH);
  await expect(loi.getByRole("link", { name: "Xem ngay" })).toHaveAttribute("href", "/tam-trang");
  const goi = daGoi.find((g) => g.chuDong);
  expect(goi).toBeDefined();
  expect(goi?.heThong).toContain("Sự kiện vừa xảy ra:");
  expect(goi?.heThong).toContain("Mạnh thả tâm trạng");

  await a.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
  const to = a.getByRole("region", { name: "Chíp", exact: true });
  await expect(to.locator(".tin--chip")).toContainText([CAU_CO_DINH]);
  await to.getByLabel("Nói với Chíp").fill("Ừ, Chíp đoán xem");
  await to.getByLabel("Nói với Chíp").press("Enter");
  await expect(to.locator(".tin--chip").last()).toHaveText("Chíp: Chíp nghe rồi: Ừ, Chíp đoán xem");
});

test("mo trang tam trang: quet luc mo trang thay viec moi, bong bong hien cau chu dong", async ({ browser }) => {
  test.slow();
  const { b } = await haiNguoiDaVao(browser);
  // Xoa cooldown bong bong cua loi chao (neu co) SAU khi mo trang, de bong bong quet khong bi chan.
  // Khong choHetLoiChao o day: bong bong quet co the hien ngay tu lan mount dau, vong lap se thay no.
  // Xoa sau goto (khong phai truoc): mount o /ke-sach vua mo trong haiNguoiDaVao co the resolve muon va
  // dat lai key sau lan xoa truoc goto; sau goto thi mount cu da chet nen khong ai dat lai key nua.
  await b.goto("/tam-trang");
  await xoaNoiLuc(b);
  expect(await taiLaiChoLoi(b), `khong thay bong bong; so cuoc goi chu dong toi Groq: ${soChuDong()}; chan doan: ${chanDoanQuet}`).toBe(true);
  const goi = daGoi.find((g) => g.chuDong);
  expect(goi).toBeDefined();
  expect(goi?.heThong).toContain("đang mở trang Thả tâm trạng");
});

test("tao sach xong: mo Ke sach thi Chip hoi ve cuon moi", async ({ browser }) => {
  test.slow();
  const { a } = await haiNguoiDaVao(browser);
  await taoSach(a, "Sổ tay thử", "chia-se");
  // Trang viet an LinhVat (AppNav linhVat={false}) nen quet khong chay o do: mo Ke sach (co LinhVat, khong
  // phai trang bat chuyen T1) de quet thay viec tao sach con tuoi trong 6 gio. Xoa key sau goto (xem test 2).
  // taoSach mo /sach/moi truoc (la trang T1): quet o do co the no truoc va tieu thu cooldown 30 phut, nen
  // dat lai moc may chu truoc khi mo Ke sach; cuoc goi T1 do (neu co) khong anh huong bong bong o Ke sach.
  await datLaiChuDong("Mạnh");
  await a.goto("/ke-sach");
  await xoaNoiLuc(a);
  expect(await taiLaiChoLoi(a), `khong thay bong bong; so cuoc goi chu dong toi Groq: ${soChuDong()}; chan doan: ${chanDoanQuet}`).toBe(true);
  const goi = daGoi.find((g) => g.chuDong && g.heThong.includes("Sổ tay thử"));
  expect(goi).toBeDefined();
  expect(goi?.heThong).toContain("Sổ tay thử");
});

test("tat tu noi trong Cai dat: tha tam trang thi Chip im, khong goi Groq", async ({ browser }) => {
  test.slow();
  const { b } = await haiNguoiDaVao(browser);
  await b.goto("/cai-dat");
  await b.getByLabel("Chíp tự bắt chuyện, tự chào và báo chuyện mới").uncheck();
  await b.goto("/ke-sach");
  await choHetLoiChao(b);
  await thaTaiCho(b, "nang-am");
  await b.waitForTimeout(6_000);
  await expect(b.locator(".loi-lv--chao")).toHaveCount(0);
  expect(soChuDong()).toBe(0);
});

test("Khoang Lang bat: viec moi cua doi phuong khong khien Chip bat chuyen", async ({ browser }) => {
  test.slow();
  const { b } = await haiNguoiDaVao(browser);
  // Xoa cooldown bong bong cua loi chao (neu co) truoc khi mo trang, de bong bong quet khong bi chan.
  await xoaNoiLuc(b);
  await b.goto("/tam-trang");
  // An het T1 cua trang nay truoc (moi trang mot lan mot ngay), de lan quet sau chi con T8 de xet.
  expect(await taiLaiChoLoi(b), `khong thay bong bong; so cuoc goi chu dong toi Groq: ${soChuDong()}`).toBe(true);
  const daGoiTruoc = soChuDong();
  await ghiThu("Mạnh", "2026-09", "Gửi Linh tháng Chín.");
  await datKhoangLang("Linh", true);
  await b.reload();
  await b.waitForTimeout(6_000);
  await expect(b.locator(".loi-lv--chao")).toHaveCount(0);
  expect(soChuDong()).toBe(daGoiTruoc);
});

test("Chip dang ngu: tha tam trang thi Chip im, khong goi Groq", async ({ browser }) => {
  test.slow();
  const { b } = await haiNguoiDaVao(browser);
  await b.goto("/ke-sach");
  await choHetLoiChao(b);
  await datChipNghi(new Date(Date.now() + 60 * 60_000));
  await thaTaiCho(b, "nang-am");
  await b.waitForTimeout(6_000);
  await expect(b.locator(".loi-lv--chao")).toHaveCount(0);
  expect(soChuDong()).toBe(0);
});

test("dang go trong o nhap: loi chu dong khong hien bong bong nhung van luu vao lich su", async ({ browser }) => {
  test.slow();
  const { b } = await haiNguoiDaVao(browser);
  await b.goto("/ke-sach");
  await choHetLoiChao(b);
  // Xoa cooldown bong bong 10 phut cua loi chao: bong bong phai du dieu kien hien (chi bi cong focus chan),
  // khong thi test nay vuot du cong focus co hong hay khong.
  await xoaNoiLuc(b);
  treChuDongMs = 3_000;
  for (let lan = 0; lan < 5; lan++) {
    await thaTaiCho(b, WEATHERS[lan % WEATHERS.length]);
    await b.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
    const to = b.getByRole("region", { name: "Chíp", exact: true });
    await to.getByLabel("Nói với Chíp").click();
    await b.waitForTimeout(6_000);
    await expect(b.locator(".loi-lv--chao")).toHaveCount(0);
    await to.getByRole("button", { name: "Đóng trò chuyện" }).click();
    await b.getByRole("button", { name: "Chíp, mở trò chuyện" }).click();
    const to2 = b.getByRole("region", { name: "Chíp", exact: true });
    const daLuu = await to2.locator(".tin--chip").filter({ hasText: CAU_CO_DINH }).count();
    if (daLuu > 0) return;
    await to2.getByRole("button", { name: "Đóng trò chuyện" }).click();
    await thuLai(b);
  }
  throw new Error("5 lan tha deu khong co loi chu dong nao duoc luu (xac suat truot lien tiep)");
});

test("loi chao thang: vang lau quay lai thi chi thay loi chao, khong co cuoc goi chu dong", async ({ browser }) => {
  const { b } = await haiNguoiDaVao(browser);
  await choLanCuoiThay("Linh");
  await datLanCuoiThay("Linh", new Date(Date.now() - 3 * 86_400_000 - 60_000));
  await ghiThu("Mạnh", "2026-09", "Gửi Linh tháng Chín.");
  await xoaNoiLuc(b);
  await b.reload();
  const loi = b.locator(".loi-lv--chao");
  await expect(loi.locator(".loi-lv__chu")).toHaveText("Linh về rồi! 3 ngày rồi đó. Trong lúc Linh đi, Mạnh gửi thư tháng Chín.");
  expect(soChuDong()).toBe(0);
});
