import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { books, pages, readSheets } from "@/server/db/schema";
import type { DocJson } from "@/lib/doc/types";
import { viPham } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { taoLuot } from "../helpers/round";

const DOC: DocJson = { type: "doc", content: [{ type: "paragraph" }] };

describe("bang to da xem", () => {
  it("moi nguoi moi cuon moi to chi mot dong; vi tri phai tu 1", async () => {
    const s = await haiCuon();
    const dong = { accountId: s.seat2.id, bookId: s.chung, position: 1 };
    await s.db.insert(readSheets).values(dong);
    await viPham(s.db.insert(readSheets).values(dong), "read_sheets_account_id_book_id_position_pk");
    await viPham(s.db.insert(readSheets).values({ ...dong, position: 0 }), "read_sheets_position");
    await s.db.insert(readSheets).values({ ...dong, position: 2 });
    expect(await s.db.select().from(readSheets)).toHaveLength(2);
  });

  it("xoa cuon thi mat luon cac dong da xem cua cuon do", async () => {
    const s = await haiCuon();
    const roundId = await taoLuot(s.db, s.chung);
    await s.db.insert(pages).values({ bookId: s.chung, roundId, position: 1, content: DOC });
    await s.db.insert(readSheets).values({ accountId: s.seat2.id, bookId: s.chung, position: 1 });
    await s.db.delete(books).where(eq(books.id, s.chung));
    expect(await s.db.select().from(readSheets)).toHaveLength(0);
  });
});
