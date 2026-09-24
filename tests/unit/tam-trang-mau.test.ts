import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { oklchToSrgb } from "@/lib/mau/oklch";
import { contrastRatio } from "@/lib/mau/tuong-phan";
import { WEATHERS } from "@/lib/tam-trang/troi";
import { boComment, docBangOklch, docBangToken, type Oklch } from "../helpers/bang-token";

/*
 * Chu tren bau troi dung tren nen chuyen sac tu --troi-X-1 toi --troi-X-2. Cong tuong phan chung khong doc duoc nen
 * linear-gradient (no do voi ba mat giay), nen bai nay do dung cap that: muc chinh va muc phu cua moi troi tren ca hai
 * dau chuyen sac (>= 4.5), vong focus tren ca hai dau (>= 3). Vien trong bau troi ve bang currentColor nen cong tuong
 * phan chung khong do duoc no: bai nay la san cho vai tro vien do, voi khang dinh rieng muc chinh >= 3 tren ca hai dau.
 */
describe("tuong phan tren chin bau troi", () => {
  const bang = docBangToken();

  it.each(WEATHERS)("%s: muc chinh, muc phu va vong focus doc ro tren ca hai dau troi", (k) => {
    for (const nen of [`--troi-${k}-1`, `--troi-${k}-2`]) {
      expect(bang[nen], nen).toBeDefined();
      for (const [mau, nguong] of [[`--troi-${k}-ink`, 4.5], [`--troi-${k}-ink2`, 4.5], ["--color-focus", 3]] as const) {
        expect(bang[mau], mau).toBeDefined();
        expect(contrastRatio(bang[mau], bang[nen]), `${mau} tren ${nen}`).toBeGreaterThanOrEqual(nguong);
      }
    }
  });

  it.each(WEATHERS)("%s: muc chinh du lam VIEN tren ca hai dau troi (net ve bang currentColor)", (k) => {
    // Vien va net ve trong bau troi (o troi da chon, vien o cua so, net song) lay mau tu currentColor, tuc muc chinh
    // cua troi: cong tuong phan chung chi doc duoc token that nen khong thay cap nay, day la cho do no.
    const muc = bang[`--troi-${k}-ink`];
    for (const nen of [`--troi-${k}-1`, `--troi-${k}-2`]) {
      expect(contrastRatio(muc, bang[nen]), `vien ${k} tren ${nen}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("du token net ve cua moi troi, may va chop cua giong, nam dai cau vong", () => {
    const can = [...WEATHERS.map((k) => `--troi-${k}-net`), "--troi-giong-may", "--troi-giong-chop", "--cv-1", "--cv-2", "--cv-3", "--cv-4", "--cv-5"];
    for (const t of can) expect(bang[t], t).toBeDefined();
  });

  it("moi bong hoa nhuom bang muc chinh cua troi cua no; khong con lop doi mau cua ban mau", () => {
    // Muc chinh cua moi troi da qua 4.5 tren ca ba mat giay (cong tuong phan chung do cac quy tac nay) va tren troi (o tren).
    const css = readFileSync("src/styles/tam-trang.css", "utf8");
    for (const k of WEATHERS) {
      // Noi khoang trang: quy tac co the xuong dong hay gian cach khac, hinh thi khong doi.
      const re = new RegExp(`[.]hoa--${k}[ ]*[{][ ]*color:[ ]*var[(][ ]*--troi-${k}-ink[ ]*[)][ ]*;[ ]*[}]`);
      expect(re.test(css), `.hoa--${k}`).toBe(true);
    }
    expect(css).not.toContain("hoa-theo-troi");
  });
});

/** Goc mau ve dang hai truc a/b cua oklab, de tron hai mau dung nhu color-mix(in oklab, ...) cua trinh duyet. */
function sangOklab(m: Oklch): { l: number; a: number; b: number } {
  const rad = (m.h * Math.PI) / 180;
  return { l: m.l, a: m.c * Math.cos(rad), b: m.c * Math.sin(rad) };
}

/** `color-mix(in oklab, X p%, Y)`: noi thang tung truc, roi doi nguoc ve ba so oklch. */
function tronOklab(x: Oklch, y: Oklch, p: number): Oklch {
  const a = sangOklab(x);
  const b = sangOklab(y);
  const l = p * a.l + (1 - p) * b.l;
  const ta = p * a.a + (1 - p) * b.a;
  const tb = p * a.b + (1 - p) * b.b;
  return { l, c: Math.hypot(ta, tb), h: ((Math.atan2(tb, ta) * 180) / Math.PI + 360) % 360 };
}

/** Khoang cach hai goc mau, luon lay cung ngan hon. */
function lechGoc(x: number, y: number): number {
  const d = Math.abs(x - y) % 360;
  return d > 180 ? 360 - d : d;
}

/*
 * Nut chu trong dai troi bo gach chan roi (yeu cau dot ba diem 19), nen dau hieu "bam duoc" con lai luc re chuot hay
 * luc di toi bang phim la muc cua chinh troi day them mot bac ve phia muc dam nhat (phan quyet B5). Mau do la mot
 * color-mix voi currentColor nen cong tuong phan chung khong doc duoc no; day la cho do no, va do bang chinh con so
 * phan tram viet trong CSS chu khong phai mot ban sao viet tay.
 */
describe("nut chu trong dai troi dam them mot bac khi re chuot hay di toi bang phim", () => {
  // Bo chu thich truoc khi tim: chinh khoi chu thich cua quy tac nay co nhac lai mot bo chon kem dau ngoac nhon.
  const css = boComment(readFileSync("src/styles/tam-trang.css", "utf8"));
  const quyTac = /([^{}]*\.troi\s+\.btn--chu:hover[^{}]*)\{([^{}]*)\}/.exec(css);
  const tron = quyTac === null
    ? null
    : /color:\s*color-mix\(\s*in\s+(\w+)\s*,\s*currentColor\s+([\d.]+)%\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*\)/.exec(quyTac[2]);
  const bangLch = docBangOklch();
  const bangRgb = docBangToken();

  it("co quy tac dam mau cho ca re chuot lan di toi bang phim", () => {
    expect(quyTac, ".troi .btn--chu:hover").not.toBeNull();
    expect(quyTac?.[1]).toContain(".troi .btn--chu:focus-visible");
    expect(tron, "color: color-mix(...) cua quy tac dam mau").not.toBeNull();
  });

  it("tron trong oklab chu khong oklch, de goc mau cua troi khong bi keo di", () => {
    // oklch noi theo cung goc mau: tron muc nang am (goc 58) voi muc dam nhat (goc 250) se di qua cung ngan va rot
    // xuong goc 16, tuc tu nau am thanh do hong. oklab noi thang theo hai truc nen chi dam hon va bot ruc, giu tong.
    expect(tron?.[1]).toBe("oklab");
  });

  it.each(WEATHERS)("%s: mau dam them van doc ro tren ca hai dau troi, va van la muc cua chinh troi do", (k) => {
    expect(tron, "quy tac dam mau").not.toBeNull();
    const [, , phanTram, tenDich] = tron as RegExpExecArray;
    const muc = bangLch[`--troi-${k}-ink`];
    const dich = bangLch[tenDich];
    expect(muc, `--troi-${k}-ink`).toBeDefined();
    expect(dich, tenDich).toBeDefined();

    const dam = tronOklab(muc, dich, Number(phanTram) / 100);
    // Dam hon that su, va van cung tong mau voi muc cua troi (khong nhay sang mot sac khac, soat truoc N7).
    expect(dam.l, `${k}: do sang sau khi tron`).toBeLessThan(muc.l - 3);
    expect(lechGoc(dam.h, muc.h), `${k}: goc mau sau khi tron`).toBeLessThan(12);

    const mauDam = oklchToSrgb(dam.l / 100, dam.c, dam.h);
    for (const nen of [`--troi-${k}-1`, `--troi-${k}-2`]) {
      expect(contrastRatio(mauDam, bangRgb[nen]), `mau dam ${k} tren ${nen}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
