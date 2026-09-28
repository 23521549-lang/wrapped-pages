import { describe, expect, it } from "vitest";
import { giong, hopLeChiThem, soSanh, tachTu, vanBanKhoi } from "@/lib/doc/chi-them";
import type { DocJson } from "@/lib/doc/types";

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";

const doan = (...chu: string[]) => ({ type: "paragraph" as const, content: chu.map((text) => ({ type: "text" as const, text })) });
const anh = (id: string) => ({ type: "anh" as const, attrs: { id, w: 800, h: 600 } });
const tl = (...content: DocJson["content"]): DocJson => ({ type: "doc", content });

const GOC = tl(
  doan("Sáng nay trời mưa từ sớm. Em ngồi bên cửa sỏ, nghe tiêng mưa rơi trên mái tôn."),
  doan("Anh nhớ không, hôm đó mình đi bộ dưới hàng thông."),
);
const sua = (tu: string, thanh: string): DocJson => JSON.parse(JSON.stringify(GOC).replace(tu, thanh)) as DocJson;

describe("chu cua tai lieu", () => {
  it("moi doan mot khoi theo thu tu, ke ca doan trong danh sach va trich dan; xuong dong thanh \\n", () => {
    const doc = tl(
      doan("Một"),
      { type: "bulletList", content: [{ type: "listItem", content: [doan("Hai")] }] },
      { type: "blockquote", content: [doan("Ba")] },
      anh(ID),
      { type: "paragraph", content: [{ type: "text", text: "Bốn" }, { type: "hardBreak" }, { type: "text", text: "năm" }] },
      { type: "paragraph" },
    );
    expect(vanBanKhoi(doc)).toEqual(["Một", "Hai", "Ba", "Bốn\nnăm", ""]);
  });

  it("tach chu bang chu cai va chu so, bo dau cau, giu vi tri trong khoi", () => {
    expect(tachTu(["Em ngồi, 12 giờ!", "đi"])).toEqual([
      { chu: "Em", khoi: 0, dau: 0, cuoi: 2 },
      { chu: "ngồi", khoi: 0, dau: 3, cuoi: 7 },
      { chu: "12", khoi: 0, dau: 9, cuoi: 11 },
      { chu: "giờ", khoi: 0, dau: 12, cuoi: 15 },
      { chu: "đi", khoi: 1, dau: 0, cuoi: 2 },
    ]);
  });
});

describe("hai chu giong nhau", () => {
  it("y het la 2", () => {
    expect(giong("người", "người")).toBe(2);
  });
  it("chi khac dau thanh, dau mu, chu d hay hoa thuong la sua chinh ta", () => {
    expect(giong("sỏ", "sổ")).toBe(1);
    expect(giong("nguoi", "người")).toBe(1);
    expect(giong("duoc", "được")).toBe(1);
    expect(giong("Hôm", "hôm")).toBe(1);
  });
  it("chu ngan lech mot ky tu, chu dai lech hai ky tu van la sua chinh ta", () => {
    expect(giong("tiêng", "tiếng")).toBe(1);
    expect(giong("và", "là")).toBe(1);
    expect(giong("thươgn", "thương")).toBe(1);
    expect(giong("khôngg", "không")).toBe(1);
  });
  it("lech nhieu hon la chu khac", () => {
    expect(giong("anh", "em")).toBe(0);
    expect(giong("mưa", "nắng")).toBe(0);
    expect(giong("ngồi", "đứng")).toBe(0);
    expect(giong("yêu", "ghét")).toBe(0);
  });
});

describe("chi viet them va sua chinh ta", () => {
  it("y het, hay chi viet them o cuoi, o giua, them doan moi: hop le", () => {
    expect(hopLeChiThem(GOC, GOC)).toBe(true);
    expect(hopLeChiThem(GOC, tl(...GOC.content, doan("Quán bánh căn cuối dốc vẫn còn mở.")))).toBe(true);
    expect(hopLeChiThem(GOC, sua("từ sớm.", "từ sớm tinh mơ, lạnh lắm."))).toBe(true);
  });

  it("sua chinh ta va sua dau cau: hop le", () => {
    expect(hopLeChiThem(GOC, sua("cửa sỏ", "cửa sổ"))).toBe(true);
    expect(hopLeChiThem(GOC, sua("tiêng mưa", "tiếng mưa"))).toBe(true);
    expect(hopLeChiThem(GOC, sua("Anh nhớ không,", "Anh nhớ không?"))).toBe(true);
  });

  it("tach mot doan lam hai, hay gop hai doan lam mot: hop le", () => {
    const tach = tl(doan("Sáng nay trời mưa từ sớm."), doan("Em ngồi bên cửa sỏ, nghe tiêng mưa rơi trên mái tôn."), GOC.content[1]);
    expect(hopLeChiThem(GOC, tach)).toBe(true);
    const gop = tl(doan("Sáng nay trời mưa từ sớm. Em ngồi bên cửa sỏ, nghe tiêng mưa rơi trên mái tôn. Anh nhớ không, hôm đó mình đi bộ dưới hàng thông."));
    expect(hopLeChiThem(GOC, gop)).toBe(true);
  });

  it("xoa mot chu, xoa ca doan, doi hai chu cho nhau, doi han sang chu khac: khong hop le", () => {
    expect(hopLeChiThem(GOC, sua("mái tôn", "tôn"))).toBe(false);
    expect(hopLeChiThem(GOC, tl(GOC.content[0]))).toBe(false);
    expect(hopLeChiThem(GOC, sua("trời mưa", "mưa trời"))).toBe(false);
    expect(hopLeChiThem(GOC, sua("Anh nhớ", "Em nhớ"))).toBe(false);
  });

  it("anh cu phai con; anh moi them duoc", () => {
    const coAnh = tl(GOC.content[0], anh(ID), GOC.content[1]);
    expect(hopLeChiThem(coAnh, tl(GOC.content[0], GOC.content[1]))).toBe(false);
    expect(hopLeChiThem(coAnh, tl(GOC.content[0], anh(ID), anh(ID_2), GOC.content[1]))).toBe(true);
    expect(hopLeChiThem(GOC, tl(GOC.content[0], anh(ID_2), GOC.content[1]))).toBe(true);
  });
});

describe("so sanh cho giao dien", () => {
  it("biet chu nao them, chu nao sua, chu cu nao mat", () => {
    const cu = tachTu(vanBanKhoi(GOC));
    const moi = tachTu(vanBanKhoi(sua("bên cửa sỏ, nghe", "bên cửa sổ, lặng nghe").valueOf() as DocJson));
    const moi2 = moi.filter((t) => t.chu !== "tôn");
    const kq = soSanh(cu, moi2);
    expect(kq.mat.map((i) => cu[i].chu)).toEqual(["tôn"]);
    expect(kq.them.map((j) => moi2[j].chu)).toEqual(["lặng"]);
    const sua1 = kq.cap.filter(([, , g]) => g === 1).map(([i, j]) => [cu[i].chu, moi2[j].chu]);
    expect(sua1).toEqual([["sỏ", "sổ"]]);
  });

  it("uu tien chu y het khi co hai cach ghep", () => {
    const cu = tachTu(["và là"]);
    const moi = tachTu(["và là"]);
    expect(soSanh(cu, moi).cap).toEqual([[0, 0, 2], [1, 1, 2]]);
  });

  it("tai lieu dai sua mot chu o giua van nhanh", () => {
    const dai = Array.from({ length: 3000 }, (_, i) => `chu${i}`).join(" ");
    const cu = tachTu([dai]);
    const moi = tachTu([dai.replace("chu1500 ", "chu1500 thêm ")]);
    const t0 = performance.now();
    const kq = soSanh(cu, moi);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(kq.mat).toEqual([]);
    expect(kq.them.map((j) => moi[j].chu)).toEqual(["thêm"]);
  });

  it("sua mot loi o dau va mot loi o cuoi tai lieu dai, xoa mot chu o giua: van nhanh va dung", () => {
    const tu = Array.from({ length: 3000 }, (_, i) => `chu${i}`);
    const cu = tachTu([`đâù ${tu.join(" ")} cuôi`]);
    const moi = tachTu([`đầu ${tu.filter((t) => t !== "chu1700").join(" ")} cuối`]);
    const t0 = performance.now();
    const kq = soSanh(cu, moi);
    expect(performance.now() - t0).toBeLessThan(80);
    expect(kq.mat.map((i) => cu[i].chu)).toEqual(["chu1700"]);
    expect(kq.them).toEqual([]);
    expect(kq.cap.filter(([, , g]) => g === 1).map(([i]) => cu[i].chu)).toEqual(["đâù", "cuôi"]);
  });
});
