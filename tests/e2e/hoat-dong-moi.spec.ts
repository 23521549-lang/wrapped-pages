import { test, expect, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { assertE2eDatabase, resetDb } from "./db";
import { e2eUrls } from "./env";
import { dongContextCu, haiNguoiDaVao, taoSach, tranNgang } from "./kho-sach";
import { rethrowSafely } from "./safe-error";

/*
 * Dau Moi cua khung Hoat dong (spec 5a muc D): viec nguoi kia lam ma minh chua xem mang cham va chu "Mới" duoi gio.
 * Con tro vao dong la da xem, dau tan tai cho; tai lai van mat vi may chu da ghi. Viec cua chinh minh khong bao gio co dau.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const cuon = (p: Page): Locator => p.getByRole("region", { name: "Hoạt động gần đây" });

/** So dong da xem cua mot tai khoan (theo biet danh) trong activity_seen, doc thang database e2e. */
async function soDaXem(nickname: string): Promise<number> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from activity_seen s join accounts a on a.id = s.account_id where a.nickname = ${nickname}`;
    return n;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("resetDb tu choi")) throw e;
    return rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

test("viec moi cua nguoi kia mang dau Moi; con tro vao dong thi dau tan, tai lai van mat; viec cua minh khong co dau", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA, tenCuaB } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Góc nhỏ", "chia-se");
  // Doi ten qua man Sua sach: mot dong doi-ten-sach. Dong tao-sach doc ten hien tai cua cuon.
  await a.goto(`/sach/${id}/sua`);
  await a.getByLabel("Tên sách").fill("Góc nhỏ của mình");
  await a.getByRole("button", { name: "Lưu", exact: true }).click();
  await a.waitForURL(new RegExp(`/sach/${id}$`));

  await b.setViewportSize({ width: 1280, height: 900 });
  await b.goto("/ke-sach");
  const moi = cuon(b).locator("li[data-moi]");
  await expect(moi).toHaveCount(2);
  await expect(cuon(b).getByRole("link", { name: `${tenCuaA} tạo cuốn Góc nhỏ của mình` })).toBeVisible();
  await expect(cuon(b).getByRole("link", { name: `${tenCuaA} đổi tên Góc nhỏ thành Góc nhỏ của mình` })).toBeVisible();
  await expect(moi.first().locator(".hoat-dong__moi")).toHaveText("Mới");
  expect(await tranNgang(b)).toEqual([]);

  await moi.first().hover();
  await expect(moi.first()).toHaveClass(/da-xem/);
  // Hai dong nam trong khung nhin tren man rong nen ca hai deu duoc tinh da xem sau khoang mot giay, roi trinh duyet
  // gom lai gui mot lan. Doi dung dong trong activity_seen thay vi doi gio.
  await expect(cuon(b).locator("li.da-xem")).toHaveCount(2, { timeout: 5_000 });
  await expect.poll(() => soDaXem(tenCuaB), { timeout: 10_000 }).toBe(2);
  await b.reload();
  await expect(cuon(b).locator("li[data-moi]")).toHaveCount(0);
  await expect(cuon(b).getByRole("link", { name: `${tenCuaA} tạo cuốn Góc nhỏ của mình` })).toBeVisible();

  await a.goto("/ke-sach");
  await expect(cuon(a).getByRole("link", { name: "Bạn tạo cuốn Góc nhỏ của mình" })).toBeVisible();
  await expect(cuon(a).locator("li[data-moi]")).toHaveCount(0);
});
