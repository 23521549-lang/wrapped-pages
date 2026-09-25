// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Ngan, SO_TANG_GON } from "@/components/book/Ngan";
import type { ShelfBook as Sach } from "@/server/library/shelf";

/*
 * Ngan ke thu gon con ba tang. Diem 18 cua chu du an: nut an voi mat nhung phai hien ra khi di toi bang phim Tab va
 * phai co ten doc duoc. Spec muc 10.3: sach bi gon KHONG duoc ve ra cay, vi ve roi cat bang overflow thi phim Tab
 * van di vao chung va vong focus roi vao cho khong nhin thay.
 */

const CR = String.fromCharCode(13);
const CSS = readFileSync("src/styles/app.css", "utf8").split(CR).join("");

/** So cot ma getComputedStyle se bao. jsdom tra chuoi rong cho gridTemplateColumns nen phai va. */
let cot = 3;

function sach(i: number): Sach {
  return {
    id: `s${i}`, title: `Cuốn ${i}`, mode: "chia-se", cover: "nui-xa", coverMediaId: null,
    pageCount: 2, newCount: 0, lockedCount: 0, mine: true, ownerNickname: "Linh",
    createdAt: new Date(0), lastPublishedAt: new Date(0), excerpt: null, excerptPosition: 1, excerptLocked: false,
  } as unknown as Sach;
}

const nhieu = (n: number) => Array.from({ length: n }, (_, i) => sach(i + 1));

function ve(books: readonly Sach[]) {
  render(<Ngan ten="Kệ của bạn" books={books} trong="Bạn chưa có cuốn nào." when={() => "vừa xong"} />);
}

const cuon = () => [...document.querySelectorAll(".cuon")];
const nut = () => document.querySelector<HTMLButtonElement>(".ke-nut");

beforeEach(() => {
  cot = 3;
  const goc = globalThis.getComputedStyle.bind(globalThis);
  vi.stubGlobal("getComputedStyle", (el: Element) => {
    const co = goc(el);
    if ((el as HTMLElement).classList.contains("hang")) {
      return { ...co, gridTemplateColumns: Array.from({ length: cot }, () => "200px").join(" ") } as CSSStyleDeclaration;
    }
    return co;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Ngan: thu gon con ba tang", () => {
  it("chuoi va getComputedStyle that su duoc va: phep do so cot co gi that de chay", () => {
    ve(nhieu(1));
    const luoi = document.querySelector(".hang") as HTMLElement;
    expect(globalThis.getComputedStyle(luoi).gridTemplateColumns).toBe("200px 200px 200px");
  });

  it("ba tang tro xuong: khong co dai nut nao", () => {
    ve(nhieu(cot * SO_TANG_GON));
    expect(cuon()).toHaveLength(cot * SO_TANG_GON);
    expect(nut()).toBeNull();
  });

  it("hon ba tang: chi ve dung ba tang, cac cuon con lai KHONG co trong cay", () => {
    ve(nhieu(cot * SO_TANG_GON + 4));
    expect(cuon()).toHaveLength(cot * SO_TANG_GON);
    // Khong mot lien ket nao cua cac cuon bi gon nam trong cay, nen phim Tab khong the cham vao chung.
    expect(screen.queryByRole("link", { name: /Cuốn 13/ })).toBeNull();
  });

  it("so cot doi thi so cuon hien doi theo", () => {
    cot = 2;
    ve(nhieu(20));
    expect(cuon()).toHaveLength(2 * SO_TANG_GON);
  });

  it("bam Mo rong thi thay het, bam lai thi gon; aria-expanded doi theo", () => {
    ve(nhieu(20));
    const n = nut() as HTMLButtonElement;
    expect(n.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(n);
    expect(cuon()).toHaveLength(20);
    expect(nut()?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(nut() as HTMLButtonElement);
    expect(cuon()).toHaveLength(cot * SO_TANG_GON);
  });

  it("nut co ten doc duoc kem so cuon con lai, lay tu du lieu chu khong dem bang cay", () => {
    ve(nhieu(20));
    expect(screen.getByRole("button", { name: "Mở rộng kệ của bạn, còn 11 cuốn" })).toBeTruthy();
    fireEvent.click(nut() as HTMLButtonElement);
    expect(screen.getByRole("button", { name: "Thu gọn kệ của bạn" })).toBeTruthy();
  });

  it("nut khong bi giau khoi luong tieu diem: khong display none, khong visibility hidden, khong aria-hidden", () => {
    ve(nhieu(20));
    const n = nut() as HTMLButtonElement;
    expect(n.getAttribute("aria-hidden")).toBeNull();
    expect(n.hasAttribute("hidden")).toBe(false);
    expect(n.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it("ngan trong van giu mot dong chu va mot mep ke, khong co nut", () => {
    ve([]);
    expect(screen.getByText("Bạn chưa có cuốn nào.")).toBeTruthy();
    expect(document.querySelector(".ke-mep")).not.toBeNull();
    expect(nut()).toBeNull();
  });

  it("go component thi ResizeObserver bi ngat", () => {
    const ngat = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {
        ngat();
      }
    });
    const { unmount } = render(<Ngan ten="Kệ của bạn" books={nhieu(20)} trong="x" when={() => "vừa xong"} />);
    unmount();
    expect(ngat).toHaveBeenCalled();
  });
});

describe("dai nut trong app.css", () => {
  it("an bang opacity chu khong bang display none hay visibility hidden", () => {
    const i = CSS.indexOf(".ke-nut__chu{");
    expect(i).toBeGreaterThan(-1);
    const than = CSS.slice(i, CSS.indexOf("}", i));
    expect(than).toContain("opacity: 0");
    expect(than).not.toContain("display: none");
    expect(than).not.toContain("visibility: hidden");
  });

  it("dai nut cao co dinh 44px du chu hien hay khong", () => {
    const i = CSS.indexOf(".ke-nut{");
    const than = CSS.slice(i, CSS.indexOf("}", i));
    expect(than).toContain("min-height: 44px");
  });

  it("chu hien ra khi re chuot va khi di toi bang phim", () => {
    expect(CSS).toContain(".ke-nut:hover .ke-nut__chu, .ke-nut:focus-visible .ke-nut__chu{ opacity: 1; }");
  });

  it("goi y he sach khong nhan cu bam va khong chiem them chieu cao", () => {
    const i = CSS.indexOf(".ke-nut--gon::before{");
    expect(i).toBeGreaterThan(-1);
    const than = CSS.slice(i, CSS.indexOf("}", i));
    expect(than).toContain("position: absolute");
    expect(than).toContain("pointer-events: none");
  });
});
