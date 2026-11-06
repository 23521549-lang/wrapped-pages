import { describe, expect, it } from "vitest";
import { lichCacThang, moodCalendar, setMood } from "@/server/mood/moods";
import { gomLich } from "@/lib/tam-trang/lich";
import { tongKetThang } from "@/lib/tam-trang/tong-ket";
import { seedHai } from "../helpers/seed";

/*
 * Khoang Lang tren tam trang (task 5, phan loader): tat co thi lich co hang doi phuong (hoa + note + gio); bat co thi
 * khong con hang "kia", tong ket thang khong con phan kia. Nguoi xem la seat2 (Manh), doi phuong la seat1 (Linh).
 */
const T = new Date("2026-09-22T01:00:00.000Z");

async function haiTamTrang() {
  const s = await seedHai();
  await setMood(s.db, s.seat1.id, "mua-phun", "Nhớ cậu một chút thôi.", T);
  await setMood(s.db, s.seat2.id, "nang-am", null, new Date("2026-09-22T02:00:00.000Z"));
  return s;
}

describe("Khoang Lang: loader tam trang", () => {
  it("tat co (kiem soat duong): lich thang co ca hai nguoi, ke ca note cua doi phuong", async () => {
    const { db, seat1, seat2 } = await haiTamTrang();
    const lich = await moodCalendar(db, { y: 2026, m: 9 }, seat2.id);
    expect(lich.map((d) => d.accountId).sort()).toEqual([seat1.id, seat2.id].sort());
    expect(lich.find((d) => d.accountId === seat1.id)?.note).toBe("Nhớ cậu một chút thôi.");
    const cacThang = await lichCacThang(db, new Date("2026-10-05T00:00:00.000Z"), seat2.id);
    expect((cacThang.get("2026-09") ?? []).map((d) => d.accountId).sort()).toEqual([seat1.id, seat2.id].sort());
  });

  it("bat co: lich thang chi con dong cua minh; tong ket khong con phan kia, cau danh gia khong neu ten doi phuong", async () => {
    const { db, seat2 } = await haiTamTrang();
    const lich = await moodCalendar(db, { y: 2026, m: 9 }, seat2.id, true);
    expect(lich.map((d) => d.accountId)).toEqual([seat2.id]);
    expect(lich.some((d) => d.note === "Nhớ cậu một chút thôi.")).toBe(false);
    const cacThang = await lichCacThang(db, new Date("2026-10-05T00:00:00.000Z"), seat2.id, true);
    expect((cacThang.get("2026-09") ?? []).map((d) => d.accountId)).toEqual([seat2.id]);
    const tk = tongKetThang(gomLich(lich, seat2.id), "Linh", true);
    expect(tk.kia.bong).toBe(0);
    expect(tk.minh.bong).toBe(1);
    expect(tk.danhGia).not.toContain("Linh");
  });
});
