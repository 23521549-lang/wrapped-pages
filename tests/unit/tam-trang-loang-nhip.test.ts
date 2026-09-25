import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bezier, CHU_MS, CHU_TRE_MS, CU_MS, CUA_MS, DON_MS, DV_MS, hatTu, JIT_HE, KHUNG_NGOAI, KHUNG_TRONG, khuonO, lanF,
  LOANG_HET_MS, LOANG_MS, LOI, luoiGiot, MAT_DO, MAU, NEN_MS, NEN_TRE_MS, NHIEU_MS, O_HE, O_SAN, R0_HE, rng, RV_HE,
  S0, tien,
} from "@/lib/tam-trang/loang-nhip";
import { boComment, THU_MUC_CSS } from "../helpers/bang-token";

/** Doc so ti le tu mot chuoi "scale(0.30000)". */
const tyLe = (t: unknown) => Number(/scale\(([0-9.]+)\)/.exec(String(t))?.[1] ?? "0");

describe("bezier", () => {
  it("duong cheo tra lai chinh no, va hai dau dung bang 0 va 1", () => {
    const f = bezier(0.25, 0.25, 0.75, 0.75);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(0.5)).toBeCloseTo(0.5, 4);
    expect(f(0.2)).toBeCloseTo(0.2, 4);
  });

  it("don dieu tang", () => {
    let truoc = -1;
    for (let i = 0; i <= 100; i++) {
      const y = lanF(i / 100);
      expect(y).toBeGreaterThanOrEqual(truoc);
      truoc = y;
    }
  });

  it("ngoai khoang 0..1 bi kep lai", () => {
    expect(lanF(-3)).toBe(0);
    expect(lanF(9)).toBe(1);
  });
});

describe("hai day khung hinh", () => {
  it("day ngoai: dung MAU moc, no tu S0 toi 1, mo vao het o mot phan tu dau", () => {
    expect(KHUNG_NGOAI).toHaveLength(MAU);
    expect(KHUNG_NGOAI[0].offset).toBe(0);
    expect(KHUNG_NGOAI[MAU - 1].offset).toBe(1);
    expect(tyLe(KHUNG_NGOAI[0].transform)).toBeCloseTo(S0, 5);
    expect(tyLe(KHUNG_NGOAI[MAU - 1].transform)).toBeCloseTo(1, 5);
    expect(Number(KHUNG_NGOAI[0].opacity)).toBe(0);
    expect(Number(KHUNG_NGOAI[MAU - 1].opacity)).toBe(1);
    expect(KHUNG_NGOAI.every((k) => k.easing === "linear")).toBe(true);
  });

  it("day trong bu nguoc dung 1/s tai tung moc, nen nen troi moi khong bi keo gian", () => {
    expect(KHUNG_TRONG).toHaveLength(MAU);
    for (let i = 0; i < MAU; i++) {
      expect(tyLe(KHUNG_NGOAI[i].transform) * tyLe(KHUNG_TRONG[i].transform)).toBeCloseTo(1, 4);
    }
  });

  it("noi thang giua hai mau: sai so ti le lon nhat duoi 0,6 phan tram", () => {
    let xau = 0;
    for (let i = 0; i < MAU - 1; i++) {
      const s = (tyLe(KHUNG_NGOAI[i].transform) + tyLe(KHUNG_NGOAI[i + 1].transform)) / 2;
      const t = (tyLe(KHUNG_TRONG[i].transform) + tyLe(KHUNG_TRONG[i + 1].transform)) / 2;
      xau = Math.max(xau, Math.abs(s * t - 1));
    }
    expect(xau).toBeLessThan(0.006);
  });
});

describe("nhip", () => {
  it("nhip 2,9 giay, don o 140ms sau, va cac moc con lai suy tu no", () => {
    expect(LOANG_MS).toBe(2900);
    expect(LOANG_HET_MS).toBe(3040);
    expect(DV_MS).toBe(Math.round(2900 * 0.46));
    expect(CUA_MS).toBe(2900 - DV_MS);
    expect(CHU_MS).toBe(Math.round(2900 * 0.24));
    expect(CU_MS).toBe(Math.round(2900 * 0.2));
    expect(DON_MS).toBe(140);
    expect(CHU_TRE_MS).toBe(Math.round(Math.round(2900 * 0.46) * 0.3));
    expect(NEN_MS).toBe(Math.round(2900 * 0.34));
    expect(NEN_TRE_MS).toBe(Math.round(2900 * 0.44));
    expect(NHIEU_MS).toBe(110);
  });

  /*
   * Cac he so hinh hoc phai duoc neo bang con so THAT cua ban mau da duyet, khong duoc neo vao chinh chung: mot bai
   * kiem viet `toBeCloseTo(S0)` roi doc S0 tu chinh mo dun thi doi S0 thanh 0,5 bai van xanh (da thu that: ca tep
   * van 14/14 xanh). Task 7 toi Task 9 chi doc lai may hang so nay chu khong do lai, nen day la cho duy nhat giu
   * chung dung voi ban mau.
   */
  it("cac he so hinh hoc dung bang con so cua ban mau da duyet", () => {
    expect(MAT_DO).toBe(128);
    expect(RV_HE).toBe(1.32);
    expect(S0).toBe(0.3);
    expect(MAU).toBe(40);
    expect(JIT_HE).toBe(0.15);
    expect(R0_HE).toBe(0.42);
    expect(O_HE).toBe(2.6);
  });

  /*
   * Loi dac 82 phan tram khong phai mot con so dep ngau nhien: no la cach viet lai be rong mep mem ma spec muc 3.3
   * doi - khoang 30px o dai lon, dung bang be rong chuyen tiep cua feGaussianBlur stdDeviation 11 o ban duyet vong
   * mot. Kiem ca ba dau: con so tho, he qua hinh hoc cua no, va con so viet trong mat na tinh cua `.giot` o
   * tam-trang.css. Doc thang tep CSS that chu khong chep tay mot chuoi: hang so va CSS song o hai noi, doi mot ben ma
   * quen ben kia la mep vet nuoc khong con dung be rong da duyet, va khong cong nao khac bat duoc dieu do.
   */
  it("loi dac cua mat na la 82 phan tram, cho mep mem khoang 30px, va dung bang con so trong tam-trang.css", () => {
    expect(LOI).toBe(0.82);
    expect((1 - LOI) * MAT_DO * RV_HE).toBeCloseTo(30.4, 1);

    const css = boComment(readFileSync(`${THU_MUC_CSS}/tam-trang.css`, "utf8"));
    const khoi = /\.giot\{([^}]*)\}/.exec(css);
    const nan = [...(khoi?.[1] ?? "").matchAll(/radial-gradient\(closest-side circle, black 0 ([\d.]+)%, transparent 100%\)/g)];
    // Hai lan: -webkit-mask-image cho Safari, va mask-image chuan.
    expect(nan.map((m) => m[1])).toEqual([(LOI * 100).toFixed(0), (LOI * 100).toFixed(0)]);
  });
});

describe("rng va hatTu", () => {
  it("cung mot hat thi ra cung mot day", () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("hai kieu troi khac nhau cho hai hat khac nhau", () => {
    expect(hatTu("mua-phun", 128)).not.toBe(hatTu("nang-am", 128));
    expect(hatTu("mua-rao", 128)).not.toBe(hatTu("mua-phun", 128));
  });
});

describe("tien", () => {
  it("giua man la 0, goc man la 1, ngoai khoang bi kep", () => {
    expect(tien(0, 1000, 400, 169)).toBe(0);
    expect(tien(99999, 1000, 400, 169)).toBe(1);
  });
});

describe("luoiGiot", () => {
  it("phu kin ca dai, tre cua vet giua nho nhat, moi so deu hop le", () => {
    const g = luoiGiot(1000, 400, MAT_DO, hatTu("mua-phun", MAT_DO));
    expect(g.length).toBe((Math.ceil(1000 / MAT_DO) + 2) * (Math.ceil(400 / MAT_DO) + 2));
    expect(g.every((x) => x.tre >= 0)).toBe(true);
    expect(g.every((x) => x.dai >= Math.round(DV_MS * 0.88) && x.dai <= Math.round(DV_MS * 1.12))).toBe(true);
    // Vet gan tam nhat no truoc moi vet o ria: mep loang chay tu giua ra.
    const giua = [...g].sort((a, b) => Math.hypot(a.x + a.r - 500, a.y + a.r - 200) - Math.hypot(b.x + b.r - 500, b.y + b.r - 200))[0];
    const ria = [...g].sort((a, b) => Math.hypot(b.x + b.r - 500, b.y + b.r - 200) - Math.hypot(a.x + a.r - 500, a.y + a.r - 200))[0];
    expect(giua.tre).toBeLessThan(ria.tre);
  });

  /*
   * Ngan sach cua spec muc 3.5 la mot CAN TREN, ma can tren mot minh thi bai kiem van xanh khi luoi teo lai con vai
   * vet - tuc hieu ung hong ma khong ai bao. Nen ghim ca con so THAT (12x6 va 6x7 o), roi moi doi chieu voi can tren:
   * doi MAT_DO mot cai la ca hai dau cung do.
   */
  it("ngan sach so vet cua spec muc 3.5: khong qua 140 o 1280px, khong qua 90 o 390px", () => {
    const rong = luoiGiot(1280, 420, MAT_DO, 1).length;
    const hep = luoiGiot(390, 640, MAT_DO, 1).length;
    expect(rong).toBe((Math.ceil(1280 / 128) + 2) * (Math.ceil(420 / 128) + 2));
    expect(hep).toBe((Math.ceil(390 / 128) + 2) * (Math.ceil(640 / 128) + 2));
    expect(rong).toBe(72);
    expect(hep).toBe(42);
    expect(rong).toBeLessThanOrEqual(140);
    expect(hep).toBeLessThanOrEqual(90);
  });

  it("trong o cua so, khuon co lai nen so vet nho han so vet cua dai lon", () => {
    const o = luoiGiot(108, 108, khuonO(108, 108, true), 1);
    expect(o.length).toBeLessThan(luoiGiot(1280, 420, MAT_DO, 1).length);
    expect(o.length).toBeLessThanOrEqual(30);
  });
});

/*
 * Cong thuc chon khoang cach tam vet phai nam O DAY chu khong nam trong mo dun DOM: neu de `loangTroi` tu tinh
 * `Math.max(12, Math.min(W, H) / O_HE)` tai cho thi ca cong thuc lan cai san 12 khong co bai kiem nao (dung phat
 * hien N13 cua ban soat truoc thi cong). San 12 la cai giu cho o cua so that nho van con ra vai vet nuoc: khong co
 * no thi mot o 20px cho khoang cach 7,7px, tuc gan mot tram vet trong mot o bang dau ngon tay.
 */
describe("khuonO", () => {
  it("dai lon luon lay MAT_DO, khong phu thuoc be rong", () => {
    expect(khuonO(1280, 420, false)).toBe(MAT_DO);
    expect(khuonO(390, 640, false)).toBe(MAT_DO);
  });

  it("o cua so: khoang cach co theo canh ngan chia O_HE", () => {
    expect(khuonO(72, 72, true)).toBeCloseTo(27.69, 2);
    expect(khuonO(108, 108, true)).toBeCloseTo(41.54, 2);
    // Canh NGAN quyet dinh, khong phai canh dai.
    expect(khuonO(400, 108, true)).toBeCloseTo(41.54, 2);
  });

  it("o that nho van bi chan boi san O_SAN, khong bao gio ra ca tram vet trong mot o ti hon", () => {
    expect(khuonO(20, 20, true)).toBe(O_SAN);
    expect(O_SAN).toBe(12);
    expect(luoiGiot(20, 20, khuonO(20, 20, true), 1).length).toBeLessThanOrEqual(16);
  });
});
