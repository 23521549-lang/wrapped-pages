import { describe, expect, it } from "vitest";
import { docChiTietBia, docChiTietDaDoc, docChiTietNhac, docChiTietTen, giongNhau } from "@/lib/feed/detail";

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

  it("doi-bia: moi ben la tranh (co co anh hay khong) hoac null la giu bia truoc", () => {
    const v = { truoc: null, sau: { cover: "hoa-dao", anh: true } };
    expect(docChiTietBia(v)).toEqual(v);
    expect(docChiTietBia({ truoc: { cover: "nui-xa", anh: false }, sau: null })).toEqual({ truoc: { cover: "nui-xa", anh: false }, sau: null });
    expect(docChiTietBia({ truoc: null, sau: { cover: "khong-co", anh: false } })).toBeNull();
    expect(docChiTietBia({ truoc: null, sau: { cover: "hoa-dao" } })).toBeNull();
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

  it("giongNhau so sanh hai gia tri truoc va sau theo noi dung", () => {
    expect(giongNhau(null, null)).toBe(true);
    expect(giongNhau({ cover: "nui-xa", anh: false }, { cover: "nui-xa", anh: false })).toBe(true);
    expect(giongNhau({ cover: "nui-xa", anh: false }, { cover: "nui-xa", anh: true })).toBe(false);
    expect(giongNhau({ youtubeId: null }, null)).toBe(false);
    expect(giongNhau("Cũ", "Cũ")).toBe(true);
    expect(giongNhau("Cũ", "Mới")).toBe(false);
  });
});
