// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions } from "@/components/editor/extensions";
import { measureUnits } from "@/components/editor/measure";
import { paginate } from "@/lib/paginate";
import { PEAK_COUNT } from "@/lib/media/kinds";
import { CONTENT_HEIGHT, VOICE_BLOCK_HEIGHT } from "@/lib/sheet";

const schema = getSchema(editorExtensions("Mạnh"));
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";

/** Doan trong o vi tri 0 (co 2), anh o 2, ghi am o 3, doan trong o 4. */
const DOC = PMNode.fromJSON(schema, {
  type: "doc",
  content: [
    { type: "paragraph" },
    { type: "anh", attrs: { id: ID, w: 1200, h: 900 } },
    { type: "ghi-am", attrs: { id: ID, ms: 5_000, peaks: Array.from({ length: PEAK_COUNT }, () => 0) } },
    { type: "paragraph" },
  ],
});

/** Dinh tung khoi cua ban sao tinh tu dinh man hinh; ban sao bat dau o 100. */
const DINH = [100, 140, 380.8, 465.6];

function hop(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 304, width: 304, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** jsdom khong dan trang: gia lap vi tri. Khoi media bao cao cao 0, nhu anh chua ve toi: bo do phai lay chieu cao tu attrs. */
function giaLapBoCuc(mirror: HTMLElement, dinh: readonly number[] = DINH): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this === mirror) return hop(100, 1000);
    const i = Array.prototype.indexOf.call(mirror.children, this);
    return hop(dinh[i], this.tagName === "P" ? 27.2 : 0);
  });
}

/**
 * Tai lieu day to dau: 16 doan trong lien tiep (16 * 27.2 = 435.2), con dung 24.8px duoi CONTENT_HEIGHT (460) - khong du
 * cho anh cao 228 (1200x900 qua imageBox). Doan cuoi kiem to sau bat dau lai binh thuong sau khi anh sang nguyen to do.
 */
const SO_DONG_DAY_TO = 16;
const DOC_TRANG = PMNode.fromJSON(schema, {
  type: "doc",
  content: [
    ...Array.from({ length: SO_DONG_DAY_TO }, () => ({ type: "paragraph" })),
    { type: "anh", attrs: { id: ID, w: 1200, h: 900 } },
    { type: "paragraph" },
  ],
});
const DINH_TRANG = [
  ...Array.from({ length: SO_DONG_DAY_TO }, (_, i) => i * 27.2),
  SO_DONG_DAY_TO * 27.2,
  SO_DONG_DAY_TO * 27.2 + 228,
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("measureUnits voi khoi media", () => {
  it("moi khoi media la mot don vi nguyen dat o vi tri cua node, cao tu attrs chu khong tu anh da tai", () => {
    const mirror = document.createElement("div");
    giaLapBoCuc(mirror);
    const units = measureUnits(mirror, DOC);
    expect(units.map((u) => u.pos)).toEqual([0, 2, 3, 4]);
    const want = [[0, 27.2], [40, 228], [280.8, VOICE_BLOCK_HEIGHT], [365.6, 27.2]];
    units.forEach((u, i) => {
      expect(u.top, `top ${i}`).toBeCloseTo(want[i][0], 6);
      expect(u.bottom - u.top, `cao ${i}`).toBeCloseTo(want[i][1], 6);
    });
  });

  it("ban sao ve khoi media bang hop giu cho dung kich thuoc, khong tai anh nao", () => {
    const mirror = document.createElement("div");
    giaLapBoCuc(mirror);
    measureUnits(mirror, DOC);
    expect(mirror.querySelector("img")).toBeNull();
    const cho = mirror.querySelector('figure[data-khoi="anh"] > .khoi-anh__cho');
    expect([cho?.namespaceURI, cho?.getAttribute("width"), cho?.getAttribute("height")]).toEqual(["http://www.w3.org/2000/svg", "304", "228"]);
    expect(mirror.querySelector('figure.khoi-ghi-am[data-khoi="ghi-am"]')).not.toBeNull();
  });
});

describe("paginate(measureUnits(...)) het pipeline", () => {
  it("anh khong vua cho con lai cua to dau thi day nguyen sang to sau, khong cat", () => {
    const mirror = document.createElement("div");
    giaLapBoCuc(mirror, DINH_TRANG);
    const units = measureUnits(mirror, DOC_TRANG);
    const sheets = paginate(units, CONTENT_HEIGHT);
    // Anh la don vi thu SO_DONG_DAY_TO (sau dung SO_DONG_DAY_TO doan trong, moi doan mot don vi).
    expect(units[SO_DONG_DAY_TO].bottom - units[SO_DONG_DAY_TO].top).toBeCloseTo(228, 6);
    expect(sheets.map((s) => [s.from, s.to])).toEqual([[0, SO_DONG_DAY_TO], [SO_DONG_DAY_TO, units.length]]);
    // Anh nam tron trong to thu hai, khong bi cat: ca khoi nam trong CONTENT_HEIGHT tinh tu dinh to do.
    expect(units[SO_DONG_DAY_TO].bottom - sheets[1].top).toBeLessThanOrEqual(CONTENT_HEIGHT + 1e-6);
  });
});
