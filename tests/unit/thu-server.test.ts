import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { activity, thuThang } from "@/server/db/schema";
import { guiThu, moThu, nhacThu, thuCacThang, thuChuaMo } from "@/server/thu/thu";
import { seedHai } from "../helpers/seed";

/*
 * May chu thu thang (5b, spec E): gui (thang da khep, moi thang mot la, chu hop le, ghi dong Hoat dong cung giao dich),
 * doc cho Lich hoa (khong bao gio tra thu cua chinh minh; thu nguoi kia chi khi minh da gui), la thu chua mo, mo thu va
 * dong nhac o Ke sach.
 */

/** 01.10.2026, 09:00 gio Viet Nam: thang Chin vua khep. */
const NOW = new Date("2026-10-01T02:00:00.000Z");
const SAU = (phut: number) => new Date(NOW.getTime() + phut * 60_000);

describe("guiThu", () => {
  it("gui thu thang da khep: luu chu da chuan hoa, luc gui, ghi gui-thu cung giao dich", async () => {
    const { db, seat1 } = await seedHai();
    expect(await guiThu(db, seat1.id, "2026-09", "  Tháng này anh nắng nhiều.  ", NOW)).toBe("sent");
    expect(await db.select().from(thuThang)).toMatchObject([
      { accountId: seat1.id, thang: "2026-09", noiDung: "Tháng này anh nắng nhiều.", guiLuc: NOW, moLuc: null },
    ]);
    expect(await db.select().from(activity)).toMatchObject([
      { kind: "gui-thu", actorId: seat1.id, detail: { thang: "2026-09" }, shared: true, at: NOW, bookId: null },
    ]);
  });

  it("la thu hai cung thang: exists, khong ghi gi them; nguoi kia cung thang thi van gui duoc", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await guiThu(db, seat1.id, "2026-09", "Lá một", NOW);
    expect(await guiThu(db, seat1.id, "2026-09", "Lá hai", SAU(1))).toBe("exists");
    expect(await guiThu(db, seat2.id, "2026-09", "Em cũng vậy.", SAU(2))).toBe("sent");
    expect((await db.select().from(thuThang)).map((r) => r.noiDung).sort()).toEqual(["Em cũng vậy.", "Lá một"]);
    expect(await db.select().from(activity)).toHaveLength(2);
  });

  it("thang chua khep: open; thang sai dang hay chu hong: invalid; khong ghi gi", async () => {
    const { db, seat1 } = await seedHai();
    expect(await guiThu(db, seat1.id, "2026-10", "Thư", NOW)).toBe("open");
    expect(await guiThu(db, seat1.id, "2026-11", "Thư", NOW)).toBe("open");
    expect(await guiThu(db, seat1.id, "2026-9", "Thư", NOW)).toBe("invalid");
    expect(await guiThu(db, seat1.id, 202609, "Thư", NOW)).toBe("invalid");
    expect(await guiThu(db, seat1.id, "2026-09", "   ", NOW)).toBe("invalid");
    expect(await guiThu(db, seat1.id, "2026-09", "ệ".repeat(1001), NOW)).toBe("invalid");
    expect(await db.select().from(thuThang)).toEqual([]);
    expect(await db.select().from(activity)).toEqual([]);
  });
});

describe("thuCacThang", () => {
  it("khong bao gio tra noi dung thu cua chinh minh; thu nguoi kia chi khi minh da gui thang do", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await guiThu(db, seat1.id, "2026-09", "Linh viết tháng Chín", NOW);
    await guiThu(db, seat2.id, "2026-09", "Mạnh viết tháng Chín", SAU(1));
    await guiThu(db, seat2.id, "2026-08", "Mạnh viết tháng Tám", SAU(2));
    await guiThu(db, seat1.id, "2026-07", "Linh viết tháng Bảy", SAU(3));

    const linh = await thuCacThang(db, seat1.id);
    expect(linh).toEqual([
      { thang: "2026-09", minhGui: true, kiaGui: true, kia: { noiDung: "Mạnh viết tháng Chín", guiLuc: SAU(1), moLuc: null } },
      { thang: "2026-08", minhGui: false, kiaGui: true, kia: null },
      { thang: "2026-07", minhGui: true, kiaGui: false, kia: null },
    ]);
    expect(JSON.stringify(linh)).not.toContain("Linh viết");

    const manh = await thuCacThang(db, seat2.id);
    expect(manh.map((t) => [t.thang, t.minhGui, t.kiaGui, t.kia?.noiDung ?? null])).toEqual([
      ["2026-09", true, true, "Linh viết tháng Chín"],
      ["2026-08", true, false, null],
      ["2026-07", false, true, null],
    ]);
    expect(JSON.stringify(manh)).not.toContain("Mạnh viết");
  });
});

describe("thu chua mo, mo thu", () => {
  it("thuChuaMo: la cu nhat nguoi kia gui minh ma chua mo; thu cua minh khong tinh", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await thuChuaMo(db, seat1.id)).toBeNull();
    await guiThu(db, seat1.id, "2026-09", "Của Linh", NOW);
    expect(await thuChuaMo(db, seat1.id)).toBeNull();
    await guiThu(db, seat2.id, "2026-09", "Của Mạnh, tháng Chín", SAU(1));
    await guiThu(db, seat2.id, "2026-08", "Của Mạnh, tháng Tám", SAU(2));
    expect(await thuChuaMo(db, seat1.id)).toMatchObject({ thang: "2026-08" });
    expect(await thuChuaMo(db, seat2.id)).toMatchObject({ thang: "2026-09" });
  });

  it("moThu: tra thu nguoi kia kem minh da gui chua, ghi mo_luc mot lan; thu cua minh hay thang khong co thi null", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await guiThu(db, seat2.id, "2026-09", "Của Mạnh", NOW);
    expect(await moThu(db, seat2.id, "2026-09", SAU(5))).toBeNull();
    expect(await moThu(db, seat1.id, "2026-08", SAU(5))).toBeNull();
    expect(await moThu(db, seat1.id, "khong-phai-thang", SAU(5))).toBeNull();
    expect(await moThu(db, seat1.id, "2026-09", SAU(5))).toEqual({ thang: "2026-09", noiDung: "Của Mạnh", guiLuc: NOW, minhGui: false });
    await guiThu(db, seat1.id, "2026-09", "Của Linh", SAU(6));
    expect(await moThu(db, seat1.id, "2026-09", SAU(9))).toMatchObject({ minhGui: true });
    const [mo] = await db.select({ moLuc: thuThang.moLuc }).from(thuThang).where(eq(thuThang.accountId, seat2.id));
    expect(mo.moLuc).toEqual(SAU(5));
    expect(await thuChuaMo(db, seat1.id)).toBeNull();
  });

  it("dong ho lui ve truoc luc gui: mo_luc khong som hon gui_luc", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await guiThu(db, seat2.id, "2026-09", "Của Mạnh", NOW);
    await moThu(db, seat1.id, "2026-09", SAU(-30));
    const [mo] = await db.select({ moLuc: thuThang.moLuc }).from(thuThang);
    expect(mo.moLuc).toEqual(NOW);
  });
});

describe("nhacThu", () => {
  it("nhac thang vua khep toi khi chinh minh gui, kem nguoi kia da gui chua", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await nhacThu(db, seat1.id, NOW)).toEqual({ thang: { y: 2026, m: 9 }, tt: { minhGui: false, kiaGui: false } });
    await guiThu(db, seat2.id, "2026-09", "Của Mạnh", NOW);
    expect(await nhacThu(db, seat1.id, NOW)).toEqual({ thang: { y: 2026, m: 9 }, tt: { minhGui: false, kiaGui: true } });
    expect(await nhacThu(db, seat2.id, NOW)).toBeNull();
    await guiThu(db, seat1.id, "2026-09", "Của Linh", NOW);
    expect(await nhacThu(db, seat1.id, NOW)).toBeNull();
    // Sang thang moi: nhac thang Muoi, thu thang Chin khong con lien quan.
    expect(await nhacThu(db, seat1.id, new Date("2026-11-01T02:00:00.000Z"))).toEqual({
      thang: { y: 2026, m: 10 }, tt: { minhGui: false, kiaGui: false },
    });
  });
});
