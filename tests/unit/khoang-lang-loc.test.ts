import { describe, expect, it } from "vitest";
import {
  locTheoTacGia, locTheoActor, locTheoTaiKhoan, locTheoTuId, tenAnDanh,
} from "@/server/khoang-lang/loc";

/*
 * Helper loc tap trung (task 2): MOT diem duy nhat quyet dinh noi dung doi phuong co hien khong.
 * Web chi co hai cho ngoi, nen "khong phai cua doi phuong" = "cua chinh nguoi xem" (theo id, khong theo ten).
 */

const MINH = "11111111-1111-4111-8111-111111111111";
const KIA = "22222222-2222-4222-8222-222222222222";

describe("locTheoTacGia", () => {
  const dong = [
    { tacGiaId: MINH, noiDung: "cua minh" },
    { tacGiaId: KIA, noiDung: "cua doi phuong" },
    { tacGiaId: MINH, noiDung: "cua minh 2" },
  ];

  it("tat co thi giu nguyen tat ca, dung thu tu", () => {
    expect(locTheoTacGia(dong, MINH, false)).toEqual(dong);
  });

  it("bat co thi het dong cua doi phuong, du dong cua minh", () => {
    expect(locTheoTacGia(dong, MINH, true)).toEqual([dong[0], dong[2]]);
  });

  it("mang rong thi rong; chi co dong doi phuong thi rong khi bat", () => {
    expect(locTheoTacGia([], MINH, true)).toEqual([]);
    expect(locTheoTacGia([{ tacGiaId: KIA, noiDung: "x" }], MINH, true)).toEqual([]);
    expect(locTheoTacGia([{ tacGiaId: KIA, noiDung: "x" }], MINH, false)).toHaveLength(1);
  });

  it("khong sua mang goc", () => {
    const truoc = [...dong];
    locTheoTacGia(dong, MINH, true);
    expect(dong).toEqual(truoc);
  });
});

describe("cac bien the theo truong tac gia", () => {
  it("locTheoActor loc theo actorId", () => {
    const dong = [{ actorId: MINH }, { actorId: KIA }];
    expect(locTheoActor(dong, MINH, true)).toEqual([dong[0]]);
    expect(locTheoActor(dong, MINH, false)).toEqual(dong);
  });

  it("locTheoTaiKhoan loc theo accountId", () => {
    const dong = [{ accountId: MINH }, { accountId: KIA }];
    expect(locTheoTaiKhoan(dong, MINH, true)).toEqual([dong[0]]);
    expect(locTheoTaiKhoan(dong, MINH, false)).toEqual(dong);
  });

  it("locTheoTuId loc theo tuId (de nghi, cam xuc)", () => {
    const dong = [{ tuId: MINH }, { tuId: KIA }];
    expect(locTheoTuId(dong, MINH, true)).toEqual([dong[0]]);
    expect(locTheoTuId(dong, MINH, false)).toEqual(dong);
  });
});

describe("tenAnDanh", () => {
  it("tat co thi tra dung ten doi phuong", () => {
    expect(tenAnDanh(false, "Linh")).toBe("Linh");
  });

  it("bat co thi tra chuoi rong (Q2 §0b: khong hien ten; khong dung 'nguoi kia')", () => {
    expect(tenAnDanh(true, "Linh")).toBe("");
  });
});
