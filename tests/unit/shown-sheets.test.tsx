// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GIAM_CHUYEN_DONG, MAN_RONG } from "@/components/reader/Flipbook";
import { Reader, type ReaderProps } from "@/components/reader/Reader";
import { ShownSheetsProvider, useShownRange } from "@/components/reader/ShownSheets";
import type { DocJson } from "@/lib/doc/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => {}) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer: vi.fn(), actionGiftKey: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * Trang thai to dang hien song o ShownSheetsProvider: Reader (qua onShow cua Flipbook) ghi, cot phai doc. Ngoai provider,
 * Reader van chay voi state rieng nhu truoc (cac bai kiem Reader cu khong boc provider).
 */

const NOW = new Date("2026-09-22T01:00:00.000Z");
let rong = false;
let hoatAnh: { onfinish: (() => void) | null; cancel(): void }[] = [];

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG || (rong && query === MAN_RONG), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function props(start = 0): ReaderProps {
  return {
    bookId: "b1", title: "Thu", sheets: [to("Mot"), to("Hai"), to("Ba")],
    looks: [{ kind: "thuong" }, { kind: "thuong" }, { kind: "thuong" }], seals: [],
    ownerName: "Linh", readerName: "Mạnh", now: NOW, start, revealAt: null, seen: [], trackRead: false,
    mine: false, editedAt: [null, null, null], editHref: [null, null, null],
  };
}

/** Cot phai gia: in khoang to dang hien, hay "ngoai" khi khong nam trong provider. */
function CotPhai() {
  const shown = useShownRange();
  return <p data-testid="cot-phai">{shown ? `${shown.first}-${shown.last}` : "ngoai"}</p>;
}

function lat(ten: "Trang sau" | "Trang trước") {
  fireEvent.click(screen.getByRole("button", { name: ten }));
  const a = hoatAnh[hoatAnh.length - 1];
  act(() => {
    a.onfinish?.();
  });
}

const cot = () => screen.getByTestId("cot-phai").textContent;

beforeEach(() => {
  rong = false;
  hoatAnh = [];
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Element.prototype.animate = (() => {
    const a = { onfinish: null, cancel() {} };
    hoatAnh.push(a);
    return a as unknown as Animation;
  }) as typeof Element.prototype.animate;
});

afterEach(cleanup);

describe("ShownSheetsProvider", () => {
  it("mot trang: cot phai theo dung to Reader dang hien, ke ca khi lat", () => {
    render(<ShownSheetsProvider start={0}><Reader {...props()} /><CotPhai /></ShownSheetsProvider>);
    expect(cot()).toBe("1-1");
    lat("Trang sau");
    expect(cot()).toBe("2-2");
    lat("Trang sau");
    lat("Trang trước");
    expect(cot()).toBe("2-2");
  });

  it("hai trang: cot phai nhan to dau va to cuoi co that; khung cuoi mot to thi chi to do", () => {
    rong = true;
    render(<ShownSheetsProvider start={0}><Reader {...props()} /><CotPhai /></ShownSheetsProvider>);
    expect(cot()).toBe("1-2");
    lat("Trang sau");
    expect(cot()).toBe("3-3");
  });

  it("lan ve dau (chua co onShow) da dung to mo dau", () => {
    render(<ShownSheetsProvider start={2}><CotPhai /></ShownSheetsProvider>);
    expect(cot()).toBe("3-3");
  });

  it("ngoai provider: cot phai la null, Reader van lat binh thuong voi state rieng", () => {
    render(<><Reader {...props()} /><CotPhai /></>);
    expect(cot()).toBe("ngoai");
    lat("Trang sau");
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeTruthy();
  });
});
