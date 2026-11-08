import { describe, expect, it } from "vitest";
import { CHU_DONG_NGHI_MS, CHU_DONG_TIMEOUT_MS, loiDanChuDong, XAC_SUAT_CHU_DONG } from "@/lib/chip";
import type { FeedItem } from "@/lib/feed/types";
import {
  chonSuKien, coTheNoi, hetNghi, laTrangBatChuyen, moTaSuKien,
} from "@/server/chip/chu-dong";

/*
 * Engine chu dong cua Chip (ham thuan): chon su kien de bat chuyen, mo ta su kien, loi dan chu dong, cong xac
 * suat/cooldown. Khong can DB: moi quyet dinh chi tu dong Hoat dong + moc + duong dan da truyen vao.
 */

const NOW = new Date("2026-10-01T02:00:00.000Z"); // 09:00 gio Viet Nam
const PHUT_TRUOC = (phut: number) => new Date(NOW.getTime() - phut * 60_000);

function dong(over: Partial<FeedItem>): FeedItem {
  return {
    id: "a1", kind: "tha-tam-trang", by: "me", at: PHUT_TRUOC(5),
    bookId: null, bookTitle: null, firstPosition: null, lastPosition: null, sealKind: null,
    note: null, count: 1, isNew: false, detail: null, weather: "mua-phun",
    biaMoi: false, nhacMoi: false, ordinal: null, tenLuot: null, ...over,
  };
}

const OPT = { chuDongLuc: null as Date | null, chuDongMa: null as string | null, khoangLang: false, duongDan: "/ke-sach", tenMinh: "Mạnh", tenKia: "Linh", now: NOW };

describe("chonSuKien", () => {
  it("chon viec moi nhat cua minh trong cac loai trigger", () => {
    const items = [
      dong({ id: "tam", kind: "tha-tam-trang", at: PHUT_TRUOC(20) }),
      dong({ id: "sach", kind: "tao-sach", bookId: "s1", bookTitle: "Sổ Tay", at: PHUT_TRUOC(5) }),
    ];
    const sk = chonSuKien(items, OPT);
    expect(sk?.kieu).toBe("tao-sach");
    expect(sk?.ma).toBe("sach");
    expect(sk?.href).toBe("/sach/s1");
    expect(sk?.moTa).toContain("Sổ Tay");
  });

  it("bo qua loai khong phai trigger va viec truoc moc", () => {
    const items = [
      dong({ id: "nhac", kind: "doi-nhac", bookId: "s1", bookTitle: "Sổ Tay", at: PHUT_TRUOC(5) }),
      dong({ id: "cu", kind: "tao-sach", bookId: "s1", bookTitle: "Sổ Cũ", at: new Date(NOW.getTime() - 7 * 3600_000) }),
    ];
    expect(chonSuKien(items, OPT)).toBeNull();
  });

  it("viec moi nhat da tung bat chuyen thi thoi, khong dao viec cu hon", () => {
    const items = [
      dong({ id: "moi", kind: "tha-tam-trang", at: PHUT_TRUOC(5) }),
      dong({ id: "cu", kind: "tao-sach", bookId: "s1", bookTitle: "Sổ Tay", at: PHUT_TRUOC(20) }),
    ];
    expect(chonSuKien(items, { ...OPT, chuDongMa: "moi" })).toBeNull();
  });

  it("Khoang Lang bat: khong bat chuyen ve viec cua doi phuong; tat: co", () => {
    const items = [dong({ id: "kia", kind: "tha-tam-trang", by: "partner", isNew: true, weather: "nang-am", at: PHUT_TRUOC(5) })];
    expect(chonSuKien(items, { ...OPT, khoangLang: true })).toBeNull();
    const sk = chonSuKien(items, OPT);
    expect(sk?.kieu).toBe("viec-doi-phuong");
    expect(sk?.ma).toBe("kia");
    expect(sk?.moTa).toContain("Linh");
  });

  it("viec doi phuong ngoai danh sach T8 (doi mat khau) thi khong bat chuyen", () => {
    const items = [dong({ id: "mk", kind: "doi-mat-khau", by: "partner", isNew: true, at: PHUT_TRUOC(5) })];
    expect(chonSuKien(items, OPT)).toBeNull();
  });

  it("mo trang tao sach / trang viet / trang tam trang thi bat chuyen; ke sach thi khong", () => {
    expect(chonSuKien([], { ...OPT, duongDan: "/sach/moi" })?.kieu).toBe("mo-trang");
    expect(chonSuKien([], { ...OPT, duongDan: "/sach/abc/viet" })?.kieu).toBe("mo-trang");
    expect(chonSuKien([], { ...OPT, duongDan: "/tam-trang" })?.kieu).toBe("mo-trang");
    expect(chonSuKien([], { ...OPT, duongDan: "/ke-sach" })).toBeNull();
    expect(chonSuKien([], { ...OPT, duongDan: "/sach/abc" })).toBeNull();
  });

  it("cung trang cung ngay da bat chuyen thi thoi; sang ngay moi thi lai duoc", () => {
    const sk = chonSuKien([], { ...OPT, duongDan: "/sach/moi" });
    expect(sk).not.toBeNull();
    expect(chonSuKien([], { ...OPT, duongDan: "/sach/moi", chuDongMa: sk?.ma ?? null })).toBeNull();
    expect(chonSuKien([], { ...OPT, duongDan: "/sach/moi", chuDongMa: sk?.ma ?? null, now: new Date(NOW.getTime() + 24 * 3600_000) })).not.toBeNull();
  });

  it("uu tien: viec cua minh truoc, roi mo trang, roi viec doi phuong", () => {
    const kia = [dong({ id: "kia", kind: "tha-tam-trang", by: "partner", isNew: true, weather: "nang-am", at: PHUT_TRUOC(5) })];
    expect(chonSuKien(kia, { ...OPT, duongDan: "/sach/moi" })?.kieu).toBe("mo-trang");
    const minh = [dong({ id: "tam", kind: "tha-tam-trang", at: PHUT_TRUOC(5) })];
    expect(chonSuKien(minh, { ...OPT, duongDan: "/sach/moi" })?.kieu).toBe("tha-tam-trang");
  });
});

describe("moTaSuKien", () => {
  it("tam trang kem loi nhan: co ten troi va loi nhan, doi Ban thanh ten minh", () => {
    const m = moTaSuKien(dong({ note: "mưa cả tuần rồi" }), "Mạnh", "Linh");
    expect(m).toContain("Mạnh");
    expect(m).toContain("Mưa phùn");
    expect(m).toContain("mưa cả tuần rồi");
    expect(m).not.toContain("Bạn");
  });
});

describe("laTrangBatChuyen", () => {
  it("chi nhan ba dang duong dan T1", () => {
    expect(laTrangBatChuyen("/sach/moi")).toBe(true);
    expect(laTrangBatChuyen("/tam-trang")).toBe(true);
    expect(laTrangBatChuyen("/sach/abc-123/viet")).toBe(true);
    expect(laTrangBatChuyen("/sach/moi/")).toBe(false);
    expect(laTrangBatChuyen("/ke-sach")).toBe(false);
    expect(laTrangBatChuyen("")).toBe(false);
  });
});

describe("loiDanChuDong", () => {
  it("ke thua luat loiDanChip va them dong su kien + chi dan hoi tu nhien", () => {
    const loi = loiDanChuDong("Mạnh vừa thả tâm trạng Mưa phùn", "Mạnh", "Linh", "Kệ sách chưa có cuốn nào.");
    expect(loi).toContain("Tính cách: hiền, ấm áp");
    expect(loi).toContain("Sự kiện vừa xảy ra: Mạnh vừa thả tâm trạng Mưa phùn.");
    expect(loi).toContain("đừng kể lại sự việc như đọc tin");
    expect(loi).toContain("tối đa khoảng 60 từ");
  });

  it("Khoang Lang bat: loi dan khong nhac ten doi phuong", () => {
    const loi = loiDanChuDong("Mạnh vừa thả tâm trạng Mưa phùn", "Mạnh", "Linh", "Kệ sách chưa có cuốn nào.", true);
    expect(loi).not.toContain("Linh");
    expect(loi).not.toContain("hai người");
  });
});

describe("cong xac suat va cooldown", () => {
  it("xac suat 60%: 0.59 noi, 0.6 tro len im", () => {
    expect(coTheNoi(() => 0.59)).toBe(true);
    expect(coTheNoi(() => 0.6)).toBe(false);
    expect(coTheNoi(() => 0.99)).toBe(false);
  });

  it("het nghi: chua tung noi thi het; 29 phut thi chua, 30 phut thi het", () => {
    expect(hetNghi(null, NOW)).toBe(true);
    expect(hetNghi(PHUT_TRUOC(29), NOW)).toBe(false);
    expect(hetNghi(PHUT_TRUOC(30), NOW)).toBe(true);
    expect(hetNghi(PHUT_TRUOC(31), NOW)).toBe(true);
  });

  it("hang so dung nhu de xuat", () => {
    expect(XAC_SUAT_CHU_DONG).toBe(0.6);
    expect(CHU_DONG_NGHI_MS).toBe(30 * 60_000);
    expect(CHU_DONG_TIMEOUT_MS).toBe(8000);
  });
});
