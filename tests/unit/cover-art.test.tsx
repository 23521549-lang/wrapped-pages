import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverArt, idVeBia, InkDefs, MUC_LOANG } from "@/components/book/CoverArt";
import { COVERS, COVER_LABEL, COVER_NAME, type CoverKey } from "@/lib/book";

/*
 * Moi bia ve cung mot ky thuat: net va mang currentColor, dam nhat bang opacity trong mot dai hep, nham chung bo loc
 * muc loang khai mot lan trong InkDefs. Nho vay mau bia chi di qua token va khong bia nao thanh mang dam. Hinh ve khai
 * MOT lan trong InkDefs; moi bia tren trang la mot <use> tro toi do.
 */

const HINH = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline", "line"]);
const CAM = ["text", "defs", "image", "linearGradient", "radialGradient", "filter", "use", "mask", "clipPath"];

function docXml(html: string): Element {
  const doc = new DOMParser().parseFromString(html, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc.documentElement;
}

/** Hinh ve cua mot bia dung nhu no nam trong InkDefs: mot svg 300 x 180 boc dung nhom co id cua bia do. */
function docSvg(cover: CoverKey): Element {
  const defs = docXml(renderToStaticMarkup(<InkDefs />));
  const nhom = Array.from(defs.getElementsByTagName("g")).find((g) => g.getAttribute("id") === idVeBia(cover));
  expect(nhom, `InkDefs thieu hinh ve ${cover}`).toBeDefined();
  const svg = docXml(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180">${new XMLSerializer().serializeToString(nhom as Element)}</svg>`);
  return svg;
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
  it.each(COVERS)("%s: tren trang, bia la khung 300 x 180 voi dung mot <use> tro toi hinh ve trong InkDefs", (c) => {
    const svg = docXml(renderToStaticMarkup(<CoverArt cover={c} />));
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 180");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
    const con = Array.from(svg.children);
    expect(con).toHaveLength(1);
    expect(con[0].tagName).toBe("use");
    expect(con[0].getAttribute("href")).toBe(`#${idVeBia(c)}`);
  });

  it.each(COVERS)("%s: hinh ve trong InkDefs la mot nhom duy nhat dung bo loc muc loang", (c) => {
    const nhom = docSvg(c).children[0];
    const con = Array.from(nhom.children);
    expect(con).toHaveLength(1);
    expect(con[0].tagName).toBe("g");
    expect(con[0].getAttribute("filter")).toBe(`url(#${MUC_LOANG})`);
  });

  it.each(COVERS)("%s: khong chu, khong defs, khong gradient, khong anh, khong id/style/class", (c) => {
    // Bo qua chinh nhom boc mang id (duy nhat cho phep): moi phan tu ben trong hinh ve deu phai sach.
    const svg = docSvg(c).children[0];
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
