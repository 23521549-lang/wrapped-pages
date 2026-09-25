// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BiaTuDoi, NutDungHieuUng } from "@/components/book/BiaTuDoi";
import { KHOA_DUNG } from "@/components/hieu-ung/tam-dung";
import { DOI_BIA_MS, DON_TRE_MS, ROI_SANG_MS } from "@/lib/roi-sang";
import type { CoverKey } from "@/lib/book";

/*
 * Khung bia cua khung sach lon tu doi bia muoi giay mot lan. WCAG SC 2.2.2: noi dung tu cap nhat keo dai qua 5 giay va
 * nam song song voi noi dung khac deu phai dung duoc, nen tep nay kiem CA NAM duong dung: trang bi an, con tro tren
 * khung, khung giu focus, nguoi dung da chon tam dung, va may dang bat giam chuyen dong.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/** Moi khung bia deu la mot lien ket toi trang Dau thoi gian cua cuon. */
const LOI = { href: "/dau-thoi-gian/s1", nhan: "Dấu thời gian của Chuyện chưa kể" } as const;

type LanGoi = { el: Element; keyframes: unknown; ken: { duration?: number }; daHuy: boolean };
const daGoi: LanGoi[] = [];
const ANIMATE_GOC = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
let giamChuyenDong = false;
let anTrang = false;

function bia(cover: CoverKey, anh: string | null = null) {
  return { cover, coverMediaId: anh };
}

beforeEach(() => {
  daGoi.length = 0;
  giamChuyenDong = false;
  anTrang = false;
  vi.useFakeTimers();
  try {
    localStorage.removeItem(KHOA_DUNG);
  } catch {
    // Trinh duyet chan luu tru: bai kiem van chay.
  }
  Element.prototype.animate = function (this: Element, keyframes: unknown, ken: { duration?: number } = {}) {
    const ghi: LanGoi = { el: this, keyframes, ken, daHuy: false };
    daGoi.push(ghi);
    return { cancel: () => { ghi.daHuy = true; }, addEventListener: () => {} } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce") ? giamChuyenDong : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Object.defineProperty(document, "visibilityState", { get: () => (anTrang ? "hidden" : "visible"), configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (ANIMATE_GOC) Object.defineProperty(Element.prototype, "animate", ANIMATE_GOC);
  else delete (Element.prototype as Partial<Element>).animate;
});

/** Cho toi luc hen gio no, roi cho ca lan doi chay xong va don sach. */
function choDoiBia() {
  act(() => {
    vi.advanceTimersByTime(DOI_BIA_MS);
  });
}

function choDonXong() {
  act(() => {
    vi.advanceTimersByTime(ROI_SANG_MS + DON_TRE_MS);
  });
}

const khung = () => document.querySelector(".tranh-dan__bia") as HTMLElement;
const lopTam = () => document.querySelector(".roi-sang");

describe("BiaTuDoi", () => {
  it("cuon mot bia: dung yen tuyet doi, khong mot hen gio nao duoc dat", () => {
    render(<BiaTuDoi covers={[bia("nui-xa")]} {...LOI} />);
    choDoiBia();
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    expect(daGoi).toHaveLength(0);
  });

  it("cuon hai bia: sau muoi giay thi bia doi, va bia moi nam san o duoi", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    expect(khung().className).toContain("bia--nui-xa");
    choDoiBia();
    // Bia moi la chinh cai khung, bia cu nam tren lop tam va la thu duy nhat bien di.
    expect(khung().className).toContain("bia--hoa-dao");
    expect(lopTam()?.querySelector(".roi-sang__cu")?.className).toContain("bia--nui-xa");
  });

  it("mot lan doi chay dung hai hoat hinh: bia cu mo di va vet sang truot qua", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    choDoiBia();
    expect(daGoi).toHaveLength(2);
    for (const g of daGoi) expect(g.ken.duration).toBe(ROI_SANG_MS);
    expect(daGoi.map((g) => (g.el as HTMLElement).className.includes("roi-sang__vet"))).toContain(true);
  });

  it("don xong thi khong con lop tam nao trong cay va moi hoat hinh deu bi huy", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    choDoiBia();
    expect(lopTam()).not.toBeNull();
    choDonXong();
    expect(lopTam()).toBeNull();
    expect(daGoi.every((g) => g.daHuy)).toBe(true);
  });

  it("go component thi khong con hen gio nao", () => {
    const { unmount } = render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("giam chuyen dong: khong bao gio doi bia, khong mot hen gio nao duoc dat", () => {
    giamChuyenDong = true;
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    choDoiBia();
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    expect(daGoi).toHaveLength(0);
  });

  it("trang bi an thi hen gio dung, hien lai thi chay tiep", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    anTrang = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");

    anTrang = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    choDoiBia();
    expect(khung().className).toContain("bia--hoa-dao");
  });

  it("con tro dang tren khung thi hen gio dung, roi khoi thi chay tiep", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    fireEvent.pointerEnter(khung());
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    fireEvent.pointerLeave(khung());
    choDoiBia();
    expect(khung().className).toContain("bia--hoa-dao");
  });

  it("khung dang giu focus thi hen gio dung", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    fireEvent.focus(screen.getByRole("link", { name: LOI.nhan }));
    choDoiBia();
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    expect(daGoi).toHaveLength(0);
  });

  it("da chon tam dung tu lan truoc thi khong doi bia", () => {
    localStorage.setItem(KHOA_DUNG, "dung");
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    // Khang dinh theo HANH VI chu khong theo so hen gio dang treo: React va Testing Library cung dat hen gio cua rieng
    // chung, nen dem tong so la dem nham thu khac.
    choDoiBia();
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    expect(daGoi).toHaveLength(0);
  });

  it("nut tam dung du phong ghi dung lua chon dung chung, va bia dung theo ngay", () => {
    render(
      <>
        <BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />
        <NutDungHieuUng />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng hiệu ứng" }));
    expect(localStorage.getItem(KHOA_DUNG)).toBe("dung");
    expect(screen.getByRole("button", { name: "Cho hiệu ứng chạy" })).toBeTruthy();
    choDoiBia();
    choDoiBia();
    expect(khung().className).toContain("bia--nui-xa");
    expect(daGoi).toHaveLength(0);
  });

  it("khung bia KHONG tu ve nut tam dung: nut do la mot thanh phan rieng dat ngoai tranh dan", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao")]} {...LOI} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ca khung bia la mot lien ket toi trang Dau thoi gian, co ten doc duoc", () => {
    render(<BiaTuDoi covers={[bia("nui-xa")]} {...LOI} />);
    const lien = screen.getByRole("link", { name: LOI.nhan });
    expect(lien.getAttribute("href")).toBe(LOI.href);
    expect(lien.contains(khung())).toBe(true);
  });

  it("ba bia: ba lan doi lien tiep khong lan nao lap lai bia vua hien", () => {
    render(<BiaTuDoi covers={[bia("nui-xa"), bia("hoa-dao"), bia("cau-go")]} {...LOI} />);
    let truoc = khung().className;
    for (let i = 0; i < 5; i++) {
      choDoiBia();
      const nay = khung().className;
      expect(nay, `lan doi ${i}`).not.toBe(truoc);
      truoc = nay;
      choDonXong();
    }
  });

  it("bia anh cua mot o hien ca tranh du phong lan anh", () => {
    render(<BiaTuDoi covers={[bia("nui-xa", "anh-1")]} {...LOI} />);
    expect(khung().className).toContain("bia--nui-xa");
    expect(khung().querySelector("img.bia__anh")?.getAttribute("src")).toBe("/m/anh-1");
  });
});
