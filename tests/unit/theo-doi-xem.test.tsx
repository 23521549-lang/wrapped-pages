// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

/*
 * TheoDoiXem: vung cuon Hoat dong tinh mot dong Moi (li[data-moi]) la da xem khi dong nam trong khung nhin (it nhat mot
 * nua) lien tuc --dur-moi-xem (1 giay; jsdom khong co token nen dung mac dinh), hay khi con tro, focus vao dong. Da xem
 * thi dong mang lop da-xem ngay (CSS cho dau tan), id gom lai va gui mot lan sau 800ms. Tab an thi khong tinh.
 */

const { actionSeenActivity } = vi.hoisted(() => ({ actionSeenActivity: vi.fn(async () => ({ ok: true as const })) }));
vi.mock("@/app/actions/feed", () => ({ actionSeenActivity }));

import { TheoDoiXem } from "@/components/feed/TheoDoiXem";

type Muc = { target: Element; isIntersecting: boolean; intersectionRatio: number };
let bao: ((ds: Muc[]) => void) | null = null;
let tuyChon: IntersectionObserverInit | undefined;
const dangTheoDoi = new Set<Element>();

beforeEach(() => {
  vi.useFakeTimers();
  bao = null;
  dangTheoDoi.clear();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(f: (ds: Muc[]) => void, o?: IntersectionObserverInit) {
      bao = f;
      tuyChon = o;
    }
    observe(e: Element) {
      dangTheoDoi.add(e);
    }
    unobserve(e: Element) {
      dangTheoDoi.delete(e);
    }
    disconnect() {
      dangTheoDoi.clear();
    }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  actionSeenActivity.mockClear();
  Reflect.deleteProperty(document, "visibilityState");
});

const ve = (moi = "a b") => render(
  <TheoDoiXem moi={moi}>
    <ol>
      <li data-moi="" data-id="a"><button type="button">Một</button></li>
      <li data-moi="" data-id="b"><button type="button">Hai</button></li>
      <li><button type="button">Của bạn</button></li>
    </ol>
  </TheoDoiXem>,
);

const dong = (c: HTMLElement, id: string) => c.querySelector(`li[data-id="${id}"]`) as HTMLElement;
const thay = (target: Element, ratio: number) => act(() => bao?.([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }]));

describe("TheoDoiXem", () => {
  it("la vung cuon co nhan va nhan focus; chi theo doi dong Moi, khung nhin la cua so (vung cuon cat san)", () => {
    const { container } = ve();
    const vung = container.querySelector("section.hoat-dong__cuon");
    expect(vung?.getAttribute("aria-label")).toBe("Hoạt động gần đây");
    expect(vung?.getAttribute("tabindex")).toBe("0");
    expect([...dangTheoDoi].map((e) => e.getAttribute("data-id"))).toEqual(["a", "b"]);
    expect(tuyChon?.root ?? null).toBeNull();
  });

  it("nam trong khung du 1 giay moi tinh; roi khung truoc do hay chi lo duoi mot nua thi khong tinh", async () => {
    const { container } = ve();
    const [a, b] = [dong(container, "a"), dong(container, "b")];
    thay(a, 1);
    thay(b, 0.3);
    act(() => vi.advanceTimersByTime(999));
    expect(a.classList.contains("da-xem")).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(a.classList.contains("da-xem")).toBe(true);
    expect(dangTheoDoi.has(a)).toBe(false);
    thay(b, 0.6);
    act(() => vi.advanceTimersByTime(500));
    thay(b, 0);
    act(() => vi.advanceTimersByTime(2000));
    expect(b.classList.contains("da-xem")).toBe(false);
    expect(actionSeenActivity.mock.calls).toEqual([[["a"]]]);
  });

  it("con tro hay focus vao dong thi tinh ngay; cac dong gom mot lan gui sau 800ms", () => {
    const { container } = ve();
    fireEvent.pointerOver(dong(container, "b").querySelector("button") as HTMLElement);
    expect(dong(container, "b").classList.contains("da-xem")).toBe(true);
    // Luc dau tan xong (--dur-moi-tan, jsdom dung mac dinh 3 giay): ke khong tu lam moi truoc luc do.
    expect(Number(dong(container, "b").dataset.tan)).toBe(Date.now() + 3000);
    fireEvent.focusIn(dong(container, "a").querySelector("button") as HTMLElement);
    fireEvent.pointerOver(container.querySelector("li:not([data-moi]) button") as HTMLElement);
    act(() => vi.advanceTimersByTime(799));
    expect(actionSeenActivity).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(actionSeenActivity.mock.calls).toEqual([[["b", "a"]]]);
  });

  it("tab dang an thi nam trong khung khong tinh; hien lai thi quan sat lai tu dau", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const { container } = ve();
    const a = dong(container, "a");
    thay(a, 1);
    act(() => vi.advanceTimersByTime(1500));
    expect(a.classList.contains("da-xem")).toBe(false);
    dangTheoDoi.clear();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect([...dangTheoDoi].map((e) => e.getAttribute("data-id"))).toEqual(["a", "b"]);
  });

  it("gui loi (mat mang) thi bo qua, khong nem; go vung cuon khi con id cho gui thi gui ngay", async () => {
    actionSeenActivity.mockRejectedValueOnce(new Error("mat mang"));
    const { container, unmount } = ve();
    fireEvent.pointerOver(dong(container, "a").querySelector("button") as HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.pointerOver(dong(container, "b").querySelector("button") as HTMLElement);
    unmount();
    expect(actionSeenActivity.mock.calls).toEqual([[["a"]], [["b"]]]);
  });
});
