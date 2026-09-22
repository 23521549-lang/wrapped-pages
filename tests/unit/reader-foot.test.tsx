// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GIAM_CHUYEN_DONG, MAN_RONG } from "@/components/reader/Flipbook";
import { Reader, type ReaderProps } from "@/components/reader/Reader";
import type { DocJson } from "@/lib/doc/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => {}) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer: vi.fn(), actionGiftKey: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/** 15:00 ngay 13.09 gio Viet Nam. */
const NOW = new Date("2026-09-13T08:00:00.000Z");
/** 14:05 cung ngay gio Viet Nam. */
const SUA = new Date("2026-09-13T07:05:00.000Z");
const BOOK = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const SUA_1 = `/sach/${BOOK}/sua-luot/1`;
const SUA_3 = `/sach/${BOOK}/sua-luot/2?trang=2`;

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

let rong = false;

/** Giam chuyen dong luon khop (lat bang mo chong, hoat anh gia); MAN_RONG khop khi rong. */
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

let hoatAnh: { onfinish: (() => void) | null; cancel(): void }[] = [];

function props(p: Partial<ReaderProps> = {}): ReaderProps {
  return {
    bookId: BOOK, title: "Thu", sheets: [to("Mot"), to("Hai"), to("Ba")],
    looks: [{ kind: "thuong" }, { kind: "thuong" }, { kind: "thuong" }], seals: [],
    ownerName: "Linh", readerName: "Mạnh", now: NOW, start: 0, revealAt: null, mark: 0, trackRead: false,
    mine: true, editedAt: [null, null, null], editHref: [SUA_1, null, SUA_3], ...p,
  };
}

function lat(ten: "Trang sau" | "Trang trước") {
  fireEvent.click(screen.getByRole("button", { name: ten }));
  const a = hoatAnh[hoatAnh.length - 1];
  act(() => {
    a.onfinish?.();
  });
}

const lienKetSua = () => document.querySelectorAll('a[href*="/sua-luot/"]');

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Reader: dai ghi chu duoi cuon sach", () => {
  it("chu sach: to sua duoc co lien ket Sua trang toi man sua luot, to niem phong con dong chi co dong chu kem o khoa an", () => {
    render(<Reader {...props()} />);
    const nut = screen.getByRole("link", { name: "Sửa trang 1" });
    expect(nut.getAttribute("href")).toBe(SUA_1);
    lat("Trang sau");
    expect(screen.getByText("Đang niêm phong, chưa sửa được")).toBeTruthy();
    expect(lienKetSua()).toHaveLength(0);
    expect(document.querySelector(".trang-ghi__khoa svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("nguoi kia: thay Da sua luc voi time day du, khong co lien ket sua nao", () => {
    render(<Reader {...props({ mine: false, editHref: [null, null, null], editedAt: [SUA, null, null] })} />);
    const time = document.querySelector(".trang-ghi__sua time");
    expect(time?.getAttribute("dateTime")).toBe(SUA.toISOString());
    expect(time?.textContent).toBe("Đã sửa lúc 14:05");
    expect(lienKetSua()).toHaveLength(0);
  });

  it("nguoi kia, khong to nao da sua: khong co dai trong", () => {
    const { container } = render(<Reader {...props({ mine: false, editHref: [null, null, null] })} />);
    expect(container.querySelector("ul.trang-ghi")).toBeNull();
    expect(container.querySelector(".doc__chan")).toBeNull();
  });

  it("chu sach luon co dai", () => {
    const { container } = render(<Reader {...props()} />);
    expect(container.querySelector("ul.trang-ghi")).not.toBeNull();
  });

  it("hai trang, khung cuoi mot to: hai li, li thu hai rong, ul co nhan", () => {
    rong = true;
    const { container } = render(<Reader {...props({ start: 2 })} />);
    const ul = container.querySelector("ul.trang-ghi");
    expect(ul?.getAttribute("aria-label")).toBe("Ghi chú trang đang mở");
    const li = ul?.querySelectorAll(":scope > li") ?? [];
    expect(li).toHaveLength(2);
    expect(li[0].textContent).toContain("Sửa trang 3");
    expect(li[0].querySelector("a")?.getAttribute("href")).toBe(SUA_3);
    expect(li[1].childElementCount).toBe(0);
  });

  it("nhan gio dung now truyen vao, khong dung dong ho may", () => {
    vi.useFakeTimers({ now: new Date("2030-01-01T00:00:00.000Z") });
    render(<Reader {...props({ editedAt: [SUA, null, null] })} />);
    expect(document.querySelector(".trang-ghi__sua time")?.textContent).toBe("Đã sửa lúc 14:05");
  });
});
