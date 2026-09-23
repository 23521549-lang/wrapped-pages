// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Hoa, HoaDefs } from "@/components/tam-trang/HoaEp";
import { HOA_EP, MUC_HOA, rng } from "@/lib/tam-trang/hoa-ep";
import { FLOWERS, TROI, WEATHERS } from "@/lib/tam-trang/troi";

afterEach(cleanup);

/** So net cua moi bong hoa, dem tu chinh bo ve cua ban mau da duyet: doi thuat toan la doi hinh. */
const SO_NET = { cuc: 40, "luu-ly": 39, "bo-cong-anh": 68, "bong-lau": 43, "hue-mua": 27, "cam-tu-cau": 59, "bang-lang": 34, "hoa-baby": 65, "hoa-buom": 10 };

describe("net ve hoa ep", () => {
  it("bo so gia ngau nhien tat dinh, trong [0, 1)", () => {
    const a = rng(42);
    const b = rng(42);
    const day = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(day);
    expect(day.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("dung so net va dung vai net mau cua ban mau", () => {
    expect(Object.fromEntries(FLOWERS.map((k) => [k, HOA_EP[k].length]))).toEqual(SO_NET);
    expect(HOA_EP.cuc[3]).toEqual({
      k: "to", d: "M0 0 C-1.9 -4.5 -1.7 -11.5 0 -14 C1.7 -11.5 1.9 -4.5 0 0Z", o: 0.2, tf: "translate(22 20) rotate(13.1) scale(0.95)", key: "cuc-3",
    });
    expect(HOA_EP["bo-cong-anh"][3]).toEqual({ k: "net", d: "M26.2 18.89 L35.54 18.43", o: 0.38, w: 0.45, key: "bo-cong-anh-3" });
    for (const k of FLOWERS) expect(new Set(HOA_EP[k].map((n) => n.key)).size).toBe(HOA_EP[k].length);
  });
});

describe("HoaDefs va Hoa", () => {
  it("mot bo loc muc va chin symbol, moi symbol boc trong nhom dung bo loc, SVG doc duoc nhu XML", () => {
    const { container } = render(<HoaDefs />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(`filter#${MUC_HOA}`)).toHaveLength(1);
    const symbols = [...container.querySelectorAll("symbol")];
    expect(symbols.map((s) => s.id)).toEqual(FLOWERS.map((k) => `hoa-${k}`));
    for (const s of symbols) {
      expect(s.getAttribute("viewBox")).toBe("0 0 48 48");
      expect(s.querySelector("g")?.getAttribute("filter")).toBe(`url(#${MUC_HOA})`);
    }
    expect(symbols[0].querySelector("g")?.children).toHaveLength(SO_NET.cuc);
    const xml = new XMLSerializer().serializeToString(svg as Node);
    expect(new DOMParser().parseFromString(xml, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });

  it("Hoa tro toi dung bong hoa cua kieu troi, an voi trinh doc man hinh, xoay bang transform cua use", () => {
    for (const w of WEATHERS) {
      const { container, unmount } = render(<Hoa weather={w} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("class")).toBe(`hoa hoa--${w}`);
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("focusable")).toBe("false");
      expect(svg?.querySelector("use")?.getAttribute("href")).toBe(`#hoa-${TROI[w].hoa}`);
      expect(svg?.querySelector("use")?.hasAttribute("transform")).toBe(false);
      unmount();
    }
    const { container } = render(<Hoa weather="giong" xoay={-6} className="them" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("hoa hoa--giong them");
    expect(container.querySelector("use")?.getAttribute("transform")).toBe("rotate(-6 24 24)");
    expect(container.querySelector("[style]")).toBeNull();
  });
});
