// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AnswerForm, answerNote } from "@/components/seal/AnswerForm";

const { refresh, actionAnswer } = vi.hoisted(() => ({ refresh: vi.fn(), actionAnswer: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer }));

const T0 = new Date("2026-09-13T08:00:00.000Z");
const sau = (ms: number) => new Date(T0.getTime() + ms);
const o = () => screen.getByLabelText<HTMLInputElement>("Câu trả lời");
const nut = () => screen.getByRole<HTMLButtonElement>("button", { name: "Mở trang" });

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  refresh.mockClear();
  actionAnswer.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("answerNote", () => {
  it("dang cho thi so phut con cho, khong thi loi cua lan gui kem so lan con lai", () => {
    expect(answerNote({ remaining: 5, lockedUntil: null }, T0, null)).toBe("Còn 5 lần");
    expect(answerNote({ remaining: 4, lockedUntil: null }, T0, "Chưa đúng.")).toBe("Chưa đúng. Còn 4 lần");
    expect(answerNote({ remaining: 0, lockedUntil: sau(570_000) }, T0, "Chưa đúng.")).toBe("Thử lại sau 10 phút");
    expect(answerNote({ remaining: 0, lockedUntil: sau(1000) }, T0, null)).toBe("Thử lại sau 1 phút");
  });
});

describe("AnswerForm", () => {
  it("hien cac goi y da mo va so lan con lai, o tra loi mo; ngoai ra khong co chu nao", () => {
    const { container } = render(
      <AnswerForm seal={{ id: "s1", hints: ["Có xe khách"], remaining: 3, lockedUntil: null }} now={T0} onNote={() => {}} />,
    );
    expect(screen.getByText("Gợi ý 1")).toBeTruthy();
    expect(screen.getByText("Có xe khách")).toBeTruthy();
    expect(container.querySelector(".con-lan")?.textContent).toBe("Còn 3 lần");
    expect(o().disabled).toBe(false);
    expect(container.textContent).toBe("Gợi ý 1Có xe kháchCâu trả lờiMở trangCòn 3 lần");
  });

  it("dang cho: khoa o va nut, chi hien thoi gian con cho, khong noi dieu luat; het cho thi lam moi tu may chu", () => {
    const { container } = render(
      <AnswerForm seal={{ id: "s1", hints: [], remaining: 0, lockedUntil: sau(570_000) }} now={T0} onNote={() => {}} />,
    );
    expect(o().disabled).toBe(true);
    expect(nut().disabled).toBe(true);
    expect(container.querySelector(".con-lan")?.textContent).toBe("Thử lại sau 10 phút");
    expect(container.textContent).toBe("Câu trả lờiMở trangThử lại sau 10 phút");
    expect(container.querySelector("[aria-live]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(569_000);
    });
    expect(refresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("dang gui: o tra loi chi readOnly nen khong mat focus, chi nut bi khoa; xong thi hien loi va mo lai o", async () => {
    let xong: (ket: { error: string }) => void = () => {};
    actionAnswer.mockImplementation(
      () =>
        new Promise<{ error: string }>((r) => {
          xong = r;
        }),
    );
    const { container } = render(
      <AnswerForm seal={{ id: "s1", hints: [], remaining: 3, lockedUntil: null }} now={T0} onNote={() => {}} />,
    );
    fireEvent.change(o(), { target: { value: "sai" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form.tra-loi") as HTMLFormElement);
    });
    expect(actionAnswer).toHaveBeenCalledWith("s1", expect.any(FormData));
    expect(o().readOnly).toBe(true);
    expect(o().disabled).toBe(false);
    expect(nut().disabled).toBe(true);
    await act(async () => {
      xong({ error: "Chưa đúng." });
    });
    expect(container.querySelector(".con-lan")?.textContent).toBe("Chưa đúng. Còn 3 lần");
    expect(o().readOnly).toBe(false);
    expect(nut().disabled).toBe(false);
  });

  it("bao cho vung thong bao so phut luc bat dau cho; router.refresh dua now moi cung khong doi chu bao", () => {
    const onNote = vi.fn();
    const seal = { id: "s1", hints: [], remaining: 0, lockedUntil: sau(600_000) };
    const { container, rerender } = render(<AnswerForm seal={seal} now={T0} onNote={onNote} />);
    expect(onNote).toHaveBeenLastCalledWith("Thử lại sau 10 phút");
    act(() => {
      vi.advanceTimersByTime(240_000);
    });
    rerender(<AnswerForm seal={seal} now={sau(240_000)} onNote={onNote} />);
    expect(container.querySelector(".con-lan")?.textContent).toBe("Thử lại sau 6 phút");
    expect(onNote).toHaveBeenCalledTimes(1);
  });
});
