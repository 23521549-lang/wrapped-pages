import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * Cot phai cua man doc (the Nhac nen roi khung Loi hoi dap) dinh thanh MOT khoi (chu du an 26/09): khung hoi dap luon nam
 * ngay duoi the nhac va cuon theo no, khong truot vao duoi the nhac ma bi che. Bai e2e hoi-dap do dieu do tren trinh duyet
 * that; bai nay giu cac quy tac CSS lam nen no.
 */

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CSS = readFileSync("src/styles/giay.css", "utf8").split(CR).join("");

/** Khai bao cua quy tac dau tien viet dung bo chon nay trong css (tu vi tri `tu`), khoang trang da gop lai. */
function khai(chon: string, tu = 0): string {
  const bat = CSS.indexOf(`${chon}{`, tu);
  expect(bat, `khong co quy tac ${chon}`).toBeGreaterThan(-1);
  const mo = CSS.indexOf("{", bat) + 1;
  return CSS.slice(mo, CSS.indexOf("}", mo)).split(LF).join(" ").replace(/ +/g, " ");
}

describe("cot phai cua man doc", () => {
  it("ca cot dinh thanh mot khoi, dung o dau hang luoi, cao toi da bang khung nhin tru hai mep", () => {
    const cot = khai(".doc-luoi__phu");
    for (const d of ["position: sticky", "align-self: start", "max-height: calc(100dvh - var(--phu-tren) - var(--space-lg))"]) {
      expect(cot).toContain(d);
    }
    // Sach khong nhac: dinh duoi thanh dieu huong dang dinh; sach co nhac: thanh dieu huong khong dinh.
    expect(cot).toContain("--phu-tren: calc(var(--nav-cao) + var(--space-lg))");
    expect(khai(".doc-luoi__phu--nhac")).toContain("--phu-tren: var(--space-lg)");
  });

  it("the nhac khong co lai; khung hoi dap co lai va cuon ben trong khi dai hon cho con lai", () => {
    expect(khai(".doc-luoi__phu > .nhac-the")).toContain("flex: none");
    const hoiDap = khai(".doc-luoi__phu > .hoi-dap");
    expect(hoiDap).toContain("min-height: 0");
    expect(hoiDap).toContain("overflow-y: auto");
  });

  it("khong con dinh rieng the nhac, va khong con chua cho the nhac che bang scroll-margin", () => {
    expect(CSS).not.toContain(".doc-luoi__phu--nhac > .nhac-the{ position: sticky");
    expect(CSS).not.toContain("scroll-margin-top: 23rem");
  });

  it("man hep mot cot: cot phai khong dinh, khong gioi han chieu cao, khung hoi dap khong cuon rieng", () => {
    const hep = CSS.indexOf("@media (max-width: 980px){");
    expect(hep).toBeGreaterThan(-1);
    expect(khai(".doc-luoi__phu", hep)).toContain("position: static; max-height: none;");
    expect(khai(".doc-luoi__phu > .hoi-dap", hep)).toContain("overflow: visible;");
  });
});
