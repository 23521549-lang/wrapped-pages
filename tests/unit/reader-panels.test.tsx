// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { Reader } from "@/components/reader/Reader";
import type { DocJson } from "@/lib/doc/types";
import type { ReaderSeal } from "@/lib/seal/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => {}) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer: vi.fn(), actionGiftKey: vi.fn() }));

const T0 = new Date("2026-09-13T08:00:00.000Z");

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

/** Giam chuyen dong luon khop (lat bang mo chong, hoat anh gia); man hep nen mot trang. */
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

let hoatAnh: { onfinish: (() => void) | null; cancel(): void }[] = [];

const henGio: ReaderSeal = {
  id: "s1", kind: "hen-gio", firstPosition: 2, lastPosition: 2, mine: true, locked: true,
  question: null, opensAt: new Date(T0.getTime() + 30_000), hints: [], remaining: null, lockedUntil: null,
  openedAt: null, ritual: false, giftNote: null, reply: null, answerCount: null, knocks: [],
};

const ve = (start: number) => (
  <Reader
    bookId="b1"
    title="Thu"
    sheets={[to("Mot"), to("Hai"), to("Ba")]}
    looks={[{ kind: "thuong" }, { kind: "khoa", teaser: null }, { kind: "thuong" }]}
    seals={[henGio]}
    ownerName="Linh"
    readerName="Mạnh"
    now={T0}
    start={start}
    revealAt={null}
    mark={0}
    trackRead={false}
  />
);

/** Bam nut lat roi cho hoat anh gia ket thuc, khung moi dung yen. */
function lat(ten: "Trang sau" | "Trang trước") {
  fireEvent.click(screen.getByRole("button", { name: ten }));
  const a = hoatAnh[hoatAnh.length - 1];
  act(() => {
    a.onfinish?.();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  hoatAnh = [];
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Element.prototype.animate = (() => {
    const a = { onfinish: null, cancel() {} };
    hoatAnh.push(a);
    return a as unknown as Animation;
  }) as typeof Element.prototype.animate;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Reader: khung thu thach duoi sach", () => {
  it("chi ve khung cua niem phong phu to dang hien", () => {
    render(ve(0));
    expect(screen.queryByRole("region", { name: "Hẹn giờ" })).toBeNull();
    lat("Trang sau");
    expect(screen.getByRole("region", { name: "Hẹn giờ" })).toBeTruthy();
    lat("Trang sau");
    expect(screen.queryByRole("region", { name: "Hẹn giờ" })).toBeNull();
  });

  it("lat di 20 giay roi lat ve: dong ho dem theo lech do mot lan luc mo man doc", () => {
    const { container } = render(ve(1));
    expect(screen.getByRole("region", { name: "Hẹn giờ" })).toBeTruthy();
    lat("Trang sau");
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    lat("Trang trước");
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(Array.from(container.querySelectorAll(".dem-nguoc__so")).map((e) => e.textContent)).toEqual(["0", "00", "00", "10"]);
  });
});
