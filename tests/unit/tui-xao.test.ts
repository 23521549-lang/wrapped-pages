import { describe, expect, it } from "vitest";
import { taoTuiXao } from "@/lib/tui-xao";

/*
 * Bia cua khung sach lon duoc rut ngau nhien, nhung rut doc lap thi co luc cung mot bia hien hai lan lien va trong
 * nhu hong. Tui xao: moi vong di het danh sach theo thu tu xao, het tui thi xao lai, va o dau tui moi khac o cuoi
 * tui cu. Ham thuan nen kiem thang o day, khong phai dung ca khung sach len.
 */

/** Bo sinh so gia lap: tra lan luot cac gia tri cho truoc roi lap lai. */
function soGia(...xs: number[]): () => number {
  let i = 0;
  return () => xs[i++ % xs.length];
}

describe("taoTuiXao", () => {
  it("mot vong di het danh sach, khong sot khong trung", () => {
    const rut = taoTuiXao(["a", "b", "c", "d"], soGia(0, 0.5, 0.9, 0.2));
    expect([rut(), rut(), rut(), rut()].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("het tui thi xao lai va di tiep, van khong sot khong trung trong vong moi", () => {
    const rut = taoTuiXao(["a", "b", "c"], soGia(0.1, 0.7, 0.3, 0.9, 0.2));
    const vong1 = [rut(), rut(), rut()];
    const vong2 = [rut(), rut(), rut()];
    expect([...vong1].sort()).toEqual(["a", "b", "c"]);
    expect([...vong2].sort()).toEqual(["a", "b", "c"]);
  });

  it("khong bao gio rut lai dung o vua rut, ke ca luc sang tui moi", () => {
    // Nhieu bo so khac nhau, moi bo rut dai: khong lan nao hai o lien nhau trung nhau.
    for (let hat = 0; hat < 40; hat++) {
      const rut = taoTuiXao(["a", "b", "c", "d"], soGia((hat % 10) / 10, ((hat * 7) % 10) / 10, ((hat * 3) % 10) / 10));
      let truoc = rut();
      for (let i = 0; i < 24; i++) {
        const nay = rut();
        expect(nay, `bo so ${hat}, lan rut ${i}`).not.toBe(truoc);
        truoc = nay;
      }
    }
  });

  it("dung ngay ranh gioi hai vong: bo so duoi day lam tui moi bat dau bang chinh o vua rut, va tui phai tu doi cho", () => {
    // 0.0 va 0.5 xao ["a","b","c"] thanh ["c","b","a"] nen vong mot rut a, b, c (cuoi cung la c).
    // 0.9 va 0.5 xao lai thanh ["a","b","c"], tuc o duoc rut dau cua vong hai lai dung la c. Tui phai doi cho no.
    const rut = taoTuiXao(["a", "b", "c"], soGia(0.0, 0.5, 0.9, 0.5));
    expect([rut(), rut(), rut()]).toEqual(["a", "b", "c"]);
    expect(rut(), "o dau tui moi khong duoc trung o vua rut").not.toBe("c");
  });

  it("danh sach hai phan tu van doi qua doi lai duoc", () => {
    const rut = taoTuiXao(["a", "b"], soGia(0, 0.9));
    const ds = [rut(), rut(), rut(), rut()];
    for (let i = 1; i < ds.length; i++) expect(ds[i]).not.toBe(ds[i - 1]);
  });

  it("danh sach mot phan tu thi luon tra chinh no, khong nem loi", () => {
    const rut = taoTuiXao(["a"]);
    expect([rut(), rut(), rut()]).toEqual(["a", "a", "a"]);
  });

  it("danh sach rong nem loi: noi goi phai tu kiem truoc khi dung", () => {
    expect(() => taoTuiXao([])).toThrow();
  });

  it("khong sua danh sach goc", () => {
    const goc = ["a", "b", "c"];
    const rut = taoTuiXao(goc, soGia(0.4, 0.8));
    rut();
    rut();
    expect(goc).toEqual(["a", "b", "c"]);
  });
});
