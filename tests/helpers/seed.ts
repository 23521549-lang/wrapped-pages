import { makeTestDb } from "./db";
import { accounts } from "@/server/db/schema";

/**
 * Database trong voi du hai cho ngoi, ghi thang vao bang (khong qua createSeat) cho nhanh:
 * test kho sach khong can mat khau that.
 */
export async function seedHai() {
  const db = await makeTestDb();
  await db.insert(accounts).values([
    { seat: 1, nickname: "Linh", passwordHash: "h1", secretCipher: "c1", createdByDevice: "may-manh" },
    { seat: 2, nickname: "Manh", passwordHash: "h2", secretCipher: "c2", createdByDevice: "may-linh" },
  ]);
  const rows = await db.select().from(accounts);
  const seat1 = rows.find((r) => r.seat === 1)!;
  const seat2 = rows.find((r) => r.seat === 2)!;
  return { db, seat1, seat2 };
}
