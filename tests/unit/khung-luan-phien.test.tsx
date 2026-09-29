// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { readFileSync } from "node:fs";
import { KHOA_DUNG } from "@/components/hieu-ung/tam-dung";
import { KhungLuanPhien, type LuotKhung } from "@/components/book/KhungLuanPhien";

/*
 * Khung sach lon luan phien (spec 5a muc E3): tu hai luot chua doc tro len thi cu --dur-luan-phien (15 giay; jsdom khong
 * co token nen dung mac dinh) doi sang luot ke: hai trang mo di --dur-doi-luot (240ms), roi luot moi hien va trang phai
 * go tung chu. Lan ve dau hien du chu. Dung khi con tro hay focus o trong khung, khi tab an, va theo nut tam dung chung.
 * Giam chuyen dong: van doi luot nhung khong mo, khong go.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const LUAN = 15_000;
const DOI = 240;

const luot = (ten: string, sua: Partial<LuotKhung> = {}): LuotKhung => ({
  key: ten, who: "Mạnh", title: ten, covers: [{ cover: "nui-xa", coverMediaId: null }], dauHref: `/dau-thoi-gian/${ten}`,
  pageCount: 3, position: 2, readHref: `/sach/${ten}?trang=2`, when: "vừa xong", excerpt: `Chữ của ${ten}`, locked: false,
  isPrivate: false, action: { label: "Đọc tiếp", href: `/sach/${ten}` }, nhan: { chu: "Bạn chưa đọc", dac: true },
  ...sua,
});

const BA = [luot("A"), luot("B"), luot("C", { locked: true, excerpt: "Dòng hé lộ", nhan: { chu: "Mạnh chưa đọc", dac: false } })];

let giam = false;

beforeEach(() => {
  vi.useFakeTimers();
  giam = false;
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: giam && query.includes("reduce"), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

const cho = (ms: number) => act(() => {
  vi.advanceTimersByTime(ms);
});

function ve(tuDatNut = false) {
  const r = render(<KhungLuanPhien luot={BA} tuDatNut={tuDatNut} />);
  const q = (chon: string) => r.container.querySelector(chon);
  return {
    ...r,
    ten: () => q(".vua-viet__ten")?.textContent,
    dem: () => q(".vua-viet__dem")?.textContent,
    chuPhai: () => q(".vua-viet__chu, .he-lo") as HTMLElement | null,
    dangDoi: () => q(".sach-mo")?.classList.contains("dang-doi"),
    khung: () => q("article.vua-viet") as HTMLElement,
  };
}

describe("KhungLuanPhien", () => {
  it("lan ve dau hien du chu; 15 giay sau hai trang mo di, roi luot ke hien va go chu", () => {
    const k = ve();
    expect([k.ten(), k.dem(), k.chuPhai()?.textContent]).toEqual(["A", "Lượt chưa đọc 1 / 3", "Chữ của A"]);
    expect(k.container.querySelector(".con-tro")).toBeNull();
    cho(LUAN - 1);
    expect(k.dangDoi()).toBe(false);
    cho(1);
    expect([k.ten(), k.dangDoi()]).toEqual(["A", true]);
    cho(DOI);
    expect([k.ten(), k.dem(), k.dangDoi()]).toEqual(["B", "Lượt chưa đọc 2 / 3", false]);
    expect(k.container.querySelector(".vua-viet__chu .con-tro")).not.toBeNull();
    expect(k.container.querySelector(".vua-viet__chu .sr-only")?.textContent).toBe("Chữ của B");
  });

  it("luot khoa go dong he lo va mang nhan cham rong; het vong thi quay ve luot dau", () => {
    const k = ve();
    // Moi buoc mot lan tien dong ho: hen gio moi chi duoc dat sau khi React ve xong lan doi truoc.
    const mot = () => {
      cho(LUAN);
      cho(DOI);
    };
    mot();
    mot();
    expect([k.ten(), k.dem()]).toEqual(["C", "Lượt chưa đọc 3 / 3"]);
    expect(k.container.querySelector(".he-lo .sr-only")?.textContent).toBe("Dòng hé lộ");
    expect(k.container.querySelector(".vua-viet__nhan .cham--rong")).not.toBeNull();
    mot();
    expect(k.ten()).toBe("A");
  });

  it("con tro hay focus trong khung thi dung; roi khung thi dem lai du 15 giay", () => {
    const k = ve();
    fireEvent.pointerEnter(k.khung());
    cho(3 * LUAN);
    expect(k.ten()).toBe("A");
    fireEvent.pointerLeave(k.khung());
    cho(LUAN - 1);
    expect(k.dangDoi()).toBe(false);
    cho(1 + DOI);
    expect(k.ten()).toBe("B");
    fireEvent.focusIn(k.container.querySelector(".sach-mo__nut") as HTMLElement);
    cho(3 * LUAN);
    expect(k.ten()).toBe("B");
  });

  it("tab an thi dung; nut tam dung chung da bat thi khong doi", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const k = ve();
    cho(3 * LUAN);
    expect(k.ten()).toBe("A");
    cleanup();
    Reflect.deleteProperty(document, "visibilityState");
    localStorage.setItem(KHOA_DUNG, "dung");
    const k2 = ve();
    cho(3 * LUAN);
    expect(k2.ten()).toBe("A");
  });

  it("giam chuyen dong: van doi luot, nhung doi ngay, khong mo, khong go", () => {
    giam = true;
    const k = ve();
    cho(LUAN);
    expect([k.ten(), k.dangDoi(), k.chuPhai()?.textContent]).toEqual(["B", false, "Chữ của B"]);
    expect(k.container.querySelector(".con-tro")).toBeNull();
  });

  it("nut tam dung luon co: trang khong co dai troi thi hien ca khi giam chuyen dong, co dai troi thi chi khi giam", () => {
    expect(ve(true).container.querySelector(".bia-dung")?.className).toContain("bia-dung--luon");
    cleanup();
    expect(ve(false).container.querySelector(".bia-dung")?.className).toContain("bia-dung--giam");
  });
});

describe("KhungLuanPhien: CSS", () => {
  const CSS = readFileSync("src/styles/app.css", "utf8").split(String.fromCharCode(13)).join("");
  const TOKENS = readFileSync("src/styles/tokens.css", "utf8");

  it("lan doi luot chi mo bang opacity theo --dur-doi-luot, giam chuyen dong thi khong chuyen tiep; token co mat", () => {
    expect(CSS).toContain(".sach-mo__to--trai > div:first-child, .sach-mo__to--phai, .sach-mo__to--trai .tranh-dan{ transition: opacity var(--dur-doi-luot) var(--ease-out); }");
    expect(CSS).toContain(".dang-doi .sach-mo__to--trai > div:first-child, .dang-doi .sach-mo__to--phai, .dang-doi .sach-mo__to--trai .tranh-dan{ opacity: 0; }");
    expect(CSS).toContain([
      "@media (prefers-reduced-motion: reduce){",
      "  .sach-mo__to--trai > div:first-child, .sach-mo__to--phai, .sach-mo__to--trai .tranh-dan{ transition: none; }",
      "}",
    ].join(String.fromCharCode(10)));
    for (const d of ["--dur-luan-phien: 15000ms;", "--dur-doi-luot: 240ms;"]) expect(TOKENS).toContain(d);
  });

  it("nut tam dung cua khung: giam an khi co chuyen dong; ca hai hien khi giam chuyen dong, sau luat giau .bia-dung", () => {
    expect(CSS).toContain(".bia-dung--giam{ display: none; }");
    const giau = CSS.indexOf("@media (prefers-reduced-motion: reduce){ .bia-dung{ display: none; } }");
    const hien = CSS.indexOf("@media (prefers-reduced-motion: reduce){ .bia-dung--luon, .bia-dung--giam{ display: inline-flex; } }");
    expect(giau).toBeGreaterThan(-1);
    expect(hien).toBeGreaterThan(giau);
  });
});
