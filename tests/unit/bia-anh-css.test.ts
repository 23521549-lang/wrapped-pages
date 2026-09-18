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

describe("bia anh trong app.css", () => {
  it("anh bia phu kin khung cua tranh ve, khong chan cu bam, nen anh hong hay dang tai khong doi bo cuc", () => {
    const anh = khai(CSS, ".bia__anh");
    for (const d of ["position: absolute", "inset: 0", "width: 100%", "height: 100%", "object-fit: cover", "pointer-events: none"]) {
      expect(anh).toContain(d);
    }
    expect(khai(CSS, ".bia")).toContain("position: relative");
    expect(khai(CSS, ".book__cover")).toContain("position: relative");
    expect(khai(CSS, ".swatch")).toContain("position: relative");
  });

  it("san cat tu xu ly keo tren man cam ung; thanh thu phong cao 44px tren man cam ung", () => {
    expect(khai(CSS, ".cat-bia__san")).toContain("touch-action: none");
    expect(media(CSS, "(pointer: coarse), (max-width: 820px)")).toContain(".thanh-truot{ height: 44px; }");
  });
});
