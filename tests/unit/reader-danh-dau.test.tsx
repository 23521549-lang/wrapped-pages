// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { Reader, type ReaderProps } from "@/components/reader/Reader";
import type { DocJson } from "@/lib/doc/types";

/*
 * Ghi to da xem cua man doc. Luat: mot khung chi duoc ghi khi nguoi doc DUNG lai tren no du CHO_MS; lat nhanh qua
 * thi khong tinh la da doc, va cung khong duoc coi la da ghi - quay lai to do roi dung lai van phai gui len may chu.
 */
const CHO_MS = 600;

const { lamMoi, router, danhDau } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { lamMoi: refresh, router: { refresh }, danhDau: vi.fn(async () => {}) };
});

// Router phai la MOT doi tuong duy nhat qua moi lan ve. Tra ve doi tuong moi o moi lan ve thi hieu ung don dep cua
// Reader chay lai lien tuc va tu gui khung dang hen, che mat dung loi dang kiem o day.
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: danhDau }));
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
  danhDau.mockClear();
  lamMoi.mockClear();
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

describe("Reader: ghi to da xem", () => {
  it("khung dung yen du thoi gian cho thi duoc gui dung mot lan", () => {
    render(<Reader {...props()} />);
    expect(danhDau).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    expect(danhDau.mock.calls).toEqual([["b1", 1, 1]]);
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    expect(danhDau.mock.calls).toEqual([["b1", 1, 1]]);
  });

  it("lat nhanh qua mot to roi quay lai va dung lai: to do van duoc gui", () => {
    const { container } = render(<Reader {...props()} />);
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    // To 2 chi luot qua (chua het thoi gian cho da lat tiep), to 3 thi dung lai.
    lat(container, "Trang sau");
    lat(container, "Trang sau");
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    // Quay lai to 2 va doc that su.
    lat(container, "Trang trước");
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    expect(danhDau.mock.calls).toEqual([["b1", 1, 1], ["b1", 3, 3], ["b1", 2, 2]]);
  });

  it("khung may chu bao da ghi tu truoc thi khong goi lai", () => {
    render(<Reader {...props({ seen: [1] })} />);
    act(() => {
      vi.advanceTimersByTime(CHO_MS);
    });
    expect(danhDau).not.toHaveBeenCalled();
  });

  it("roi man doc luc khung con dang hen: gui ngay roi moi lam moi trang vua toi", async () => {
    const { unmount } = render(<Reader {...props()} />);
    expect(danhDau).not.toHaveBeenCalled();
    unmount();
    expect(danhDau.mock.calls).toEqual([["b1", 1, 1]]);
    expect(lamMoi).not.toHaveBeenCalled();
    await act(async () => {});
    expect(lamMoi).toHaveBeenCalledTimes(1);
  });
});
