import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eUrls } from "./env";
import { rethrowSafely } from "./safe-error";

/*
 * Buoc e2e dung chung cua niem phong. Buoc giao dien chi di qua chu that dang hien tren man hinh.
 * Ham cham database chi de doc kiem hoac doi thoi gian, khong bao gio de tao trang thai, va luon kiem
 * current_database() la mqce_e2e truoc khi lam gi (cung rao voi resetDb trong db.ts).
 */

type Sql = ReturnType<typeof postgres>;

/** Mo mot ket noi rieng toi database e2e, kiem ten database, chay viec, roi dong. Loi khong bao gio keo chuoi ket noi. */
async function trenE2e<T>(ten: string, viec: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ db }] = await sql<{ db: string }[]>`select current_database() as db`;
    if (db !== "mqce_e2e") throw new Error(`${ten} tu choi: dang noi vao "${db}", khong phai mqce_e2e`);
    return await viec(sql);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(`${ten} tu choi`)) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

export type DongNiemPhong = {
  id: string;
  kind: string;
  first_position: number;
  last_position: number;
  question: string | null;
  answers: string[];
  hints: string[];
  opens_at: Date | null;
  opened_at: Date | null;
  gift_note: string | null;
  teaser: string;
};

/** Doc cac niem phong cua mot cuon, theo vi tri. Chi doc de kiem. */
export async function niemPhongCua(bookId: string): Promise<DongNiemPhong[]> {
  return trenE2e("niemPhongCua", async (sql) => [
    ...(await sql<DongNiemPhong[]>`
      select s.id, s.kind, k.dau as first_position, k.cuoi as last_position, s.question, s.answers, s.hints,
        s.opens_at, s.opened_at, s.gift_note, s.teaser
      from seals s
      join (select round_id, min(position) as dau, max(position) as cuoi from pages group by round_id) k on k.round_id = s.round_id
      where s.book_id = ${bookId} order by k.dau`),
  ]);
}

export type NiemE2e =
  | { kind: "cau-do"; question: string; answers: readonly string[]; hints: readonly string[] }
  | { kind: "hen-gio"; opensAt: string }
  | { kind: "trao-doi"; question: string };

const TEN_LOAI = { "cau-do": "Câu đố", "hen-gio": "Hẹn giờ", "trao-doi": "Trao đổi" } as const;

/** Gia tri cho o datetime-local, tinh bang dong ho va mui gio cua chinh trinh duyet: bay gio cong ms. */
export async function gioSau(page: Page, ms: number): Promise<string> {
  return page.evaluate((lech) => {
    const d = new Date(Date.now() + lech);
    // Chay trong trinh duyet (page.evaluate), khong import duoc haiChuSo cua @/lib/when nen giu ban tai cho.
    const hai = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}T${hai(d.getHours())}:${hai(d.getMinutes())}`;
  }, ms);
}

/**
 * O man viet dang mo: go tung doan (moi doan mot dong Enter), bam Dang trang, chon va dien niem phong, bam
 * Dang, doi toi man doc. Dap an va goi y them dong bang nut Them cua chinh hop xac nhan.
 */
export async function dangKemNiemPhong(page: Page, doan: readonly string[], niem: NiemE2e): Promise<void> {
  await page.locator(".viet-chu .ProseMirror").click();
  for (const [i, chu] of doan.entries()) {
    if (i > 0) await page.keyboard.press("Enter");
    await page.keyboard.insertText(chu);
  }
  await page.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = page.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi).toBeVisible();
  await hoi.getByRole("radio", { name: TEN_LOAI[niem.kind] }).check();
  if (niem.kind === "hen-gio") {
    await hoi.getByLabel("Ngày giờ mở", { exact: true }).fill(niem.opensAt);
  } else {
    await hoi.getByLabel("Câu hỏi", { exact: true }).fill(niem.question);
  }
  if (niem.kind === "cau-do") {
    for (const [i, chu] of niem.answers.entries()) {
      if (i > 0) await hoi.getByRole("button", { name: "Thêm đáp án" }).click();
      await hoi.getByLabel(`Đáp án ${i + 1}`, { exact: true }).fill(chu);
    }
    for (const [i, chu] of niem.hints.entries()) {
      await hoi.getByRole("button", { name: "Thêm gợi ý" }).click();
      await hoi.getByLabel(`Gợi ý ${i + 1}`, { exact: true }).fill(chu);
    }
  }
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await page.waitForURL(new RegExp("/sach/[0-9a-f-]{36}[?]trang=[0-9]+$"));
}

/**
 * Moi chuoi liet ke khong co o bat ky dau trong HTML cua trang, ke ca thuoc tinh va du lieu RSC nhung trong trang.
 * Chi tin sau mot lan tai trang day du (goto, reload): du lieu RSC cua server action di qua fetch, khong vao DOM.
 */
export async function khongLo(page: Page, ...chu: string[]): Promise<void> {
  const html = await page.content();
  for (const lo of chu) expect(html, lo).not.toContain(lo);
}

/**
 * So con tro nghi thuc, dem ngay trong khung hinh ma dieu kien vua dung, phia trang. Doi roi dem o lenh rieng
 * thi do tre cua tien trinh test duoi tai co the vuot thoi gian nghi thuc (khoang 5 giay), va phep kiem "khong co
 * nghi thuc" xanh gia. `khung-hien`: khung sach vua het an sau lan tai trang, cung lan commit voi cong nghi thuc cua
 * Reader. `het-hen-gio`: dong ho hen gio (role timer) vua bien mat, cung lan lam moi voi to doi noi dung.
 */
export async function conTroKhi(page: Page, luc: "khung-hien" | "het-hen-gio"): Promise<number> {
  const kq = await page.waitForFunction(
    (lucNao) => {
      const khung = document.querySelector(".doc__khung");
      const dung = lucNao === "khung-hien"
        ? khung !== null && getComputedStyle(khung).visibility === "visible"
        : document.querySelector('[role="timer"]') === null;
      return dung && { conTro: document.querySelectorAll(".sach .con-tro").length };
    },
    luc,
    { polling: "raf" },
  );
  const giaTri = await kq.jsonValue();
  if (!giaTri) throw new Error(`conTroKhi(${luc}): dieu kien chua dung`);
  return giaTri.conTro;
}

/**
 * Lui moc moi lan thu cua mot niem phong di phut phut, de het khoang cho 10 phut ma khong phai doi that. Chi
 * doi thoi gian cua cac lan thu da co that (do nguoi kia go qua giao dien), khong tao lan thu nao.
 */
export async function luiMocThu(sealId: string, phut: number): Promise<void> {
  await trenE2e("luiMocThu", async (sql) => {
    const r = await sql`update seal_attempts set at = at - make_interval(mins => ${phut}) where seal_id = ${sealId}`;
    if (r.count === 0) throw new Error("khong co lan thu nao de lui");
  });
}

/**
 * Lui gio mo cua mot hen gio ve mot phut truoc, de toi gio ma khong phai doi that. Moc tinh bang dong ho cua Node
 * (giong doiGioNhap), vi app so voi dong ho Node chu khong voi dong ho cua database.
 */
export async function luiGioMo(sealId: string): Promise<void> {
  const truoc = new Date(Date.now() - 60_000);
  await trenE2e("luiGioMo", async (sql) => {
    const r = await sql`update seals set opens_at = ${truoc} where id = ${sealId} and kind = 'hen-gio'`;
    if (r.count !== 1) throw new Error("khong tim thay hen gio");
  });
}
