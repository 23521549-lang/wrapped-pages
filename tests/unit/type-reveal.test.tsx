// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { TypeReveal } from "@/components/seal/TypeReveal";
import type { DocJson } from "@/lib/doc/types";

/** 11 ky tu: "Xin " 4, "chao" 4 (dam), "anh" 3. */
const DOC: DocJson = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Xin " }, { type: "text", text: "chào", marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "anh" }] },
  ],
};
const DU = "Xin chàoanh";

let giam = false;

function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG && giam, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

/** Chu dang hien cho mat: bo phan chua go (.chua-go). */
function hien(c: HTMLElement): string {
  const ban = c.cloneNode(true) as HTMLElement;
  for (const el of ban.querySelectorAll(".chua-go")) el.remove();
  return ban.textContent ?? "";
}

beforeEach(() => {
  giam = false;
  vi.useFakeTimers();
  window.matchMedia = matchMediaGia;
  // Token o dang ban build da minify, va khac gia tri du phong (18ms, 1000ms): test hong neu JS bo qua token
  // hay doc bang parseFloat.
  document.documentElement.style.setProperty("--dur-go", ".05s");
  document.documentElement.style.setProperty("--dur-nhay", ".3s");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute("style");
});

describe("TypeReveal", () => {
  it("nhip go doc tu token --dur-go (.05s): 50ms mot ky tu, du chu luon nam trong DOM, con tro ngay sau ky tu vua go, aria-busy khi dang go", () => {
    const onDone = vi.fn();
    const { container } = render(<TypeReveal doc={DOC} author="Linh" onDone={onDone} />);
    const vung = container.querySelector(".giay-noi-dung");
    expect(hien(container)).toBe("");
    expect(container.textContent).toBe(DU);
    expect(vung?.getAttribute("aria-busy")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(50 * 6);
    });
    expect(hien(container)).toBe("Xin ch");
    expect(container.textContent).toBe(DU);
    expect(container.querySelector("strong .con-tro")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(hien(container)).toBe("Xin ch");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("go het thi bo aria-busy, con tro nhap nhay them mot chu ky --dur-nhay (.3s) roi moi xong, bao xong mot lan", () => {
    const onDone = vi.fn();
    const { container } = render(<TypeReveal doc={DOC} author="Linh" onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(50 * 11);
    });
    expect(hien(container)).toBe(DU);
    expect(container.querySelector(".chua-go")).toBeNull();
    expect(container.querySelector(".con-tro")).not.toBeNull();
    expect(container.querySelector(".giay-noi-dung")?.getAttribute("aria-busy")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".con-tro")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("bam chuot o bat cu dau thi hien het ngay", () => {
    const onDone = vi.fn();
    const { container } = render(<TypeReveal doc={DOC} author="Linh" onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerDown(document.body);
    expect(hien(container)).toBe(DU);
    expect(container.querySelector(".chua-go")).toBeNull();
    expect(container.querySelector(".con-tro")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("bam phim thi hien het ngay", () => {
    const onDone = vi.fn();
    const { container } = render(<TypeReveal doc={DOC} author="Linh" onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(hien(container)).toBe(DU);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("xong thi dua focus vao vung sach khi focus dang o body; khong cuop focus dang o cho khac", () => {
    const { container, unmount } = render(<section className="doc__khung" tabIndex={-1}><TypeReveal doc={DOC} author="Linh" /></section>);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(document.activeElement).toBe(container.querySelector(".doc__khung"));
    unmount();

    const lan2 = render(
      <>
        <input aria-label="O khac" />
        <section className="doc__khung" tabIndex={-1}><TypeReveal doc={DOC} author="Linh" /></section>
      </>,
    );
    const o = lan2.getByLabelText("O khac");
    o.focus();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerDown(document.body);
    expect(document.activeElement).toBe(o);
  });

  it("giam chuyen dong thi hien thang: khong go, khong con tro, khong aria-busy, van bao xong va dua focus vao vung sach", () => {
    giam = true;
    const onDone = vi.fn();
    const { container } = render(<section className="doc__khung" tabIndex={-1}><TypeReveal doc={DOC} author="Linh" onDone={onDone} /></section>);
    expect(hien(container)).toBe(DU);
    expect(container.querySelector(".chua-go")).toBeNull();
    expect(container.querySelector(".con-tro")).toBeNull();
    expect(container.querySelector(".giay-noi-dung")?.getAttribute("aria-busy")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(container.querySelector(".doc__khung"));
  });
});
