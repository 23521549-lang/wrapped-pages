// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GiftKeyForm } from "@/components/seal/GiftKeyForm";
import { KnockLog } from "@/components/seal/KnockLog";

const { actionGiftKey } = vi.hoisted(() => ({ actionGiftKey: vi.fn() }));
vi.mock("@/app/actions/seal", () => ({ actionGiftKey }));

const NOW = new Date("2026-09-13T14:00:00+07:00");
const tang = () => screen.getByRole<HTMLButtonElement>("button", { name: "Tặng chìa khóa" });

afterEach(() => {
  cleanup();
  actionGiftKey.mockReset();
});

describe("KnockLog", () => {
  it("moi nhat o tren; moi dong co chuoi go, ai, luc nao, dung hay sai", () => {
    render(
      <KnockLog
        partner="Mạnh"
        now={NOW}
        knocks={[
          { guess: "quán cà phê", correct: false, at: new Date("2026-09-12T21:02:00+07:00") },
          { guess: "Quán Mây", correct: true, at: new Date("2026-09-13T07:41:00+07:00") },
        ]}
      />,
    );
    const ds = screen.getByRole("list", { name: "Nhật ký gõ cửa" });
    expect(Array.from(ds.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "M“Quán Mây”Mạnh · hôm nay, 07:41Đúng",
      "M“quán cà phê”Mạnh · hôm qua, 21:02Sai",
    ]);
  });

  it("chua ai go thi noi ro, khong ve danh sach rong", () => {
    render(<KnockLog partner="Mạnh" now={NOW} knocks={[]} />);
    expect(screen.getByText("Chưa ai gõ cửa.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("GiftKeyForm", () => {
  it("mo form ngay tai cho va dua focus vao o loi nhan; De sau thi tra focus ve nut", () => {
    render(<GiftKeyForm sealId="s1" partner="Mạnh" range="trang 2" />);
    fireEvent.click(tang());
    const o = screen.getByLabelText<HTMLTextAreaElement>("Lời nhắn cho Mạnh");
    expect(document.activeElement).toBe(o);
    expect(screen.getByText("Không bắt buộc. Mạnh đọc được trang 2 ngay khi bạn tặng.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(document.activeElement).toBe(tang());
  });

  it("dang gui: o loi nhan chi readOnly, nut khoa; loi cu khong hien lai khi mo lai form", async () => {
    let xong: (ket: { error: string }) => void = () => {};
    actionGiftKey.mockImplementation(
      () =>
        new Promise<{ error: string }>((r) => {
          xong = r;
        }),
    );
    const { container } = render(<GiftKeyForm sealId="s1" partner="Mạnh" range="trang 2" />);
    fireEvent.click(tang());
    await act(async () => {
      fireEvent.submit(container.querySelector("form.tang-khoa") as HTMLFormElement);
    });
    expect(actionGiftKey).toHaveBeenCalledWith("s1", expect.any(FormData));
    const o = screen.getByLabelText<HTMLTextAreaElement>("Lời nhắn cho Mạnh");
    expect(o.readOnly).toBe(true);
    expect(o.disabled).toBe(false);
    expect(tang().disabled).toBe(true);
    await act(async () => {
      xong({ error: "Chưa tặng được chìa khóa." });
    });
    expect(screen.getByRole("alert").textContent).toBe("Chưa tặng được chìa khóa.");
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    fireEvent.click(tang());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
