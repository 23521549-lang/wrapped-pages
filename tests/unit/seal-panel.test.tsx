// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SealPanel } from "@/components/seal/SealPanel";
import type { ReaderSeal } from "@/lib/seal/types";

const { actionAnswer } = vi.hoisted(() => ({ actionAnswer: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer, actionGiftKey: vi.fn() }));

const T0 = new Date("2026-09-13T08:00:00.000Z");
const sau = (ms: number) => new Date(T0.getTime() + ms);
const niem = (sua: Partial<ReaderSeal>): ReaderSeal => ({
  id: "s1", kind: "cau-do", firstPosition: 1, lastPosition: 1, mine: false, locked: true,
  question: "Ở đâu?", opensAt: null, hints: [], remaining: 1, lockedUntil: null, openedAt: null, ritual: false,
  giftNote: null, reply: null, answerCount: null, knocks: [], ...sua,
});
const ve = (s: ReaderSeal, now = T0) => <SealPanel seal={s} bookId="b1" ownerName="Linh" readerName="Mạnh" now={now} />;
const conLan = (c: HTMLElement) => c.querySelector(".con-lan")?.textContent;

async function guiSai(c: HTMLElement) {
  fireEvent.change(screen.getByLabelText("Câu trả lời"), { target: { value: "sai" } });
  await act(async () => {
    fireEvent.submit(c.querySelector("form.tra-loi") as HTMLFormElement);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  actionAnswer.mockReset();
  actionAnswer.mockResolvedValue({ error: "Chưa đúng." });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SealPanel: cau do cua nguoi kia", () => {
  it("het cho thi khong con hien loi cua lan sai truoc", async () => {
    const { container, rerender } = render(ve(niem({})));
    await guiSai(container);
    expect(conLan(container)).toBe("Chưa đúng. Còn 1 lần");
    rerender(ve(niem({ remaining: 0, lockedUntil: sau(600_000) })));
    expect(conLan(container)).toBe("Thử lại sau 10 phút");
    rerender(ve(niem({ remaining: 5, lockedUntil: null })));
    expect(conLan(container)).toBe("Còn 5 lần");
  });

  it("mot vung thong bao dung yen: bao ket qua gui, luc bat dau va luc het cho, khong bao lai moi phut", async () => {
    const { container, rerender } = render(ve(niem({})));
    const vung = screen.getByRole("status");
    expect(container.querySelectorAll("[aria-live], [role=status], [role=alert], output")).toHaveLength(1);
    expect(vung.textContent).toBe("Còn 1 lần");
    await guiSai(container);
    expect(vung.textContent).toBe("Chưa đúng. Còn 1 lần");
    rerender(ve(niem({ remaining: 0, lockedUntil: sau(600_000) })));
    expect(screen.getByRole("status")).toBe(vung);
    expect(vung.textContent).toBe("Thử lại sau 10 phút");
    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    rerender(ve(niem({ remaining: 0, lockedUntil: sau(600_000) }), sau(180_000)));
    expect(conLan(container)).toBe("Thử lại sau 7 phút");
    expect(vung.textContent).toBe("Thử lại sau 10 phút");
    rerender(ve(niem({ remaining: 5, lockedUntil: null }), sau(600_000)));
    expect(screen.getByRole("status")).toBe(vung);
    expect(vung.textContent).toBe("Còn 5 lần");
  });

  it("nguoi kia khong thay nhat ky go cua", () => {
    render(ve(niem({ hints: ["Trên trời có"] })));
    expect(screen.getByRole("region", { name: "Câu đố" })).toBeTruthy();
    expect(screen.queryByText("Nhật ký gõ cửa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tặng chìa khóa" })).toBeNull();
  });
});

describe("SealPanel: cac khung khac", () => {
  it("hen gio cua chu sach: dong ho va gio mo, khong co nut tang chia khoa", () => {
    render(ve(niem({ kind: "hen-gio", mine: true, question: null, opensAt: sau(90_000), remaining: null })));
    expect(screen.getByRole("region", { name: "Hẹn giờ" })).toBeTruthy();
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.getByText("Mở lúc 15:01, chủ nhật 13.09.2026")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tặng chìa khóa" })).toBeNull();
  });

  it("chu sach, cau do chua mo: nhat ky va nut tang chia khoa", () => {
    render(ve(niem({ mine: true, locked: false, remaining: null, answerCount: 2, hints: ["Trên trời có"] })));
    const khung = screen.getByRole("region", { name: "Câu đố của bạn" });
    expect(khung.querySelector(".thu-thach__dau .meta")?.textContent).toBe("Trang 1 · 2 đáp án · 1 gợi ý · Mạnh chưa mở được");
    expect(screen.getByText("Chưa ai gõ cửa.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tặng chìa khóa" })).toBeTruthy();
  });

  it("chu sach, cau do nguoi kia da mo: thay luc mo va nhat ky, khong con form tang chia khoa", () => {
    const luc = sau(-60_000);
    render(ve(niem({ mine: true, locked: false, remaining: null, openedAt: luc, answerCount: 1, knocks: [{ guess: "Quán Mây", correct: true, at: luc }] })));
    const khung = screen.getByRole("region", { name: "Câu đố của bạn" });
    expect(khung.querySelector(".thu-thach__dau .meta")?.textContent).toBe("Trang 1 · 1 đáp án · 0 gợi ý · Mạnh đã mở, hôm nay, 14:59");
    expect(screen.getByRole("list", { name: "Nhật ký gõ cửa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tặng chìa khóa" })).toBeNull();
    expect(screen.queryByLabelText("Lời nhắn cho Mạnh")).toBeNull();
  });

  it("nguoi kia duoc tang chia khoa: luc mo va loi nhan", () => {
    render(ve(niem({ locked: false, remaining: null, openedAt: sau(-60_000), giftNote: "Cho em" })));
    const khung = screen.getByRole("region", { name: "Được tặng chìa khóa" });
    expect(khung.querySelector(".thu-thach__dau .meta")?.textContent).toBe("Linh mở trang 1 cho bạn, hôm nay, 14:59.");
    expect(khung.querySelector(".loi-nhan__chu")?.textContent).toBe("Cho em");
  });

  it("khong can khung thi khong ve gi", () => {
    const { container } = render(ve(niem({ locked: false, remaining: null, openedAt: sau(-60_000) })));
    expect(container.innerHTML).toBe("");
  });
});
