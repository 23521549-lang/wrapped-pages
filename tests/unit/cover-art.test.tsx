import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverArt, MUC_LOANG } from "@/components/book/CoverArt";
import { COVERS, COVER_LABEL, COVER_NAME, type CoverKey } from "@/lib/book";

/*
 * Moi bia ve cung mot ky thuat: net va mang currentColor, dam nhat bang opacity trong mot dai hep, nham chung bo loc
 * muc loang khai mot lan trong InkDefs. Nho vay mau bia chi di qua token va khong bia nao thanh mang dam.
 */

const HINH = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline", "line"]);
const CAM = ["text", "defs", "image", "linearGradient", "radialGradient", "filter", "use", "mask", "clipPath"];

function docSvg(cover: CoverKey): Element {
  const html = renderToStaticMarkup(<CoverArt cover={cover} />);
  const doc = new DOMParser().parseFromString(html, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc.documentElement;
}

/** Gia tri thuoc tinh cua chinh phan tu hoac gan nhat tren cay (thuoc tinh trinh bay SVG duoc ke thua). */
function keThua(el: Element, ten: string, goc: Element): string | null {
  for (let cur: Element | null = el; cur !== null; cur = cur.parentElement) {
    const v = cur.getAttribute(ten);
    if (v !== null) return v;
    if (cur === goc) break;
  }
  return null;
}

function tatCa(goc: Element): Element[] {
  return Array.from(goc.getElementsByTagName("*"));
}

describe("tranh ve cua moi bia", () => {
  it.each(COVERS)("%s: khung 300 x 180, mot nhom duy nhat dung bo loc muc loang", (c) => {
    const svg = docSvg(c);
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 180");
    const con = Array.from(svg.children);
    expect(con).toHaveLength(1);
    expect(con[0].tagName).toBe("g");
    expect(con[0].getAttribute("filter")).toBe(`url(#${MUC_LOANG})`);
  });

  it.each(COVERS)("%s: khong chu, khong defs, khong gradient, khong anh, khong id/style/class", (c) => {
    const svg = docSvg(c);
    for (const el of tatCa(svg)) {
      expect(CAM, `${c}: <${el.tagName}>`).not.toContain(el.tagName);
      for (const a of ["id", "style", "class"]) expect(el.hasAttribute(a), `${c}: <${el.tagName} ${a}>`).toBe(false);
    }
  });

  it.each(COVERS)("%s: mau chi la currentColor, dam nhat trong dai cho phep, net tron dau", (c) => {
    const svg = docSvg(c);
    for (const el of tatCa(svg)) {
      for (const a of ["fill", "stroke"]) {
        const v = el.getAttribute(a);
        if (v !== null) expect(["currentColor", "none"], `${c}: ${a}=${v}`).toContain(v);
      }
      const op = el.getAttribute("opacity");
      if (op !== null) {
        expect(Number(op), `${c}: opacity ${op}`).toBeGreaterThanOrEqual(0.12);
        expect(Number(op), `${c}: opacity ${op}`).toBeLessThanOrEqual(0.42);
      }
      const sw = el.getAttribute("stroke-width");
      if (sw !== null) {
        expect(Number(sw), `${c}: stroke-width ${sw}`).toBeGreaterThanOrEqual(2.2);
        expect(Number(sw), `${c}: stroke-width ${sw}`).toBeLessThanOrEqual(5.5);
      }
    }
    for (const el of tatCa(svg).filter((e) => HINH.has(e.tagName))) {
      const stroke = keThua(el, "stroke", svg);
      if (stroke === null || stroke === "none") continue;
      expect(keThua(el, "stroke-linecap", svg), `${c}: <${el.tagName}> net khong tron dau`).toBe("round");
      expect(keThua(el, "stroke-width", svg), `${c}: <${el.tagName}> net khong co do day`).not.toBeNull();
    }
  });

  it.each(COVERS)("%s: tu 1 toi 16 phan tu hinh", (c) => {
    const n = tatCa(docSvg(c)).filter((e) => HINH.has(e.tagName)).length;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(16);
  });

  it("ten va nhan truy cap cua moi bia", () => {
    for (const c of COVERS) {
      expect(COVER_NAME[c].trim()).not.toBe("");
      expect(COVER_LABEL[c]).toBe(`Bìa ${COVER_NAME[c].toLowerCase()}`);
    }
    expect(new Set(COVERS.map((c) => COVER_LABEL[c])).size).toBe(COVERS.length);
  });
});
