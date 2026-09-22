import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";
import type { DocJson } from "@/lib/doc/types";
import { assertE2eDatabase } from "./db";
import { e2eUrls } from "./env";
import { rethrowSafely } from "./safe-error";

/*
 * Buoc dung chung cho e2e cua kho sach. Chi di qua giao dien bang dung chuoi dang co tren man
 * hinh, khong dung ham noi bo cua file ho tro nao khac. Ten nguoi chi la du lieu mau.
 */
const TEN_CUA_A = "Mạnh";
const TEN_CUA_B = "Linh";

/**
 * Thoi gian cho mot buoc bam argon2 (tao cho ngoi, dang nhap). Duoi tai ca bo e2e, argon2 tren dev server co the
 * lau hon timeout 5 giay mac dinh cua mot khang dinh. test.slow() chi gap ba thoi gian cua ca test, khong gap tung
 * khang dinh, nen moi khang dinh doi argon2 tu noi tran cho rieng. Moi spec doi argon2 dung chung hang nay.
 */
export const CHO_ARGON2_MS = 20_000;

/**
 * Context do haiNguoiDaVao mo trong test dang chay. Dong sau moi test, truoc resetDb cua test sau: trang cu con mo
 * se ban moc da doc va lam moi sang database vua bi xoa cua test sau. Moi spec goi dongContextCu trong
 * test.afterEach cua chinh no; hook khai o muc module cua file nay chi gan vao spec dau tien nap no, vi module
 * chi chay mot lan moi tien trinh.
 */
const contextDangMo: BrowserContext[] = [];

export async function dongContextCu(): Promise<void> {
  for (const c of contextDangMo.splice(0)) await c.close();
}

/** O man /khoi-tao: dat ten cho nguoi kia, tra mat khau vua sinh. */
async function taoChoNgoi(page: Page, bietDanh: string, loiNhan: string): Promise<string> {
  await page.getByLabel("Biệt danh bạn đặt cho người kia").fill(bietDanh);
  await page.getByLabel("Lời nhắn bí mật gửi họ").fill(loiNhan);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const matKhau = page.getByTestId("mat-khau");
  await expect(matKhau).toBeVisible({ timeout: CHO_ARGON2_MS });
  return (await matKhau.innerText()).trim();
}

async function dangNhap(page: Page, matKhau: string): Promise<void> {
  await page.goto("/dang-nhap");
  await page.getByLabel("Mật khẩu người kia gửi cho bạn").fill(matKhau);
  await page.getByRole("button", { name: "Vào", exact: true }).click();
}

/**
 * Tron nghi thuc tren web trong: A tao cho 1 cho B, B dang nhap roi tao cho 2 cho A, A dang nhap.
 * Moi nguoi mot context, tuc mot dau thiet bi rieng. Ca hai dung o /ke-sach khi ham tra ve.
 */
export async function haiNguoiDaVao(browser: Browser): Promise<{ a: Page; b: Page; tenCuaA: string; tenCuaB: string }> {
  // Hai lan tao cho ngoi bam argon2 tren dev server da mat gan 20 giay, nen moi test dung ham nay duoc gap ba
  // thoi gian cho: tran 30 giay mac dinh lam test chap chon khi ca bo e2e chay cung luc.
  test.slow();
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  contextDangMo.push(ca, cb);
  const a = await ca.newPage();
  const b = await cb.newPage();

  await a.goto("/");
  await expect(a).toHaveURL(new RegExp("/khoi-tao$"));
  const matKhauCuaB = await taoChoNgoi(a, TEN_CUA_B, "gui nguoi thu hai");

  await dangNhap(b, matKhauCuaB);
  await expect(b).toHaveURL(new RegExp("/khoi-tao$"), { timeout: CHO_ARGON2_MS });
  const matKhauCuaA = await taoChoNgoi(b, TEN_CUA_A, "gui nguoi mo dau");
  await expect(b.getByText("Giờ cả hai đã có tài khoản.")).toBeVisible({ timeout: CHO_ARGON2_MS });

  await dangNhap(a, matKhauCuaA);
  await expect(a).toHaveURL(new RegExp("/ke-sach$"), { timeout: CHO_ARGON2_MS });
  await b.goto("/ke-sach");
  await expect(b).toHaveURL(new RegExp("/ke-sach$"));
  return { a, b, tenCuaA: TEN_CUA_A, tenCuaB: TEN_CUA_B };
}

/**
 * Moi phan tu dang hien ma tran qua mep phai man hinh. Rong la dat (khong duoc tran ngang).
 * Ngay sau khi doi kich thuoc cua so, man viet va man doc con dang thu phong lai (useFitScale do qua ResizeObserver
 * roi React ve lai), nen do ngay co the thay bo cuc cu. Vi vay do lap lai toi khi het tran; tran that thi
 * van con sau choToiMs va danh sach duoc tra ve de test do.
 *
 * Phan nam trong mot to tien `overflow-x: clip` bi cat o mep phai cua to tien do, khong ve ra ngoai va khong
 * tao vung cuon (vd cac to dang khuat cua man viet luc chon niem phong, xep canh nhau trong khung cat). Chi
 * tinh phan con thay; chinh to tien do van duoc do nhu moi phan tu khac, nen khung cat tran van bi bat.
 */
export async function tranNgang(page: Page, choToiMs = 2_000): Promise<string[]> {
  const hetHan = Date.now() + choToiMs;
  for (;;) {
    const tran = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!(r.width > 0) || getComputedStyle(el).visibility === "hidden") return false;
          let phai = r.right;
          for (let cha = el.parentElement; cha && cha !== document.body; cha = cha.parentElement) {
            if (getComputedStyle(cha).overflowX === "clip") phai = Math.min(phai, cha.getBoundingClientRect().right);
          }
          return phai > w + 1;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`);
    });
    if (tran.length === 0 || Date.now() >= hetHan) return tran;
    await page.waitForTimeout(100);
  }
}

export type CheDo = "chia-se" | "rieng-tu";

/** Tao mot cuon qua man /sach/moi voi bia mac dinh. Tra ma sach; trang dung lai o man viet cua cuon do. */
export async function taoSach(page: Page, ten: string, cheDo: CheDo): Promise<string> {
  await page.goto("/sach/moi");
  await page.getByLabel("Tên sách").fill(ten);
  await page.getByRole("radio", { name: cheDo === "chia-se" ? "Chia sẻ" : "Riêng tư", exact: true }).check();
  await page.getByRole("button", { name: "Tạo sách" }).click();
  await page.waitForURL(new RegExp("/sach/[0-9a-f-]{36}/viet$"));
  return new URL(page.url()).pathname.split("/")[2];
}

/**
 * Chen mot luot dang thang vao database e2e, khong qua man viet: mot dong rounds, cac to lien nhau sau to cuoi, cung
 * published_at (nhu publishDraft). Rao giong resetDb: chi ghi khi dang o mqce_e2e; loi chi giu code va message, khong
 * bao gio in chuoi ket noi.
 */
export async function dangToThang(bookId: string, ...cacTo: (string | DocJson)[]): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1 });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    if (ten !== "mqce_e2e") throw new Error("dangToThang chi chay tren database mqce_e2e");
    const luc = new Date();
    await sql.begin(async (tx) => {
      const [{ cuoi }] = await tx<{ cuoi: number | null }[]>`select max(position) as cuoi from pages where book_id = ${bookId}`;
      const [{ id }] = await tx<{ id: string }[]>`insert into rounds (book_id, published_at) values (${bookId}, ${luc}) returning id`;
      let position = cuoi ?? 0;
      for (const x of cacTo) {
        position += 1;
        const content = typeof x === "string"
          ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: x }] }] }
          : x;
        await tx`insert into pages (book_id, round_id, position, content, published_at) values (${bookId}, ${id}, ${position}, ${tx.json(content)}, ${luc})`;
      }
    });
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    // oxlint-disable-next-line eslint/preserve-caught-error -- co y KHONG gan cause: loi goc cua driver postgres co the chua chuoi ket noi (mat khau); rao ngay tren ham nay cam in no ra.
    throw new Error(`dangToThang hong: ${code ?? "?"} ${message ?? ""}`);
  } finally {
    await sql.end();
  }
}

/** Gan ma video cho mot cuon trong database e2e (thay cho o Nhac nen cua form sua sach). Cung rao voi dangToThang. */
export async function datNhac(bookId: string, youtubeId: string): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const r = await sql`update books set youtube_id = ${youtubeId} where id = ${bookId}`;
    if (r.count !== 1) throw new Error("datNhac: khong tim thay cuon sach");
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("resetDb tu choi") || e.message.startsWith("datNhac:"))) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

/** Doi gio luu cua ban nhap trong database e2e, de chup anh "Luu hom qua". Cung rao voi dangToThang. */
export async function doiGioNhap(bookId: string, luc: Date): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1 });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    if (ten !== "mqce_e2e") throw new Error("doiGioNhap chi chay tren database mqce_e2e");
    await sql`update drafts set updated_at = ${luc} where book_id = ${bookId}`;
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    // oxlint-disable-next-line eslint/preserve-caught-error -- co y KHONG gan cause: loi goc cua driver postgres co the chua chuoi ket noi (mat khau); rao ngay tren ham nay cam in no ra.
    throw new Error(`doiGioNhap hong: ${code ?? "?"} ${message ?? ""}`);
  } finally {
    await sql.end();
  }
}

/** Doc ban nhap hien luu trong database e2e cua mot cuon, hoac null neu chua tung luu. Cung rao voi doiGioNhap. */
export async function nhapCua(bookId: string): Promise<{ sheetCount: number; content: unknown } | null> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1 });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    if (ten !== "mqce_e2e") throw new Error("nhapCua chi chay tren database mqce_e2e");
    const rows = await sql<{ sheet_count: number; content: unknown }[]>`select sheet_count, content from drafts where book_id = ${bookId}`;
    return rows.length > 0 ? { sheetCount: rows[0].sheet_count, content: rows[0].content } : null;
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    // oxlint-disable-next-line eslint/preserve-caught-error -- co y KHONG gan cause: loi goc cua driver postgres co the chua chuoi ket noi (mat khau); rao ngay tren ham nay cam in no ra.
    throw new Error(`nhapCua hong: ${code ?? "?"} ${message ?? ""}`);
  } finally {
    await sql.end();
  }
}

/** Cuon con trong database e2e khong. Chi doc de kiem. Cung rao voi nhapCua. */
export async function coSach(bookId: string): Promise<boolean> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1 });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    if (ten !== "mqce_e2e") throw new Error("coSach chi chay tren database mqce_e2e");
    return (await sql`select 1 from books where id = ${bookId}`).length === 1;
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    // oxlint-disable-next-line eslint/preserve-caught-error -- co y KHONG gan cause: loi goc cua driver postgres co the chua chuoi ket noi (mat khau); rao ngay tren ham nay cam in no ra.
    throw new Error(`coSach hong: ${code ?? "?"} ${message ?? ""}`);
  } finally {
    await sql.end();
  }
}

const DOAN = "Hôm nay mưa từ ba giờ chiều tới tối, anh đứng ở hiên nhìn nước chảy thành dòng trên mái tôn. ";

/** Go muoi doan dai o man viet dang mo, du tran sang it nhat to thu hai. */
export async function vietTranTrang(page: Page): Promise<void> {
  await page.locator(".viet-chu .ProseMirror").click();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.insertText(DOAN.repeat(2).trim());
    await page.keyboard.press("Enter");
  }
  await expect.poll(() => page.locator(".viet-to").count()).toBeGreaterThanOrEqual(2);
}

/**
 * Bam Dang trang, doc so to trong cau hoi xac nhan, bam Dang, doi toi man doc. Tra so to vua dang. Lay so
 * tu cau hoi (dung la so se duoc dang) chu khong dem .viet-to, vi bo xep trang co the con dang chay.
 */
export async function dangTrang(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Đăng trang" }).click();
  const hoi = page.getByRole("group", { name: "Xác nhận đăng trang" });
  await expect(hoi).toBeVisible();
  const so = new RegExp("Đăng ([0-9]+) trang").exec(await hoi.innerText());
  if (!so) throw new Error("khong doc duoc so trang trong cau hoi xac nhan");
  await hoi.getByRole("button", { name: "Đăng", exact: true }).click();
  await page.waitForURL(new RegExp("/sach/[0-9a-f-]{36}[?]trang=[0-9]+$"));
  return Number(so[1]);
}

/**
 * Doc mot to da dang trong database e2e kem luot cua no (moc dang, lan sua gan nhat cua luot), hoac null neu vi tri do
 * chua co to. Chi doc de so truoc va sau. Cung rao voi nhapCua.
 */
export async function toDaDang(
  bookId: string,
  position: number,
): Promise<{ content: unknown; roundId: string; editedAt: Date | null; publishedAt: Date } | null> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1 });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    if (ten !== "mqce_e2e") throw new Error("toDaDang chi chay tren database mqce_e2e");
    const rows = await sql<{ content: unknown; round_id: string; edited_at: Date | null; published_at: Date }[]>`
      select p.content, p.round_id, r.edited_at, r.published_at
      from pages p join rounds r on r.id = p.round_id
      where p.book_id = ${bookId} and p.position = ${position}`;
    return rows.length > 0
      ? { content: rows[0].content, roundId: rows[0].round_id, editedAt: rows[0].edited_at, publishedAt: rows[0].published_at }
      : null;
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    // oxlint-disable-next-line eslint/preserve-caught-error -- co y KHONG gan cause: loi goc cua driver postgres co the chua chuoi ket noi (mat khau); rao ngay tren ham nay cam in no ra.
    throw new Error(`toDaDang hong: ${code ?? "?"} ${message ?? ""}`);
  } finally {
    await sql.end();
  }
}

/**
 * Doi con tro trong state cua ProseMirror (khong phai vung chon DOM) toi cuoi tai lieu cua editor dang co focus.
 * Ctrl+End chi doi vung chon DOM; ProseMirror doc lai khi selectionchange toi, con Enter di qua keymap va tach doan
 * o con tro trong state. Bam Enter truoc luc do thi doan bi tach o cho vua bam chuot. Tiptap gan editor vao
 * phan tu .ProseMirror, nen doc thang state o do.
 */
export async function choConTroCuoi(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector(".ProseMirror-focused") as (Element & { editor?: { state: { selection: { head: number }; doc: { content: { size: number } } } } }) | null;
        const state = el?.editor?.state;
        return state ? state.doc.content.size - 1 - state.selection.head : null;
      }),
      { message: "con tro trong state ProseMirror o cuoi doan cuoi" },
    )
    .toBe(0);
}

/** Dua con tro cua editor dang co focus ve cuoi tai lieu, doi state ProseMirror theo kip roi moi tra ve. */
export async function veCuoiTaiLieu(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+End");
  await choConTroCuoi(page);
}
