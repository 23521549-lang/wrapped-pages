import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { thuThang } from "@/server/db/schema";
import { guiThu, moThu, nhacThu, thuCacThang, thuChuaMo } from "@/server/thu/thu";
import { seedHai } from "../helpers/seed";

/*
 * Khoang Lang tren thu thang (task 6, phan loader): tat co thi thu doi phuong doc duoc; bat co thi kia: null, moThu
 * tra null NGAY CA KHI goi truc tiep voi thang co thu (chan o server, khong chi an nut), va khong ghi mo_luc.
 * Nguoi xem la seat2 (Manh), doi phuong la seat1 (Linh).
 */
/** 01.10.2026, 09:00 gio Viet Nam: thang Chin vua khep. */
const NOW = new Date("2026-10-01T02:00:00.000Z");
const SAU = (phut: number) => new Date(NOW.getTime() + phut * 60_000);

async function haiThu() {
  const s = await seedHai();
  await guiThu(s.db, s.seat1.id, "2026-09", "Linh viết tháng Chín", NOW);
  await guiThu(s.db, s.seat2.id, "2026-09", "Mạnh viết tháng Chín", SAU(1));
  return s;
}

describe("Khoang Lang: loader thu thang", () => {
  it("tat co (kiem soat duong): thuCacThang co kia.noiDung; moThu mo duoc; thuChuaMo thay la chua mo; nhacThu thay thang", async () => {
    const { db, seat1, seat2 } = await haiThu();
    const cacThu = await thuCacThang(db, seat2.id);
    expect(cacThu.find((t) => t.thang === "2026-09")).toMatchObject({ minhGui: true, kiaGui: true, kia: { noiDung: "Linh viết tháng Chín" } });
    expect((await thuChuaMo(db, seat2.id))?.thang).toBe("2026-09");
    const mo = await moThu(db, seat2.id, "2026-09", SAU(2));
    expect(mo).toMatchObject({ thang: "2026-09", noiDung: "Linh viết tháng Chín", minhGui: true });
    const [dong] = await db.select().from(thuThang).where(eq(thuThang.accountId, seat1.id));
    expect(dong.moLuc).not.toBeNull();
    expect(seat1).toBeDefined();
  });

  it("tat co (kiem soat duong): nhacThu tra thang vua khep khi minh chua gui, ke ca khi doi phuong da gui", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await guiThu(db, seat1.id, "2026-09", "Linh viết tháng Chín", NOW);
    expect(await nhacThu(db, seat2.id, NOW)).toEqual({ thang: { y: 2026, m: 9 }, tt: { minhGui: false, kiaGui: true } });
  });

  it("bat co: kia null (ke ca kiaGui); moThu tra null va KHONG ghi mo_luc; thuChuaMo null; nhacThu null", async () => {
    const { db, seat1, seat2 } = await haiThu();
    const cacThu = await thuCacThang(db, seat2.id, true);
    expect(cacThu.find((t) => t.thang === "2026-09")).toEqual({ thang: "2026-09", minhGui: true, kiaGui: false, kia: null });
    expect(await thuChuaMo(db, seat2.id, true)).toBeNull();
    expect(await moThu(db, seat2.id, "2026-09", SAU(2), true)).toBeNull();
    const [dong] = await db.select().from(thuThang).where(eq(thuThang.accountId, seat1.id));
    expect(dong.moLuc).toBeNull();
    expect(await nhacThu(db, seat2.id, NOW, true)).toBeNull();
  });
});
