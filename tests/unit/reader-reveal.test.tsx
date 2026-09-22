// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { Reader, type ReaderProps } from "@/components/reader/Reader";
import type { DocJson } from "@/lib/doc/types";
import { ritualKey } from "@/lib/seal/reader";
import type { ReaderSeal } from "@/lib/seal/types";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => {}) }));
vi.mock("@/app/actions/seal", () => ({
  actionAnswer: vi.fn(async () => ({ error: "" })),
  actionGiftKey: vi.fn(async () => ({ error: "" })),
}));

const T0 = new Date("2026-09-13T08:00:00.000Z");

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

let giam = false;

/** Man hep (che do mot trang); giam chuyen dong theo bien giam. */
function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG && giam, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Niem phong phu to 2, nguoi xem vua tu tra loi dung: may chu tra ritual true. */
const VUA_MO: ReaderSeal = {
  id: "s1", kind: "cau-do", firstPosition: 2, lastPosition: 2, mine: false, locked: false,
  question: "Ở đâu?", opensAt: null, hints: [], remaining: null, lockedUntil: null, openedAt: T0, ritual: true,
  giftNote: null, reply: null, answerCount: null, knocks: [],
};

const props = (sua: Partial<ReaderProps> = {}): ReaderProps => ({
  bookId: "b1", title: "Thu", sheets: [to("Mot"), to("Chu vua mo")], looks: [{ kind: "thuong" }, { kind: "thuong" }],
  seals: [VUA_MO], ownerName: "Linh", readerName: "Minh", now: T0, start: 1, revealAt: { index: 1, sealId: "s1" }, mark: 0, trackRead: false,
  mine: false, editedAt: [null, null], editHref: [null, null],
  ...sua,
});

beforeEach(() => {
  giam = false;
  vi.useFakeTimers();
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Reader: nghi thuc mo", () => {
  it("chay tren to dau cua niem phong va hien khung Da mo trang, ke ca duoi Strict Mode", () => {
    const { container } = render(<Reader {...props()} />, { reactStrictMode: true });
    expect(container.querySelector(".sach .con-tro")).not.toBeNull();
    expect(container.querySelector('.sach .giay-noi-dung[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("region", { name: "Đã mở trang" }).textContent)
      .toBe("Đã mở trangBạn trả lời đúng. Trang 2 vừa mở, Linh sẽ thấy trong nhật ký gõ cửa.");
    expect(sessionStorage.getItem(ritualKey("s1"))).toBe("1");
  });

  it("dung ma niem phong trang dua xuong, khong suy tu vi tri: niem phong o vi tri 5 van chay tren to revealAt.index", () => {
    const { container } = render(<Reader {...props({ seals: [{ ...VUA_MO, firstPosition: 5, lastPosition: 5 }] })} />);
    expect(container.querySelector(".sach .con-tro")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Đã mở trang" }).textContent)
      .toBe("Đã mở trangBạn trả lời đúng. Trang 5 vừa mở, Linh sẽ thấy trong nhật ký gõ cửa.");
    expect(sessionStorage.getItem(ritualKey("s1"))).toBe("1");
  });

  it("mot lan moi tab: gan lai man doc (tai lai, lui toi khi con trong 2 phut) thi hien thang, khong co khung Da mo trang", () => {
    render(<Reader {...props()} />);
    cleanup();
    const { container } = render(<Reader {...props()} />);
    expect(container.querySelector(".sach .con-tro")).toBeNull();
    expect(container.querySelector(".sach .chua-go")).toBeNull();
    expect(container.querySelector(".sach")?.textContent).toContain("Chu vua mo");
    expect(screen.queryByRole("region", { name: "Đã mở trang" })).toBeNull();
  });

  it("revealAt null (chu sach, tang chia khoa, mo gia, qua 2 phut) thi khong co nghi thuc, khong co khung, khong ghi sessionStorage", () => {
    const { container } = render(<Reader {...props({ revealAt: null, seals: [{ ...VUA_MO, ritual: false }] })} />);
    expect(container.querySelector(".sach .con-tro")).toBeNull();
    expect(screen.queryByRole("region", { name: "Đã mở trang" })).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("trao doi: khung Da mo trang noi da gui trang tra loi", () => {
    render(<Reader {...props({ seals: [{ ...VUA_MO, kind: "trao-doi", question: "Em nghĩ gì?", reply: to("Tra loi") }] })} />);
    expect(screen.getByRole("region", { name: "Đã mở trang" }).textContent)
      .toBe("Đã mở trangBạn đã gửi trang trả lời. Trang 2 vừa mở cho cả hai người.");
  });

  it("giam chuyen dong: hien thang, van co khung Da mo trang va focus ve vung sach", () => {
    giam = true;
    const { container } = render(<Reader {...props()} />);
    expect(container.querySelector(".sach .con-tro")).toBeNull();
    expect(screen.getByRole("region", { name: "Đã mở trang" })).toBeTruthy();
    expect(document.activeElement).toBe(container.querySelector(".doc__khung"));
  });
});
