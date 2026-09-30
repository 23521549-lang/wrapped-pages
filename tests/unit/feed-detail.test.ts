import { describe, expect, it } from "vitest";
import { docChiTietBia, docChiTietCamXuc, docChiTietDaDoc, docChiTietNhac, docChiTietTen, docChiTietThu, giongNhau } from "@/lib/feed/detail";

const ANH = "33333333-3333-4333-8333-333333333333";

/*
 * Cot detail cua bang activity la jsonb, database chi bat no la mot object. Hinh dang cua tung loai do cac ham doc nay
 * kiem: dung hinh thi tra dung kieu, sai hinh (du lieu la, ban cu) thi tra null de dong Hoat dong bo nhan chu khong vo.
 */
describe("doc chi tiet su kien", () => {
  it("doi-ten-sach: hai ten khong rong", () => {
    expect(docChiTietTen({ truoc: "Cũ", sau: "Mới" })).toEqual({ truoc: "Cũ", sau: "Mới" });
    expect(docChiTietTen({ truoc: "Cũ" })).toBeNull();
    expect(docChiTietTen({ truoc: "", sau: "Mới" })).toBeNull();
    expect(docChiTietTen("Mới")).toBeNull();
    expect(docChiTietTen(null)).toBeNull();
  });

  it("doi-bia: moi ben la tranh (kem ma anh khi la anh tu tai len) hoac null la giu bia truoc", () => {
    const v = { truoc: null, sau: { cover: "hoa-dao", anhId: ANH } };
    expect(docChiTietBia(v)).toEqual(v);
    expect(docChiTietBia({ truoc: { cover: "nui-xa", anhId: null }, sau: null })).toEqual({ truoc: { cover: "nui-xa", anhId: null }, sau: null });
    expect(docChiTietBia({ truoc: null, sau: { cover: "khong-co", anhId: null } })).toBeNull();
    expect(docChiTietBia({ truoc: null, sau: { cover: "hoa-dao" } })).toBeNull();
    expect(docChiTietBia({ truoc: null, sau: { cover: "hoa-dao", anhId: "khong-phai-uuid" } })).toBeNull();
    expect(docChiTietBia({ sau: null })).toBeNull();
  });

  it("doi-nhac: moi ben la ma video, tat nhac (youtubeId null) hay null la phat tiep", () => {
    expect(docChiTietNhac({ truoc: null, sau: { youtubeId: "dQw4w9WgXcQ" } })).toEqual({ truoc: null, sau: { youtubeId: "dQw4w9WgXcQ" } });
    expect(docChiTietNhac({ truoc: { youtubeId: null }, sau: null })).toEqual({ truoc: { youtubeId: null }, sau: null });
    expect(docChiTietNhac({ truoc: null, sau: { youtubeId: "ngan" } })).toBeNull();
    expect(docChiTietNhac({ truoc: null })).toBeNull();
  });

  it("da-doc: trang so nguyen tu 1", () => {
    expect(docChiTietDaDoc({ den: 6 })).toEqual({ den: 6 });
    expect(docChiTietDaDoc({ den: 0 })).toBeNull();
    expect(docChiTietDaDoc({ den: 2.5 })).toBeNull();
    expect(docChiTietDaDoc({ den: "6" })).toBeNull();
  });

  it("gui-thu: thang YYYY-MM dung dang", () => {
    expect(docChiTietThu({ thang: "2026-09" })).toEqual({ thang: "2026-09" });
    for (const hong of [{ thang: "2026-13" }, { thang: "2026-9" }, { thang: 202609 }, {}, null, "2026-09"]) expect(docChiTietThu(hong)).toBeNull();
  });

  it("tha cam xuc: chi mot trong tam loai", () => {
    expect(docChiTietCamXuc({ cam: "biet-on" })).toEqual({ cam: "biet-on" });
    for (const hong of [{ cam: "ghet" }, { cam: "Yeu" }, { cam: 1 }, {}, null, "yeu"]) expect(docChiTietCamXuc(hong)).toBeNull();
  });

  it("giongNhau so sanh hai gia tri truoc va sau theo noi dung", () => {
    expect(giongNhau(null, null)).toBe(true);
    expect(giongNhau({ cover: "nui-xa", anhId: null }, { cover: "nui-xa", anhId: null })).toBe(true);
    expect(giongNhau({ cover: "nui-xa", anhId: ANH }, { cover: "nui-xa", anhId: ANH })).toBe(true);
    expect(giongNhau({ cover: "nui-xa", anhId: ANH }, { cover: "nui-xa", anhId: "44444444-4444-4444-8444-444444444444" })).toBe(false);
    expect(giongNhau({ cover: "nui-xa", anhId: null }, { cover: "nui-xa", anhId: ANH })).toBe(false);
    expect(giongNhau({ youtubeId: null }, null)).toBe(false);
    expect(giongNhau("Cũ", "Cũ")).toBe(true);
    expect(giongNhau("Cũ", "Mới")).toBe(false);
  });
});
