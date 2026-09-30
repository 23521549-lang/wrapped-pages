import { describe, it, expect } from "vitest";
import { choThu, kiemThu, loiNhacThu, nhanThu, THU_TOI_DA, thangDaKhep, thangVuaKhep } from "@/lib/thu";

/*
 * Luat chu cua thu thang (5b): chuan hoa va do dai (dung chung may chu va o viet), thang nao da khep, cho thu cua moi
 * thang chi co mot thu, dong nhac o Ke sach va nhan trang thai thu o dong tom tat thang.
 */

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

describe("kiemThu", () => {
  it("chuan hoa nhu loi hoi dap: CRLF ve LF, bo trong o hai dau, toi da hai dong trong lien", () => {
    expect(kiemThu(`  Gửi em,${CR}${LF}${CR}${LF}${CR}${LF}${CR}${LF}Tháng này anh nắng nhiều.  ${LF}`)).toEqual({
      ok: true, noiDung: `Gửi em,${LF}${LF}${LF}Tháng này anh nắng nhiều.`,
    });
  });

  it("rong, qua dai, khong phai chuoi hay co ky tu Postgres khong luu duoc thi tu choi; dung 1000 ky tu co dau thi nhan", () => {
    expect(THU_TOI_DA).toBe(1000);
    expect(kiemThu(`  ${LF}  `)).toEqual({ ok: false, reason: "empty" });
    expect(kiemThu("ệ".repeat(1001))).toEqual({ ok: false, reason: "too-long" });
    expect(kiemThu("😀".repeat(1000))).toEqual({ ok: true, noiDung: "😀".repeat(1000) });
    expect(kiemThu(42)).toEqual({ ok: false, reason: "invalid" });
    expect(kiemThu(`Thư${String.fromCharCode(0)}`)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("thang da khep", () => {
  /** 01.10.2026, 00:30 gio Viet Nam. */
  const DAU_THANG = new Date("2026-09-30T17:30:00.000Z");

  it("thang da khep la thang truoc thang hien tai theo gio Viet Nam", () => {
    expect(thangVuaKhep(DAU_THANG)).toEqual({ y: 2026, m: 9 });
    expect(thangVuaKhep(new Date("2026-09-30T16:59:59.999Z"))).toEqual({ y: 2026, m: 8 });
    expect(thangVuaKhep(new Date("2027-01-01T00:00:00.000Z"))).toEqual({ y: 2026, m: 12 });
    expect(thangDaKhep({ y: 2026, m: 9 }, DAU_THANG)).toBe(true);
    expect(thangDaKhep({ y: 2025, m: 12 }, DAU_THANG)).toBe(true);
    expect(thangDaKhep({ y: 2026, m: 10 }, DAU_THANG)).toBe(false);
    expect(thangDaKhep({ y: 2026, m: 9 }, new Date("2026-09-30T16:59:59.999Z"))).toBe(false);
  });
});

describe("cho thu, nhac, nhan", () => {
  it("cho thu luon chi mot thu: chua gui thi viet, ke ca khi nguoi kia da gui; da gui thi doc thu nguoi kia hay cho", () => {
    expect(choThu({ minhGui: false, kiaGui: false })).toBe("viet");
    expect(choThu({ minhGui: false, kiaGui: true })).toBe("viet");
    expect(choThu({ minhGui: true, kiaGui: true })).toBe("doc");
    expect(choThu({ minhGui: true, kiaGui: false })).toBe("cho");
  });

  it("dong nhac o Ke sach: chi khi minh chua gui thu thang vua khep", () => {
    const t = { y: 2026, m: 9 };
    expect(loiNhacThu({ minhGui: false, kiaGui: false }, t, "Linh")).toBe("Tháng Chín đã khép, viết thư cho Linh");
    expect(loiNhacThu({ minhGui: false, kiaGui: true }, t, "Linh")).toBe("Linh đã viết thư tháng Chín cho bạn");
    expect(loiNhacThu({ minhGui: true, kiaGui: false }, t, "Linh")).toBeNull();
    expect(loiNhacThu({ minhGui: true, kiaGui: true }, t, "Linh")).toBeNull();
  });

  it("nhan trang thai thu o dong tom tat; nguoi kia viet ma minh chua gui thi mang dau Moi", () => {
    expect(nhanThu({ minhGui: false, kiaGui: false }, "Linh")).toEqual({ chu: "Chưa ai viết thư", moi: false });
    expect(nhanThu({ minhGui: false, kiaGui: true }, "Linh")).toEqual({ chu: "Linh đã viết cho bạn", moi: true });
    expect(nhanThu({ minhGui: true, kiaGui: false }, "Linh")).toEqual({ chu: "Đã gửi, chờ thư Linh", moi: false });
    expect(nhanThu({ minhGui: true, kiaGui: true }, "Linh")).toEqual({ chu: "Đã có thư của Linh", moi: false });
  });
});
