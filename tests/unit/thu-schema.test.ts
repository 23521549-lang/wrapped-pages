import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, thuThang } from "@/server/db/schema";
import { phanThang } from "@/lib/tam-trang/lich";
import { viPham } from "../helpers/db";
import { seedHai } from "../helpers/seed";

/*
 * Bang thu_thang (5b): moi nguoi mot la moi thang, thang dung dang YYYY-MM, noi dung 1 toi 1000 ky tu (tinh theo ky tu, ke
 * ca chu Viet co dau), mo_luc khong som hon gui_luc, xoa tai khoan thi xoa theo.
 */

const GUI = new Date("2026-10-01T15:40:00.000Z");

describe("bang thu_thang", () => {
  it("ghi mot la; la thu hai cung nguoi cung thang bi tu choi; nguoi kia cung thang thi duoc", async () => {
    const s = await seedHai();
    await s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-09", noiDung: "Tháng này anh nắng nhiều.", guiLuc: GUI });
    await viPham(s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-09", noiDung: "Lá thứ hai" }), "thu_thang_moi_thang");
    await s.db.insert(thuThang).values({ accountId: s.seat2.id, thang: "2026-09", noiDung: "Em cũng vậy." });
    expect(await s.db.select().from(thuThang)).toHaveLength(2);
  });

  it.each([["2026-9"], ["2026-13"], ["2026-00"], ["26-09"], ["2026/09"], [""]])("thang sai dang %s bi tu choi", async (thang) => {
    const s = await seedHai();
    await viPham(s.db.insert(thuThang).values({ accountId: s.seat1.id, thang, noiDung: "Thư" }), "thu_thang_thang");
  });

  it("CHECK thu_thang_thang nhan dung nhung thang phanThang nhan", async () => {
    const s = await seedHai();
    for (const thang of ["2026-01", "2026-12", "1999-10", "2026-13", "2026-1", "2026-001", "x2026-09", "2026-09x"]) {
      const ghi = await s.db.insert(thuThang).values({ accountId: s.seat1.id, thang, noiDung: "Thư" }).then(() => true, () => false);
      expect(ghi, thang).toBe(phanThang(thang) !== null);
    }
  });

  it("noi dung rong hay qua 1000 ky tu bi tu choi; dung 1000 ky tu co dau thi duoc", async () => {
    const s = await seedHai();
    await viPham(s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-08", noiDung: "" }), "thu_thang_noi_dung");
    await viPham(s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-08", noiDung: "ệ".repeat(1001) }), "thu_thang_noi_dung");
    await s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-08", noiDung: "ệ".repeat(1000) });
  });

  it("mo_luc som hon gui_luc bi tu choi; xoa tai khoan thi thu mat theo", async () => {
    const s = await seedHai();
    await viPham(s.db.insert(thuThang).values({
      accountId: s.seat1.id, thang: "2026-09", noiDung: "Thư", guiLuc: GUI, moLuc: new Date(GUI.getTime() - 1000),
    }), "thu_thang_mo_luc");
    await s.db.insert(thuThang).values({ accountId: s.seat1.id, thang: "2026-09", noiDung: "Thư", guiLuc: GUI, moLuc: GUI });
    await s.db.delete(accounts).where(eq(accounts.id, s.seat1.id));
    expect(await s.db.select().from(thuThang)).toEqual([]);
  });
});
