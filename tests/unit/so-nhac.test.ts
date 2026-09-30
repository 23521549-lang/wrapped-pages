import { describe, it, expect } from "vitest";
import { baiDau, baiKeTiep, boTrung } from "@/lib/so-nhac";

/*
 * So nhac thang (5b, spec B): bo trung bai (giu lan dat dau tien) va hang doi nhieu danh sach: phat tuan tu, het danh
 * sach thi sang danh sach ke, vong lai, toi lai danh sach bat dau thi dung.
 */

const luc = (ngay: number) => new Date(Date.UTC(2026, 8, ngay));

describe("boTrung", () => {
  it("xep theo luc dat, cung mot bai chi giu lan dau", () => {
    const ds = [
      { youtubeId: "bbbbbbbbbbb", at: luc(5), nguon: "luot-2" },
      { youtubeId: "aaaaaaaaaaa", at: luc(1), nguon: "tao-sach" },
      { youtubeId: "bbbbbbbbbbb", at: luc(3), nguon: "doi-nhac" },
      { youtubeId: "ccccccccccc", at: luc(9), nguon: "luot-3" },
    ];
    expect(boTrung(ds).map((b) => b.nguon)).toEqual(["tao-sach", "doi-nhac", "luot-3"]);
    expect(boTrung([])).toEqual([]);
  });
});

describe("hang doi nhieu danh sach", () => {
  const DS = [["a1", "a2"], [], ["c1"], ["d1", "d2"]];

  it("baiDau: bai dau cua danh sach; danh sach rong hay khong co thi null", () => {
    expect(baiDau(DS, 0)).toEqual({ ds: 0, bai: 0 });
    expect(baiDau(DS, 1)).toBeNull();
    expect(baiDau(DS, 9)).toBeNull();
  });

  it("phat het danh sach thi sang danh sach ke (bo danh sach rong), vong lai, toi danh sach bat dau thi dung", () => {
    const di = (batDau: number) => {
      const ra: string[] = [];
      for (let vt = baiDau(DS, batDau); vt !== null; vt = baiKeTiep(DS, vt, batDau)) ra.push(DS[vt.ds][vt.bai]);
      return ra;
    };
    expect(di(0)).toEqual(["a1", "a2", "c1", "d1", "d2"]);
    expect(di(2)).toEqual(["c1", "d1", "d2", "a1", "a2"]);
    expect(di(3)).toEqual(["d1", "d2", "a1", "a2", "c1"]);
  });

  it("bam mot bai giua danh sach: phat tu bai do, vong het cac danh sach khac roi dung", () => {
    expect(baiKeTiep(DS, { ds: 3, bai: 1 }, 3)).toEqual({ ds: 0, bai: 0 });
    expect(baiKeTiep(DS, { ds: 2, bai: 0 }, 3)).toBeNull();
    expect(baiKeTiep([["x"]], { ds: 0, bai: 0 }, 0)).toBeNull();
  });
});
