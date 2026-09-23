import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/mau/tuong-phan";
import { WEATHERS } from "@/lib/tam-trang/troi";
import { docBangToken } from "../helpers/bang-token";

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
