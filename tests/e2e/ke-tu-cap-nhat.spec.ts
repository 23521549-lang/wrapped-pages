import { test, expect, type Locator, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DocJson } from "@/lib/doc/types";
import * as schema from "@/server/db/schema";
import { publishDraft } from "@/server/library/drafts";
import { assertE2eDatabase, resetDb } from "./db";
import { e2eUrls } from "./env";
import { dongContextCu, haiNguoiDaVao, taoSach } from "./kho-sach";
import { rethrowSafely } from "./safe-error";

/*
 * Ke tu cap nhat (spec 5a muc G): tab Ke sach dang mo thi cu 15 giay hoi phien ban cua ke; nguoi kia dang trang thi
 * dong moi hien ma khong tai lai trang.
 */

test.beforeEach(async () => {
  await resetDb();
});

test.afterEach(async () => {
  await dongContextCu();
});

const cuon = (p: Page): Locator => p.getByRole("region", { name: "Hoạt động gần đây" });

/** Dang mot to vao cuon bang chinh publishDraft cua may chu: ghi dung mot dong dang-trang nhu khi bam Dang trang. */
async function dangQuaMayChu(bookId: string, chu: string): Promise<void> {
  const sql = postgres(e2eUrls().e2eUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ ten }] = await sql<{ ten: string }[]>`select current_database() as ten`;
    assertE2eDatabase(ten);
    const [{ chuSach }] = await sql<{ chuSach: string }[]>`select owner_id as "chuSach" from books where id = ${bookId}`;
    const to: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: chu }] }] };
    if (!(await publishDraft(drizzle(sql, { schema }), chuSach, bookId, [to]))) throw new Error("dangQuaMayChu tu choi");
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("resetDb tu choi") || e.message.startsWith("dangQuaMayChu tu choi"))) throw e;
    rethrowSafely(e);
  } finally {
    await sql.end();
  }
}

test("tab ke sach de mo: nguoi kia dang trang thi dong moi hien trong khoang 20 giay, khong tai lai", async ({ browser }) => {
  test.setTimeout(240_000);
  const { a, b, tenCuaA } = await haiNguoiDaVao(browser);
  const id = await taoSach(a, "Chuyện chưa kể", "chia-se");

  await b.setViewportSize({ width: 1280, height: 900 });
  await b.goto("/ke-sach");
  await expect(cuon(b).getByRole("link", { name: `${tenCuaA} tạo cuốn Chuyện chưa kể` })).toBeVisible();
  // Dau cua lan tai nay: tai lai trang thi dau mat.
  await b.evaluate(() => {
    document.documentElement.dataset.lanTai = "mot";
  });

  await dangQuaMayChu(id, "Sáng nay trời trong.");
  await expect(cuon(b).getByRole("link", { name: `${tenCuaA} đăng 1 trang mới trong Chuyện chưa kể` })).toBeVisible({ timeout: 20_000 });
  expect(await b.evaluate(() => document.documentElement.dataset.lanTai)).toBe("mot");
  // Khung sach lon cung cap nhat theo: luot vua dang la luot chua doc.
  await expect(b.getByRole("article", { name: "Một trang trong sách" }).locator(".vua-viet__nhan")).toHaveText("Bạn chưa đọc");
});
