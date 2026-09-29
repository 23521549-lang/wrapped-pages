// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { Reader, type ReaderProps } from "@/components/reader/Reader";
import type { DocJson } from "@/lib/doc/types";

/*
 * Trang dang doc do (spec 5a muc F1): khung dung yen o mot trang du LUU_MS thi man doc luu trang trai cua khung, voi ca
 * sach cua minh lan cua nguoi kia. Lat nhanh qua thi khong luu; trang may chu da luu thi khong gui lai.
 */
const LUU_MS = 1200;

const { router, luu } = vi.hoisted(() => ({
  router: { refresh: vi.fn() },
  luu: vi.fn(async (_bookId: string, _position: number) => undefined),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => []), actionSavePosition: luu }));
vi.mock("@/app/actions/seal", () => ({
  actionAnswer: vi.fn(async () => ({ error: "" })),
  actionGiftKey: vi.fn(async () => ({ error: "" })),
}));

const T0 = new Date("2026-09-13T08:00:00.000Z");

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

const props = (sua: Partial<ReaderProps> = {}): ReaderProps => ({
  bookId: "b1", title: "Thu", sheets: [to("Mot"), to("Hai"), to("Ba")],
  looks: [{ kind: "thuong" }, { kind: "thuong" }, { kind: "thuong" }],
  seals: [], ownerName: "Linh", readerName: "Minh", now: T0, start: 0, revealAt: null, seen: [], trackRead: true,
  mine: false, editedAt: [null, null, null], editHref: [null, null, null],
  ...sua,
});

type HoatAnhGia = { onfinish: (() => void) | null; cancel(): void };

let hoatAnh: HoatAnhGia[] = [];

/** Man hep (che do mot trang, moi khung dung mot to) va luon giam chuyen dong (duong "mo chong" cua Flipbook). */
function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Lat mot khung roi cho hoat anh ket thuc, de khung moi dung yen va Reader nhan duoc khung do. */
function lat(container: HTMLElement, nhan: "Trang sau" | "Trang trước"): void {
  const nut = container.querySelector<HTMLButtonElement>(`button[aria-label="${nhan}"]`);
  if (!nut) throw new Error(`khong thay nut ${nhan}`);
  const truoc = hoatAnh.length;
  fireEvent.click(nut);
  if (hoatAnh.length !== truoc + 1) throw new Error(`bam ${nhan} ma khong lat`);
  act(() => {
    hoatAnh[hoatAnh.length - 1].onfinish?.();
  });
}

beforeEach(() => {
  hoatAnh = [];
  luu.mockClear();
  vi.useFakeTimers();
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Element.prototype.animate = ((..._args: unknown[]) => {
    const a: HoatAnhGia = { onfinish: null, cancel() {} };
    hoatAnh.push(a);
    return a as unknown as Animation;
  }) as typeof Element.prototype.animate;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const cho = (ms: number) => act(() => {
  vi.advanceTimersByTime(ms);
});

describe("Reader: luu trang dang doc do", () => {
  it("khung dung yen du LUU_MS thi luu trang cua khung, dung mot lan", () => {
    render(<Reader {...props()} />);
    cho(LUU_MS - 1);
    expect(luu).not.toHaveBeenCalled();
    cho(1);
    expect(luu.mock.calls).toEqual([["b1", 1]]);
    cho(LUU_MS * 3);
    expect(luu.mock.calls).toEqual([["b1", 1]]);
  });

  it("trang may chu da luu thi khong gui lai; lat qua nhanh khong luu, dung lai thi luu", () => {
    const { container } = render(<Reader {...props({ start: 1, lastPosition: 2 })} />);
    cho(LUU_MS);
    expect(luu).not.toHaveBeenCalled();
    lat(container, "Trang sau");
    cho(LUU_MS - 100);
    lat(container, "Trang trước");
    cho(LUU_MS);
    expect(luu).not.toHaveBeenCalled();
    lat(container, "Trang sau");
    cho(LUU_MS);
    expect(luu.mock.calls).toEqual([["b1", 3]]);
  });

  it("sach cua minh cung luu", () => {
    render(<Reader {...props({ trackRead: false, mine: true, start: 2 })} />);
    cho(LUU_MS);
    expect(luu.mock.calls).toEqual([["b1", 3]]);
  });

  it("roi man doc truoc LUU_MS thi khong luu; luu hong thi im lang", async () => {
    const { unmount } = render(<Reader {...props()} />);
    cho(LUU_MS - 1);
    unmount();
    cho(LUU_MS);
    expect(luu).not.toHaveBeenCalled();
    luu.mockRejectedValueOnce(new Error("mat mang"));
    render(<Reader {...props()} />);
    cho(LUU_MS);
    await act(async () => {});
    expect(luu.mock.calls).toEqual([["b1", 1]]);
  });
});
