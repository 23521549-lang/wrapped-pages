import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
/** app.css voi xuong dong LF, de doc duoc tren moi he dieu hanh. */
const CSS = readFileSync("src/styles/app.css", "utf8").split(CR).join("");

/** Khai bao cua quy tac dau tien viet dung bo chon nay trong css, khoang trang da gop lai. */
function khai(css: string, chon: string): string {
  const bat = [`${chon}{`, `${chon} {`].map((m) => css.indexOf(m)).find((i) => i >= 0);
  expect(bat, `khong co quy tac ${chon}`).toBeDefined();
  const mo = css.indexOf("{", bat) + 1;
  return css.slice(mo, css.indexOf("}", mo)).split(LF).join(" ").replace(/ +/g, " ");
}

/** Than mot khoi @media, toi dau "}" dong khoi o dau dong. */
function media(css: string, dieuKien: string): string {
  const bat = css.indexOf(`@media ${dieuKien}`);
  expect(bat, `khong co @media ${dieuKien}`).toBeGreaterThan(-1);
  return css.slice(bat, css.indexOf(`${LF}}`, bat));
}

describe("khung Hoat dong trong app.css", () => {
  it("ca khung cao toi da 340px", () => {
    expect(khai(CSS, ".hoat-dong")).toContain("max-height: 340px");
  });

  it("vung cuon chi cuon doc va an thanh cuon ca hai kieu", () => {
    const cuon = khai(CSS, ".hoat-dong__cuon");
    for (const d of ["overflow-y: auto", "overflow-x: hidden", "scrollbar-width: none"]) expect(cuon).toContain(d);
    expect(khai(CSS, ".hoat-dong__cuon::-webkit-scrollbar")).toContain("display: none");
  });

  it("vet mo o day dinh mep duoi vung cuon, co chieu cao va nen chuyen mau; tieu de ngay dinh mep tren", () => {
    const mo = khai(CSS, ".hoat-dong__cuon::after");
    for (const d of ["content: ''", "position: sticky", "bottom: 0"]) expect(mo).toContain(d);
    for (const d of ["height: 2.25rem", "linear-gradient("]) expect(mo).toContain(d);
    const ngay = khai(CSS, ".hoat-dong__ngay");
    for (const d of ["position: sticky", "top: 0"]) expect(ngay).toContain(d);
  });

  it("cau xuong dong o moi cho nen khong day tran ngang", () => {
    expect(khai(CSS, ".hoat-dong__chu")).toContain("overflow-wrap: anywhere");
  });

  it("dong cao toi thieu 44px tren man cam ung va man hep", () => {
    expect(khai(media(CSS, "(pointer: coarse), (max-width: 820px)"), ".hoat-dong__dong")).toContain("min-height: 44px");
  });

  it("khong tat vong focus o dau trong app.css", () => {
    expect(CSS).not.toMatch(/outline:[ ]*(?:none|0)[ ;}]/);
  });
});
