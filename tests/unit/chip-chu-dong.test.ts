import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { CHU_DONG_NGHI_MS, CHU_DONG_TIMEOUT_MS, loiDanChuDong, XAC_SUAT_CHU_DONG } from "@/lib/chip";
import type { FeedItem } from "@/lib/feed/types";
import { chipNghi, chipTin, chipTrangThai } from "@/server/db/schema";
import { goiGroq, type MoiTruongGoi } from "@/server/chip/groq";
import { setMood } from "@/server/mood/moods";
import { datCaiDatChip } from "@/server/chip/tro-chuyen";
import {
  chonSuKien, chuDongChip, coTheNoi, hetNghi, laTrangBatChuyen, moTaSuKien,
} from "@/server/chip/chu-dong";
import { seedHai } from "../helpers/seed";

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

type Goi = { url: string; body: { model: string; messages: { role: string; content: string }[] } };

/** fetch gia: moi lan goi tra lan luot cac phan hoi cho truoc; ghi lai request. */
function fetchGia(...phanHoi: (() => Response)[]): { mt: MoiTruongGoi; goi: Goi[] } {
  const goi: Goi[] = [];
  let i = 0;
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    goi.push({ url: String(url), body: JSON.parse(String(init?.body)) as Goi["body"] });
    const f = phanHoi[Math.min(i, phanHoi.length - 1)];
    i += 1;
    return f();
  }) as unknown as typeof globalThis.fetch;
  return { mt: { khoa: "khoa-gia", goc: "https://groq.gia/openai/v1", fetch }, goi };
}
const traLoi = (chu: string) => () => new Response(JSON.stringify({ choices: [{ message: { content: chu } }] }), { status: 200 });
const het = (giay: number | null) => () => new Response("{}", { status: 429, headers: giay === null ? {} : { "retry-after": String(giay) } });

describe("chuDongChip (may chu)", () => {
  // Timeout rieng 60 giay cho test dau tien: no ganh chi phi khoi tao PGlite + chay toan bo migration (them 0023)
  // mot lan duy nhat cho ca file; duoi tai may cao chi phi nay tung do toi 31 giay, vuot 15 giay mac dinh.
  // Cac test sau chi TRUNCATE nen chay nhanh (<2 giay); day la timeout setup, khong phai assertion.
  it("truc tiep sau tha tam trang: tra loi, luu tin chip, cap nhat moc + ma", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", "Nhớ cậu một chút thôi.", NOW);
    const { mt, goi } = fetchGia(traLoi("Trời mưa thế, cậu có lạnh không?"));
    const loi = await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.1);
    expect(loi?.cau).toBe("Trời mưa thế, cậu có lạnh không?");
    expect(loi?.nut).toEqual({ nhan: "Xem ngay", href: "/tam-trang" });
    expect(goi[0].body.messages[0].content).toContain("Mưa phùn");
    expect(goi[0].body.messages[0].content).toContain("Nhớ cậu một chút thôi.");
    const tin = await s.db.select().from(chipTin).where(eq(chipTin.accountId, s.seat2.id));
    expect(tin).toHaveLength(1);
    expect(tin[0].vai).toBe("chip");
    const [hang] = await s.db.select().from(chipTrangThai).where(eq(chipTrangThai.accountId, s.seat2.id));
    expect(hang.chuDongLuc?.getTime()).toBe(NOW.getTime());
    expect(hang.chuDongMa).not.toBeNull();
  }, 60_000);

  it("429 ca hai mo hinh: im lang, khong ghi ngu, khong luu tin, khong doi moc", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt } = fetchGia(het(null), het(null));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.1)).toBeNull();
    expect(await s.db.select().from(chipNghi)).toHaveLength(0);
    expect(await s.db.select().from(chipTin)).toHaveLength(0);
    const [hang] = await s.db.select().from(chipTrangThai).where(eq(chipTrangThai.accountId, s.seat2.id));
    expect(hang?.chuDongMa ?? null).toBeNull();
  });

  it("Khoang Lang bat: prompt khong chua ten doi phuong; viec doi phuong khong kich hoat", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt, goi } = fetchGia(traLoi("Mưa rồi nè."));
    const loi = await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, true, () => 0.1);
    expect(loi).not.toBeNull();
    expect(goi[0].body.messages[0].content).not.toContain("Linh");

    const s2 = await seedHai();
    await setMood(s2.db, s2.seat1.id, "nang-am", null, NOW);
    const { mt: mt2 } = fetchGia(traLoi("Nắng đẹp quá."));
    expect(await chuDongChip(s2.db, s2.seat2.id, "Mạnh", "Linh", { kieu: "quet", duongDan: "/ke-sach" }, NOW, mt2, true, () => 0.1)).toBeNull();
  });

  it("tuNoi tat thi im; dang ngu thi im", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    await datCaiDatChip(s.db, s.seat2.id, { tuNoi: false });
    const { mt } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.1)).toBeNull();

    const s2 = await seedHai();
    await setMood(s2.db, s2.seat2.id, "mua-phun", null, NOW);
    await s2.db.insert(chipNghi).values({ khoa: "groq", den: new Date(NOW.getTime() + 3600_000) });
    const { mt: mt2 } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s2.db, s2.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt2, false, () => 0.1)).toBeNull();
  });

  it("cooldown 30 phut chan lan hai; qua 30 phut cung viec thi dedup chan", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.1)).not.toBeNull();
    const sau60s = new Date(NOW.getTime() + 60_000);
    await setMood(s.db, s.seat2.id, "giong", null, sau60s);
    const { mt: mt2 } = fetchGia(traLoi("Giông rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, sau60s, mt2, false, () => 0.1)).toBeNull();
    const sau31p = new Date(NOW.getTime() + 31 * 60_000);
    const { mt: mt3, goi } = fetchGia(traLoi("Giông rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, sau31p, mt3, false, () => 0.1)).not.toBeNull();
    expect(goi[0].body.messages[0].content).toContain("Giông");
  });

  it("qua 30 phut cung viec thi dedup chan (ma da noi roi)", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.1)).not.toBeNull();
    const sau31p = new Date(NOW.getTime() + 31 * 60_000);
    const { mt: mt2 } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, sau31p, mt2, false, () => 0.1)).toBeNull();
  });

  it("xac suat khong trung: im, khong luu tin, khong doi moc", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "truc-tiep", kind: "tha-tam-trang" }, NOW, mt, false, () => 0.99)).toBeNull();
    expect(await s.db.select().from(chipTin)).toHaveLength(0);
    const [hang] = await s.db.select().from(chipTrangThai).where(eq(chipTrangThai.accountId, s.seat2.id));
    expect(hang?.chuDongMa ?? null).toBeNull();
  });

  it("quet luc mo trang: thay viec moi cua minh; mo trang tao sach thi mo ta dung trang", async () => {
    const s = await seedHai();
    await setMood(s.db, s.seat2.id, "mua-phun", null, NOW);
    const { mt, goi } = fetchGia(traLoi("Mưa rồi nè."));
    expect(await chuDongChip(s.db, s.seat2.id, "Mạnh", "Linh", { kieu: "quet", duongDan: "/ke-sach" }, NOW, mt, false, () => 0.1)).not.toBeNull();
    expect(goi[0].body.messages[0].content).toContain("Mưa phùn");

    const s2 = await seedHai();
    const { mt: mt2, goi: goi2 } = fetchGia(traLoi("Viết gì đó hay hay nha."));
    expect(await chuDongChip(s2.db, s2.seat2.id, "Mạnh", "Linh", { kieu: "quet", duongDan: "/sach/moi" }, NOW, mt2, false, () => 0.1)).not.toBeNull();
    expect(goi2[0].body.messages[0].content).toContain("đang mở trang tạo sách mới");
  });

  it("goiGroq timeout tuy chon: fetch treo thi tra loi nhanh", async () => {
    const fetchTreo = vi.fn(((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })) as unknown as typeof globalThis.fetch);
    const mt: MoiTruongGoi = { khoa: "khoa-gia", goc: "https://groq.gia/openai/v1", fetch: fetchTreo };
    const batDau = Date.now();
    expect(await goiGroq([{ role: "user", content: "chào" }], mt, 50)).toEqual({ kieu: "loi" });
    expect(Date.now() - batDau).toBeLessThan(5000);
    expect(fetchTreo).toHaveBeenCalledTimes(1);
  });
});
