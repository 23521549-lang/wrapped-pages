import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Moi tep .svg trong src phai doc duoc nhu XML. Trinh duyet doc bieu tuong tab bang bo phan tich XML nghiem ngat:
 * tep sai cu phap thi no bo qua, khong bao loi, va tab chi hien bieu tuong trang. Loi that da gap: chu thich chua
 * hai dau gach ngang lien nhau (vi du khi nhac ten bien CSS), thu ma XML cam trong chu thich.
 */
function svgTrongSrc(thuMuc = "src"): string[] {
  const ra: string[] = [];
  for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
    const duong = `${thuMuc}/${muc.name}`;
    if (muc.isDirectory()) ra.push(...svgTrongSrc(duong));
    else if (muc.name.endsWith(".svg")) ra.push(duong);
  }
  return ra;
}

/** Tra ve thong diep loi cua bo phan tich XML, hoac null khi tep doc duoc. Chay o moi truong jsdom (duoi .tsx). */
export function loiXml(noiDung: string): string | null {
  const tai = new DOMParser().parseFromString(noiDung, "image/svg+xml");
  const loi = tai.querySelector("parsererror");
  if (loi) return loi.textContent?.trim() || "khong doc duoc";
  return tai.documentElement.nodeName === "svg" ? null : `the goc la ${tai.documentElement.nodeName}, khong phai svg`;
}

describe("tep svg trong src", () => {
  const tep = svgTrongSrc();

  it("co it nhat mot tep de kiem", () => {
    expect(tep.length).toBeGreaterThan(0);
  });

  it.each(tep)("%s doc duoc nhu XML", (duong) => {
    expect(loiXml(readFileSync(duong, "utf8")), duong).toBeNull();
  });

  it("bat duoc loi that: hai dau gach ngang trong chu thich", () => {
    expect(loiXml('<svg xmlns="http://www.w3.org/2000/svg"><!-- mau --blue-ink --></svg>')).not.toBeNull();
  });
});
