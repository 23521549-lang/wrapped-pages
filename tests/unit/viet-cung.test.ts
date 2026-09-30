import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chuCaiDau, LOAI_DE_NGHI, parseTenLuot, TEN_LUOT_TOI_DA, tenHienLuot } from "@/lib/viet-cung";
import { docChiTietNhanViet, docChiTietTenLuot, docChiTietTuChoi } from "@/lib/feed/detail";

/* Ham thuan cua sach viet cung (5c): ten luot, ten hien, chu cai dau, ba ham doc detail moi. */

describe("parseTenLuot", () => {
  it("gom khoang trang nhu ten sach", () => {
    expect(parseTenLuot("  Mưa   phùn\n đầu ngõ  ")).toBe("Mưa phùn đầu ngõ");
  });

  it("rong, khong phai chuoi hay dai qua thi null; dem theo ky tu, khong theo don vi UTF-16", () => {
    expect(parseTenLuot("   ")).toBeNull();
    expect(parseTenLuot(undefined)).toBeNull();
    expect(parseTenLuot(42)).toBeNull();
    expect(parseTenLuot("ệ".repeat(TEN_LUOT_TOI_DA))).toBe("ệ".repeat(60));
    expect(parseTenLuot("ệ".repeat(TEN_LUOT_TOI_DA + 1))).toBeNull();
    expect(parseTenLuot("🌧".repeat(60))).toBe("🌧".repeat(60));
    expect(parseTenLuot("a\u0000b")).toBeNull();
  });

  it("TEN_LUOT_TOI_DA khop CHECK rounds_ten cua migration", () => {
    expect(readFileSync("drizzle/0018_hai-ngoi-but.sql", "utf8")).toContain(`char_length("rounds"."ten") between 1 and ${TEN_LUOT_TOI_DA}`);
  });

  it("LOAI_DE_NGHI khop CHECK de_nghi_loai, cung thu tu", () => {
    const sql = readFileSync("drizzle/0018_hai-ngoi-but.sql", "utf8");
    expect(sql).toContain(`"de_nghi"."loai" in (${LOAI_DE_NGHI.map((l) => `'${l}'`).join(", ")})`);
  });
});

describe("tenHienLuot, chuCaiDau", () => {
  it("luot khong ten hien Lượt N", () => {
    expect(tenHienLuot(null, 3)).toBe("Lượt 3");
    expect(tenHienLuot("Phở cuốn ngày mưa", 3)).toBe("Phở cuốn ngày mưa");
  });

  it("chu cai dau viet hoa, giu dau tieng Viet", () => {
    expect(chuCaiDau("Linh")).toBe("L");
    expect(chuCaiDau("  đạt")).toBe("Đ");
    expect(chuCaiDau("ánh")).toBe("Á");
    expect(chuCaiDau("")).toBe("");
  });
});

describe("docChiTiet cua 5c", () => {
  it("nhan-viet", () => {
    expect(docChiTietNhanViet({ tu: "moi-viet" })).toEqual({ tu: "moi-viet" });
    expect(docChiTietNhanViet({ tu: "xin-viet" })).toEqual({ tu: "xin-viet" });
    expect(docChiTietNhanViet({ tu: "xoa-sach" })).toBeNull();
    expect(docChiTietNhanViet(null)).toBeNull();
  });

  it("tu-choi", () => {
    for (const viec of LOAI_DE_NGHI) expect(docChiTietTuChoi({ viec })).toEqual({ viec });
    expect(docChiTietTuChoi({ viec: "khac" })).toBeNull();
    expect(docChiTietTuChoi([])).toBeNull();
  });

  it("doi-ten-luot: truoc null hay chuoi, sau la chuoi khong rong", () => {
    expect(docChiTietTenLuot({ truoc: null, sau: "Mưa" })).toEqual({ truoc: null, sau: "Mưa" });
    expect(docChiTietTenLuot({ truoc: "Cũ", sau: "Mới" })).toEqual({ truoc: "Cũ", sau: "Mới" });
    expect(docChiTietTenLuot({ truoc: "", sau: "Mới" })).toBeNull();
    expect(docChiTietTenLuot({ sau: "Mới" })).toBeNull();
    expect(docChiTietTenLuot({ truoc: null, sau: "" })).toBeNull();
  });
});
