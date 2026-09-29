// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { GoChu } from "@/components/book/GoChu";

/*
 * GoChu: chu hien dan tung ky tu theo nhip --dur-go (18ms; jsdom khong co token nen dung mac dinh), con tro nhap nhay
 * ngay sau ky tu cuoi. Trinh doc man hinh doc ban day du mot lan (chu an), phan dang go an voi no. Go xong, con tro
 * nhay them mot chu ky --dur-nhay (1000ms) roi chi con chu thuong.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GoChu", () => {
  it("go tung ky tu, co con tro; ban day du nam trong chu an; xong thi con chu thuong", () => {
    const { container } = render(<p><GoChu chu="Mưa" /></p>);
    const p = container.querySelector("p") as HTMLElement;
    expect(p.querySelector(".sr-only")?.textContent).toBe("Mưa");
    const hien = () => p.querySelector('[aria-hidden="true"]')?.textContent;
    expect(hien()).toBe("");
    expect(p.querySelector(".con-tro")).not.toBeNull();
    act(() => vi.advanceTimersByTime(18));
    expect(hien()).toBe("M");
    act(() => vi.advanceTimersByTime(36));
    expect(hien()).toBe("Mưa");
    expect(p.querySelector(".con-tro")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(p.innerHTML).toBe("Mưa");
  });

  it("go ra giua chung thi khong con hen gio nao chay", () => {
    const { unmount } = render(<p><GoChu chu="Một đoạn dài" /></p>);
    act(() => vi.advanceTimersByTime(40));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
