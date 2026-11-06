import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { camXuc } from "@/server/db/schema";
import { camXucChoToi, daXemCamXuc, thaCamXuc } from "@/server/cam-xuc/cam-xuc";
import { seedHai } from "../helpers/seed";

/*
 * Khoang Lang tren kho cam xuc (task 7): tat co thi Chip dien cam xuc doi phuong; bat co thi hang cho rong, va cam xuc
 * chua xem KHONG bi danh da xem oan (tat co di van con de dien).
 * Nguoi xem la seat2 (Manh), doi phuong la seat1 (Linh).
 */
const NOW = new Date("2026-10-01T02:00:00.000Z");

describe("Khoang Lang: kho cam xuc", () => {
  it("tat co (kiem soat duong): hang cho co cam xuc doi phuong; danh da xem ghi nhan", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await thaCamXuc(db, seat1.id, "yeu", NOW)).toBe("sent");
    const hang = await camXucChoToi(db, seat2.id, NOW);
    expect(hang).toHaveLength(1);
    expect(hang[0].loai).toBe("yeu");
    expect(await daXemCamXuc(db, seat2.id, hang[0].id, NOW)).toBe(true);
    const [dong] = await db.select().from(camXuc).where(eq(camXuc.tuId, seat1.id));
    expect(dong.daXemLuc).not.toBeNull();
  });

  it("bat co: hang cho rong; danh da xem tra false va KHONG ghi mo_luc xem", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await thaCamXuc(db, seat1.id, "yeu", NOW)).toBe("sent");
    expect(await camXucChoToi(db, seat2.id, NOW, true)).toEqual([]);
    const [truoc] = await db.select().from(camXuc).where(eq(camXuc.tuId, seat1.id));
    expect(await daXemCamXuc(db, seat2.id, truoc.id, NOW, true)).toBe(false);
    const [sau] = await db.select().from(camXuc).where(eq(camXuc.tuId, seat1.id));
    expect(sau.daXemLuc).toBeNull();
  });

  // Task 13 (noi dung cua minh con nguyen): Khoang Lang chi loc HIEN THI cua nguoi bat co; viec cua minh gui di van
  // toi doi phuong nhu cu (khi doi phuong khong bat co).
  it("con nguyen: minh van tha duoc cam xuc khi bat co, doi phuong (tat co) van thay", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await thaCamXuc(db, seat2.id, "nho", NOW)).toBe("sent");
    const hang = await camXucChoToi(db, seat1.id, NOW);
    expect(hang).toHaveLength(1);
    expect(hang[0].loai).toBe("nho");
    expect(await daXemCamXuc(db, seat1.id, hang[0].id, NOW)).toBe(true);
  });
});
