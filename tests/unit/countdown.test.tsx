// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Countdown } from "@/components/seal/Countdown";
import { ClockSkew, THU_LAI_MS } from "@/components/seal/useTimeLeft";

const T0 = new Date("2026-09-13T08:00:00.000Z");
const sau = (ms: number) => new Date(T0.getTime() + ms);
const so = (c: HTMLElement) => Array.from(c.querySelectorAll(".dem-nguoc__so")).map((e) => e.textContent);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Countdown", () => {
  it("ve ngay gio phut giay tu dong ho may chu ngay lan dau; gio phut giay luon hai chu so", () => {
    const { container } = render(<Countdown opensAt={sau(86_400_000 + 3_723_000)} now={T0} onDone={() => {}} />);
    expect(so(container)).toEqual(["1", "01", "02", "03"]);
    expect(container.querySelector("[role=timer]")?.getAttribute("aria-label")).toBe("Thời gian còn lại tới lúc mở");
  });

  it("hen gio xa nhat (3653 ngay) ve du bon chu so ngay", () => {
    const { container } = render(<Countdown opensAt={sau(3653 * 86_400_000)} now={T0} onDone={() => {}} />);
    expect(so(container)).toEqual(["3653", "00", "00", "00"]);
  });

  it("dem xuong moi giay; cham 0 thi goi onDone mot lan, van con thi goi lai sau THU_LAI_MS chu khong lien tuc", () => {
    const onDone = vi.fn();
    const { container } = render(<Countdown opensAt={sau(3000)} now={T0} onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(so(container)).toEqual(["0", "00", "00", "02"]);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(so(container)).toEqual(["0", "00", "00", "00"]);
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(THU_LAI_MS - 1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("dong ho may nguoi doc nhanh hon may chu mot phut: van dem theo may chu, khong ve 0 som", () => {
    vi.setSystemTime(sau(60_000));
    const onDone = vi.fn();
    const { container } = render(<Countdown opensAt={sau(30_000)} now={T0} onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(so(container)[3]).toBe("29");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("khung go ra roi gan lai sau 20 giay van dem theo lech do luc dau cua man doc, khong tinh thoi gian da o tren trang", () => {
    const lech = { current: 0 };
    const onDone = vi.fn();
    const ve = () => (
      <ClockSkew value={lech}>
        <Countdown opensAt={sau(30_000)} now={T0} onDone={onDone} />
      </ClockSkew>
    );
    render(ve()).unmount();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    const { container } = render(ve());
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(so(container)[3]).toBe("10");
    expect(onDone).not.toHaveBeenCalled();
  });
});
