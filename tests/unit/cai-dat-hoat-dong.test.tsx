// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaiDatHoatDong } from "@/components/feed/CaiDatHoatDong";

/*
 * Muc "Hoat dong" o Cai dat (06/10): o danh dau theo co da luu, doi ngay tai cho khi bam, may chu luu trong nen. Cau chu
 * phai noi dung nhung gi xay ra: may chu VAN ghi dong, chi khong hien no, nen khong duoc hua "khong luu gi ve ban".
 */

const { actionAnHoatDong } = vi.hoisted(() => ({
  actionAnHoatDong: vi.fn(async (_an: boolean): Promise<{ error: string } | { ok: true }> => ({ ok: true })),
}));
vi.mock("@/app/actions/feed", () => ({ actionAnHoatDong }));

afterEach(() => {
  cleanup();
  actionAnHoatDong.mockClear();
});

const o = () => screen.getByRole("checkbox", { name: "Ẩn hoạt động của tôi" }) as HTMLInputElement;

/** Bam o danh dau roi cho lan chuyen cua useTransition chay xong, de khong con cap nhat nao ngoai act(). */
async function bam() {
  await act(async () => {
    fireEvent.click(o());
  });
}

describe("muc Hoat dong o Cai dat", () => {
  it("o danh dau theo dung co da luu, va cau chu goi ten nguoi kia", () => {
    const { container } = render(<CaiDatHoatDong an={true} tenKia="Linh" />);
    expect(o().checked).toBe(true);
    expect(container.textContent).toContain("Linh");
  });

  it("chua an thi o danh dau trong", () => {
    render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    expect(o().checked).toBe(false);
  });

  it("bam la doi ngay tai cho va goi action voi gia tri moi", async () => {
    render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    await bam();
    expect(o().checked).toBe(true);
    expect(actionAnHoatDong).toHaveBeenCalledWith(true);
  });

  it("bam lan nua thi tat lai, va goi action voi false", async () => {
    render(<CaiDatHoatDong an={true} tenKia="Linh" />);
    await bam();
    expect(o().checked).toBe(false);
    expect(actionAnHoatDong).toHaveBeenLastCalledWith(false);
  });

  it("cau chu khong hua 'khong luu': may chu van ghi dong, chi khong hien", () => {
    const { container } = render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    const chu = container.textContent ?? "";
    expect(chu).not.toMatch(/không lưu|khong luu/i);
    expect(chu).toContain("Những dòng đã có vẫn còn.");
  });

  it("luu that bai: hoan nguyen o danh dau va noi ra loi", async () => {
    actionAnHoatDong.mockResolvedValueOnce({ error: "Chưa lưu được lựa chọn này. Thử lại nhé." });
    render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    await bam();
    // Khong de nguoi dung tuong minh da an trong khi chua an duoc.
    expect(o().checked).toBe(false);
    expect(screen.getByText("Chưa lưu được lựa chọn này. Thử lại nhé.")).toBeDefined();
  });

  it("luu lai duoc sau mot lan that bai: loi cu bien di", async () => {
    actionAnHoatDong.mockResolvedValueOnce({ error: "Chưa lưu được lựa chọn này. Thử lại nhé." });
    render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    await bam();
    await bam();
    expect(o().checked).toBe(true);
    expect(screen.queryByText("Chưa lưu được lựa chọn này. Thử lại nhé.")).toBeNull();
  });

  it("tieu de muc khong qua 20 ky tu, va khong co dau gach dai trong chu hien cho nguoi dung", () => {
    const { container } = render(<CaiDatHoatDong an={false} tenKia="Linh" />);
    const tieuDe = screen.getByRole("heading", { level: 2 }).textContent ?? "";
    expect([...tieuDe].length).toBeLessThanOrEqual(20);
    expect(container.textContent).not.toContain("—");
  });
});
