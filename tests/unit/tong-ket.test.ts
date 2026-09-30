import { describe, it, expect } from "vitest";
import { NHOM_TROI, tongKetThang } from "@/lib/tam-trang/tong-ket";
import type { NgayLich } from "@/lib/tam-trang/lich";
import { WEATHERS, type Weather } from "@/lib/tam-trang/troi";

/*
 * Tong ket mot thang tren Lich hoa (5b, spec D): so bong, ba loai hoa nhieu nhat, chuoi ngay tha lien dai nhat, ngay hai
 * nguoi cung mot troi va cau danh gia theo luat. Dau vao la ket qua gomLich (ngay -> hoa cua nguoi kia va cua minh).
 */

type Troi = Record<number, Weather>;
const hoa = (weather: Weather) => ({ weather, gio: "08:00", note: null, xoay: 0 });

/** Dung lich tu hai bang ngay -> troi: cua nguoi kia va cua minh; ngay khong co la khong tha. */
function lich(kia: Troi, minh: Troi): Record<number, NgayLich> {
  const ra: Record<number, NgayLich> = {};
  for (const d of new Set([...Object.keys(kia), ...Object.keys(minh)].map(Number))) {
    ra[d] = { kia: kia[d] ? hoa(kia[d]) : null, minh: minh[d] ? hoa(minh[d]) : null };
  }
  return ra;
}

/** Ngay tu toi den cung mot troi. */
function deu(tu: number, den: number, w: Weather): Troi {
  const ra: Troi = {};
  for (let d = tu; d <= den; d++) ra[d] = w;
  return ra;
}

describe("nhom troi", () => {
  it("nang: nang am, troi trong, cau vong, gio thoang; diu: may nhe, suong mu; mua: mua phun, mua rao, giong", () => {
    expect(WEATHERS.map((w) => NHOM_TROI[w])).toEqual(["nang", "nang", "diu", "nang", "mua", "mua", "mua", "diu", "nang"]);
  });
});

describe("tongKetThang", () => {
  it("so bong, ba hoa nhieu nhat (bang nhau thi theo thu tu troi), chuoi dai nhat (bang nhau lay chuoi som)", () => {
    const kia: Troi = { ...deu(1, 3, "mua-phun"), ...deu(5, 7, "may-nhe"), 9: "troi-trong", 10: "mua-phun" };
    const tk = tongKetThang(lich(kia, {}), "Linh");
    expect(tk.kia.bong).toBe(8);
    expect(tk.kia.hoa).toEqual([{ weather: "mua-phun", ngay: 4 }, { weather: "may-nhe", ngay: 3 }, { weather: "troi-trong", ngay: 1 }]);
    expect(tk.kia.chuoi).toEqual({ dai: 3, tu: 1, den: 3 });
    expect(tk.minh).toMatchObject({ bong: 0, hoa: [], chuoi: null });
    expect(tk.noiBat).toEqual({ kia: "mua-phun", minh: null });
  });

  it("ngay cung mot troi: ca hai tha cung kieu troi; dong phu dem bong, ngay cung troi va ngay cung thay cau vong", () => {
    const kia: Troi = { 3: "troi-trong", 4: "nang-am", 13: "cau-vong", 20: "cau-vong", 21: "mua-rao" };
    const minh: Troi = { 3: "troi-trong", 4: "may-nhe", 13: "cau-vong", 20: "cau-vong", 22: "mua-rao" };
    const tk = tongKetThang(lich(kia, minh), "Linh");
    expect(tk.cungTroi).toEqual([{ ngay: 3, weather: "troi-trong" }, { ngay: 13, weather: "cau-vong" }, { ngay: 20, weather: "cau-vong" }]);
    expect(tk.phu).toBe("10 bông, 3 ngày cùng một trời, cùng thấy cầu vồng ngày 13 và 20");
    expect(tongKetThang(lich({ 1: "giong" }, { 2: "giong" }), "Linh").phu).toBe("2 bông, chưa có ngày nào cùng một trời");
    const vong = deu(1, 3, "cau-vong");
    expect(tongKetThang(lich(vong, vong), "Linh").phu).toBe("6 bông, 3 ngày cùng một trời, cùng thấy cầu vồng ngày 1, 2 và 3");
  });

  it("mo ta theo nhom chiem it nhat 70 phan tram, khong thi theo loai troi nhieu nhat; duoi 5 bong la it tha", () => {
    const mo = (minh: Troi) => tongKetThang(lich({}, minh), "Linh").minh.moTa;
    expect(mo({ ...deu(1, 8, "nang-am"), ...deu(9, 10, "mua-phun") })).toBe("nắng gần cả tháng");
    expect(mo({ ...deu(1, 7, "mua-rao"), ...deu(8, 10, "troi-trong") })).toBe("mưa gần cả tháng");
    expect(mo({ ...deu(1, 7, "suong-mu"), ...deu(8, 10, "troi-trong") })).toBe("mây sương gần cả tháng");
    expect(mo({ ...deu(1, 4, "mua-phun"), ...deu(5, 7, "nang-am"), ...deu(8, 9, "may-nhe") })).toBe("hay mưa phùn");
    expect(mo({ ...deu(1, 4, "giong"), ...deu(5, 7, "nang-am"), ...deu(8, 9, "may-nhe") })).toBe("hay giông");
    expect(mo({ ...deu(1, 4, "may-nhe"), ...deu(5, 7, "nang-am"), ...deu(8, 9, "mua-phun") })).toBe("nhiều mây nhẹ");
    expect(mo({ ...deu(1, 4, "cau-vong"), ...deu(5, 7, "mua-rao"), ...deu(8, 9, "may-nhe") })).toBe("nhiều cầu vồng");
    expect(mo(deu(1, 4, "nang-am"))).toBe("ít thả");
    expect(mo({})).toBe("chưa thả bông nào");
  });

  it("cau danh gia: ban truoc, nguoi kia sau; giong nhau thi gop Ca hai; khong ai tha thi mot cau rieng", () => {
    const nang = deu(1, 10, "nang-am");
    const mua: Troi = { ...deu(1, 4, "mua-phun"), ...deu(5, 7, "nang-am"), ...deu(8, 9, "may-nhe") };
    expect(tongKetThang(lich(mua, nang), "Linh").danhGia).toBe("Bạn nắng gần cả tháng, Linh hay mưa phùn");
    expect(tongKetThang(lich(nang, nang), "Linh").danhGia).toBe("Cả hai nắng gần cả tháng");
    expect(tongKetThang(lich({ 1: "giong" }, { 2: "may-nhe" }), "Linh").danhGia).toBe("Cả hai ít thả");
    expect(tongKetThang(lich({}, nang), "Linh").danhGia).toBe("Bạn nắng gần cả tháng, Linh chưa thả bông nào");
    expect(tongKetThang({}, "Linh").danhGia).toBe("Tháng này chưa ai thả tâm trạng");
  });
});
