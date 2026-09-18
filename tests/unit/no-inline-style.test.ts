import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";

/*
 * Moi style tinh nam trong CSS. `style={` chi con o nhung file ma gia tri chi tinh duoc luc chay, moi
 * file kem ly do. File moi can style noi tuyen phai them vao day kem ly do cua no.
 */
const CHO_PHEP: Record<string, string> = {
  "src/components/editor/PagedSurface.tsx": "be rong, chieu cao va vi tri tung to giay nhan he so thu phong do luc chay",
  "src/components/reader/LockedSheet.tsx": "bien CSS --dai: do dai tung vach nhoe sinh luc chay",
  "src/components/reader/Flipbook.tsx": "bien CSS --so-to, --k cua khung sach va goc xoay rotateY cua to dang lat, tinh luc chay",
  "src/components/seal/SealPanel.tsx": "bien CSS --k: he so thu phong cua to trong khung thu thach, do luc chay",
};

/** Moi file .tsx trong src, duong dan dung "/" de doc duoc tren moi he dieu hanh. */
function tsxFiles(): string[] {
  return (readdirSync("src", { recursive: true }) as string[])
    .map((p) => `src/${p.split(sep).join("/")}`)
    .filter((p) => p.endsWith(".tsx"));
}

/** Bo tab, xuong dong va dau cach, de `style = {` hay `style=` roi xuong dong van bi bat. */
const gon = (s: string) => [...s].filter((c) => ![9, 10, 13, 32].includes(c.charCodeAt(0))).join("");

describe("khong con style noi tuyen tinh", () => {
  it("chi cac file trong danh sach cho phep co style={", () => {
    const sai = tsxFiles().filter((f) => !(f in CHO_PHEP) && gon(readFileSync(f, "utf8")).includes("style={"));
    expect(sai).toEqual([]);
  });

  it("moi file trong danh sach cho phep van con ton tai va van dung style={, danh sach khong mo rong thua", () => {
    const tsx = new Set(tsxFiles());
    for (const f of Object.keys(CHO_PHEP)) {
      expect(tsx.has(f), f).toBe(true);
      expect(gon(readFileSync(f, "utf8")), f).toContain("style={");
    }
  });
});
