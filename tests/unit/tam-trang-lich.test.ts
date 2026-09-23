import { describe, it, expect } from "vitest";
import {
  chiaTamTrang, conLai, docThang, gomLich, khoangThang, laThangNay, luoiThang, MOOD_TTL_MS, ngayTrongThang, soNgayCua,
  tenNgay, thaLabel, thangCua, thangKhoa, thangSau, thangTruoc, troiHien, xoayHoa, type DongLich,
} from "@/lib/tam-trang/lich";

/** 22.09.2026, 22:00 gio Viet Nam. */
const NOW = new Date("2026-09-22T15:00:00.000Z");

describe("thang theo gio Viet Nam", () => {
  it("24 gio dung bang mili giay", () => {
    expect(MOOD_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("thang va ngay doi dung luc 00:00 gio Viet Nam, khong theo UTC", () => {
    expect(thangCua(new Date("2026-09-30T16:59:59.999Z"))).toEqual({ y: 2026, m: 9 });
    expect(thangCua(new Date("2026-09-30T17:00:00.000Z"))).toEqual({ y: 2026, m: 10 });
    expect(ngayTrongThang(new Date("2026-09-21T16:59:59.999Z"))).toBe(21);
    expect(ngayTrongThang(new Date("2026-09-21T17:00:00.000Z"))).toBe(22);
  });

  it("thang truoc, thang sau qua nam; khoa hai chu so", () => {
    expect(thangTruoc({ y: 2026, m: 1 })).toEqual({ y: 2025, m: 12 });
    expect(thangSau({ y: 2026, m: 12 })).toEqual({ y: 2027, m: 1 });
    expect(thangKhoa({ y: 2026, m: 9 })).toBe("2026-09");
    expect(laThangNay({ y: 2026, m: 9 }, NOW)).toBe(true);
    expect(laThangNay({ y: 2026, m: 8 }, NOW)).toBe(false);
  });

  it("docThang: dung dang YYYY-MM trong qua khu thi nhan, con lai ve thang hien tai", () => {
    expect(docThang("2026-08", NOW)).toEqual({ y: 2026, m: 8 });
    expect(docThang("2025-12", NOW)).toEqual({ y: 2025, m: 12 });
    expect(docThang("2026-09", NOW)).toEqual({ y: 2026, m: 9 });
    for (const q of ["2026-10", "2027-01", "2026-13", "2026-00", "2026-9", "1999-12", "abc", "", 202608, null, undefined, ["2026-08"]]) {
      expect(docThang(q, NOW), String(q)).toEqual({ y: 2026, m: 9 });
    }
  });

  it("khoang cua thang bat dau va ket thuc luc 00:00 gio Viet Nam", () => {
    expect(khoangThang({ y: 2026, m: 9 })).toEqual({ from: new Date("2026-08-31T17:00:00.000Z"), to: new Date("2026-09-30T17:00:00.000Z") });
    expect(khoangThang({ y: 2026, m: 12 })).toEqual({ from: new Date("2026-11-30T17:00:00.000Z"), to: new Date("2026-12-31T17:00:00.000Z") });
    expect(soNgayCua({ y: 2026, m: 2 })).toBe(28);
    expect(soNgayCua({ y: 2028, m: 2 })).toBe(29);
  });
});

describe("luoi thang bat dau tu thu Hai", () => {
  it("thang 9.2026 (mung 1 la thu Ba), hom nay 22: nam tuan, ngay sau hom nay la tuong lai, tuan cuoi xa", () => {
    const tuan = luoiThang({ y: 2026, m: 9 }, 22);
    expect(tuan).toHaveLength(5);
    expect(tuan.every((t) => t.o.length === 7)).toBe(true);
    expect(tuan[0].o[0]).toEqual({ key: "trong-0", ngay: null, tuongLai: false, homNay: false });
    expect(tuan[0].o[1]).toEqual({ key: "ngay-1", ngay: 1, tuongLai: false, homNay: false });
    expect(tuan[3].o[1]).toEqual({ key: "ngay-22", ngay: 22, tuongLai: false, homNay: true });
    expect(tuan[3].o[2]).toEqual({ key: "ngay-23", ngay: 23, tuongLai: true, homNay: false });
    expect(tuan.map((t) => t.xa)).toEqual([false, false, false, false, true]);
    expect(tuan[4].o.map((o) => o.ngay)).toEqual([28, 29, 30, null, null, null, null]);
    expect(new Set(tuan.map((t) => t.key)).size).toBe(5);
    expect(new Set(tuan.flatMap((t) => t.o.map((o) => o.key))).size).toBe(35);
  });

  it("thang cu: khong ngay nao tuong lai hay hom nay; thang 8.2026 (mung 1 la thu Bay) can sau tuan", () => {
    const tuan = luoiThang({ y: 2026, m: 8 }, null);
    expect(tuan).toHaveLength(6);
    expect(tuan[0].o.slice(0, 5).map((o) => o.ngay)).toEqual([null, null, null, null, null]);
    expect(tuan[0].o[5].ngay).toBe(1);
    expect(tuan.flatMap((t) => t.o).filter((o) => o.tuongLai || o.homNay)).toEqual([]);
    expect(tuan.some((t) => t.xa)).toBe(false);
  });

  it("thang 2.2027 bat dau dung thu Hai: bon tuan tron, khong o trong", () => {
    const tuan = luoiThang({ y: 2027, m: 2 }, null);
    expect(tuan).toHaveLength(4);
    expect(tuan.flatMap((t) => t.o).every((o) => o.ngay !== null)).toBe(true);
  });

  it("ten ngay cho khung chi tiet", () => {
    expect(tenNgay({ y: 2026, m: 9 }, 22, NOW)).toBe("Thứ Ba, 22.09");
    expect(tenNgay({ y: 2026, m: 9 }, 27, NOW)).toBe("Chủ Nhật, 27.09");
    expect(tenNgay({ y: 2025, m: 12 }, 31, NOW)).toBe("Thứ Tư, 31.12.2025");
  });
});

describe("nhan thoi gian cua tam trang", () => {
  const phut = (n: number) => new Date(NOW.getTime() + n * 60_000);

  it("con lai: tu 60 phut thi dem gio lam tron xuong, duoi 60 phut thi dem phut, it nhat 1 phut", () => {
    expect(conLai(phut(24 * 60), NOW)).toBe("còn 24 giờ");
    expect(conLai(phut(17 * 60 + 59), NOW)).toBe("còn 17 giờ");
    expect(conLai(phut(60), NOW)).toBe("còn 1 giờ");
    expect(conLai(phut(59), NOW)).toBe("còn 59 phút");
    expect(conLai(new Date(NOW.getTime() + 10_000), NOW)).toBe("còn 1 phút");
  });

  it("luc tha: cung ngay thi chi gio, tu hom qua thi them hom qua", () => {
    expect(thaLabel(new Date("2026-09-22T14:40:00.000Z"), NOW)).toBe("Thả lúc 21:40");
    expect(thaLabel(new Date("2026-09-21T16:30:00.000Z"), new Date("2026-09-22T01:00:00.000Z"))).toBe("Thả lúc 23:30 hôm qua");
  });

  it("goc xoay hoa: tat dinh, so nguyen trong -11 toi 11, khong phai hang so", () => {
    const goc = Array.from({ length: 200 }, (_, i) => xoayHoa(`id-${i}`));
    expect(goc.every((g) => Number.isInteger(g) && g >= -11 && g <= 11)).toBe(true);
    expect(new Set(goc).size).toBeGreaterThan(10);
    expect(xoayHoa("abc")).toBe(xoayHoa("abc"));
    // Gia tri ghim: "abc" va "m1" chay qua FNV-1a 32 bit (hat giong 2166136261, nhan 16777619) roi lay du cho 23 va lui
    // 11. Khang dinh tu tham chieu o tren van dung ke ca khi ai do doi hang so FNV - luc do moi bong hoa lich su se xoay
    // khac di ma bo kiem van xanh. Hai so nay chi doi khi cong thuc doi, va do la mot thay doi phai duoc nhin thay.
    expect(xoayHoa("abc")).toBe(-7);
    expect(xoayHoa("m1")).toBe(-1);
  });
});

describe("gom lich va chia tam trang", () => {
  const MINH = "tai-khoan-minh";
  const KIA = "tai-khoan-kia";
  const dong = (sua: Partial<DongLich>): DongLich => ({
    id: "m1", accountId: MINH, weather: "nang-am", note: null, setAt: new Date("2026-09-22T01:15:00.000Z"), ngay: "2026-09-22", ...sua,
  });

  it("moi ngay hai o: cua nguoi kia, cua minh; gio theo gio Viet Nam; ngay khong ai tha thi khong co khoa", () => {
    const lich = gomLich([
      dong({}),
      dong({ id: "m2", accountId: KIA, weather: "mua-phun", note: "Nhớ cậu.", setAt: new Date("2026-09-22T14:40:00.000Z") }),
      dong({ id: "m3", accountId: KIA, weather: "giong", setAt: new Date("2026-08-31T17:30:00.000Z"), ngay: "2026-09-01" }),
    ], MINH);
    expect(lich[22]).toEqual({
      minh: { weather: "nang-am", gio: "08:15", note: null, xoay: xoayHoa("m1") },
      kia: { weather: "mua-phun", gio: "21:40", note: "Nhớ cậu.", xoay: xoayHoa("m2") },
    });
    expect(lich[1]).toEqual({ minh: null, kia: { weather: "giong", gio: "00:30", note: null, xoay: xoayHoa("m3") } });
    expect(lich[2]).toBeUndefined();
  });

  it("chia tam trang hien tai thanh cua minh va cua nguoi kia", () => {
    const a = { accountId: MINH, weather: "nang-am" };
    const b = { accountId: KIA, weather: "giong" };
    expect(chiaTamTrang([a, b], MINH)).toEqual({ minh: a, kia: b });
    expect(chiaTamTrang([b], MINH)).toEqual({ minh: null, kia: b });
    expect(chiaTamTrang([], MINH)).toEqual({ minh: null, kia: null });
  });
});

describe("troiHien", () => {
  it("tinh san nhan luc tha va gio ngan theo gio Viet Nam", () => {
    expect(troiHien({ weather: "giong", note: null, setAt: new Date("2026-09-22T14:40:00.000Z") }, NOW))
      .toEqual({ weather: "giong", note: null, tha: "Thả lúc 21:40", gio: "21:40" });
    expect(troiHien({ weather: "mua-rao", note: "Mai gặp.", setAt: new Date("2026-09-21T16:30:00.000Z") }, new Date("2026-09-22T01:00:00.000Z")))
      .toEqual({ weather: "mua-rao", note: "Mai gặp.", tha: "Thả lúc 23:30 hôm qua", gio: "23:30" });
  });
});
