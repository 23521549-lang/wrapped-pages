// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SaveBadge } from "@/components/editor/SaveBadge";

/*
 * Vuot tran ky tu thi canh bao chiem cho trang thai luu. Vung aria-live phai la CUNG mot the p qua
 * moi lan doi, de trinh doc man hinh chi doc khi chu doi: luc vua vuot tran, va luc lui ve duoi tran.
 */

const CANH_BAO = "Vượt 20 000 ký tự, nháp không lưu được. Đăng bớt trang rồi viết tiếp.";

afterEach(() => {
  cleanup();
});

describe("SaveBadge kem canh bao vuot tran", () => {
  it("chua co trang thai va khong vuot tran thi khong ve gi", () => {
    const { container } = render(<SaveBadge status={null} warning={null} onRetry={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("vuot tran roi lui ve: cung mot vung aria-live, chu doi theo, khong con nut Thu lai khi dang vuot", () => {
    const onRetry = vi.fn();
    const loi = { kind: "loi", message: "Bản nháp đã vượt quá 20.000 chữ." } as const;
    const { container, rerender } = render(<SaveBadge status={loi} warning={null} onRetry={onRetry} />);
    const vung = container.querySelector("p");
    expect(vung?.getAttribute("aria-live")).toBe("polite");
    expect(vung?.className).toBe("luu luu--loi");

    rerender(<SaveBadge status={loi} warning={CANH_BAO} onRetry={onRetry} />);
    expect(container.querySelector("p")).toBe(vung);
    expect(vung?.className).toBe("luu dem-chu dem-chu--tran");
    expect(vung?.textContent).toBe(`!${CANH_BAO}`);
    expect(vung?.querySelector(".dau-loi")?.getAttribute("aria-hidden")).toBe("true");
    expect(vung?.querySelector("button")).toBeNull();

    rerender(<SaveBadge status={{ kind: "chua-luu" }} warning={null} onRetry={onRetry} />);
    expect(container.querySelector("p")).toBe(vung);
    expect(vung?.className).toBe("luu");
    expect(vung?.textContent).toBe("Chưa lưu");
  });

  it("vuot tran khi chua tung luu van hien canh bao", () => {
    const { container } = render(<SaveBadge status={null} warning={CANH_BAO} onRetry={() => {}} />);
    expect(container.querySelector("p")?.textContent).toBe(`!${CANH_BAO}`);
  });

  it("khong vuot tran thi giu nguyen trang thai loi kem nut Thu lai", () => {
    const onRetry = vi.fn();
    const { getByRole } = render(<SaveBadge status={{ kind: "loi", message: "Mất kết nối." }} warning={null} onRetry={onRetry} />);
    fireEvent.click(getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
