import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accounts, books, roundReplies, rounds } from "@/server/db/schema";
import { REPLY_MAX } from "@/lib/round-reply";
import { viPham } from "../helpers/db";
import { haiCuon } from "../helpers/library";
import { luotChu } from "../helpers/round";

/** Hai cho ngoi, cuon chia se cua seat1 co mot luot phu to 1 toi 2. */
async function coLuot() {
  const s = await haiCuon();
  const roundId = await luotChu(s.db, s.chung, 1, 2);
  return { ...s, roundId };
}

/** Mot ky tu ngoai BMP: hai don vi UTF-16, mot code point. */
const HOA = String.fromCodePoint(0x1f338);
const KHONG_CO = "00000000-0000-4000-8000-000000000000";

describe("bang round_replies", () => {
  it("dung bon cot, khong cot sua nao; cot chu duy nhat la body", () => {
    const cols = getTableConfig(roundReplies).columns;
    expect(cols.map((c) => c.name).sort()).toEqual(["account_id", "body", "created_at", "round_id"]);
    expect(cols.filter((c) => c.getSQLType() === "text").map((c) => c.name)).toEqual(["body"]);
  });

  it("body dem theo code point nhu REPLY_MAX: rong hay dai hon thi tu choi, dung REPLY_MAX ky tu ngoai BMP thi nhan", async () => {
    const { db, seat2, roundId } = await coLuot();
    const ghi = (body: string) => db.insert(roundReplies).values({ roundId, accountId: seat2.id, body });
    await viPham(ghi(""), "round_replies_body");
    await viPham(ghi("a".repeat(REPLY_MAX + 1)), "round_replies_body");
    await viPham(ghi(HOA.repeat(REPLY_MAX + 1)), "round_replies_body");
    await ghi(HOA.repeat(REPLY_MAX));
    const [dong] = await db.select().from(roundReplies);
    expect(dong.body).toHaveLength(REPLY_MAX * 2);
    expect(dong.createdAt).toBeInstanceOf(Date);
  });

  it("moi luot nhieu nhat mot loi hoi dap; luot va nguoi gui phai co that", async () => {
    const { db, seat2, chung, roundId } = await coLuot();
    await db.insert(roundReplies).values({ roundId, accountId: seat2.id, body: "Một" });
    await viPham(db.insert(roundReplies).values({ roundId, accountId: seat2.id, body: "Hai" }), "round_replies_pkey");
    await viPham(db.insert(roundReplies).values({ roundId: KHONG_CO, accountId: seat2.id, body: "Ba" }), "round_replies_round_id_rounds_id_fk");
    const luotKhac = await luotChu(db, chung, 3);
    await viPham(db.insert(roundReplies).values({ roundId: luotKhac, accountId: KHONG_CO, body: "Bốn" }), "round_replies_account_id_accounts_id_fk");
  });

  it("xoa luot, xoa sach hay xoa nguoi gui thi loi hoi dap mat theo", async () => {
    const { db, seat1, seat2, chung, roundId } = await coLuot();
    const khac = await luotChu(db, chung, 3);
    const thu = await luotChu(db, chung, 4);
    await db.insert(roundReplies).values([
      { roundId, accountId: seat2.id, body: "Một" },
      { roundId: khac, accountId: seat2.id, body: "Hai" },
      { roundId: thu, accountId: seat1.id, body: "Ba" },
    ]);
    await db.delete(rounds).where(eq(rounds.id, roundId));
    expect((await db.select().from(roundReplies)).map((r) => r.body).sort()).toEqual(["Ba", "Hai"]);
    await db.delete(accounts).where(eq(accounts.id, seat2.id));
    expect((await db.select().from(roundReplies)).map((r) => r.body)).toEqual(["Ba"]);
    await db.delete(books).where(eq(books.id, chung));
    expect(await db.select().from(roundReplies)).toEqual([]);
  });
});
