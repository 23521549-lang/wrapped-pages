// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaiDatKhoangLang } from "@/components/feed/CaiDatKhoangLang";

/*
 * Muc "Khoang Lang" o Cai dat: o danh dau theo co da luu, doi ngay tai cho khi bam, may chu luu trong nen. Cau chu
 * phai noi dung nhung gi xay ra: du lieu VAN con, tat la hien lai day du NHU MOI NHAT (khong phai anh chup luc bat),
 * nen khong duoc hua "khong luu gi". Ten nguoi kia khong xuat hien o day (Q2): cau chu chi noi "noi dung cua chinh ban".
 */

const { actionKhoangLang } = vi.hoisted(() => ({
  actionKhoangLang: vi.fn(async (_an: boolean): Promise<{ error: string } | { ok: true }> => ({ ok: true })),
}));
vi.mock("@/app/actions/feed", () => ({ actionKhoangLang }));

afterEach(() => {
  cleanup();
  actionKhoangLang.mockClear();
});

const o = () => screen.getByRole("checkbox", { name: "Bật Khoảng Lặng" }) as HTMLInputElement;

/** Bam o danh dau roi cho lan chuyen cua useTransition chay xong, de khong con cap nhat nao ngoai act(). */
async function bam() {
  await act(async () => {
    fireEvent.click(o());
  });
}

describe("muc Khoang Lang o Cai dat", () => {
  it("o danh dau theo dung co da luu", () => {
    render(<CaiDatKhoangLang an={true} />);
    expect(o().checked).toBe(true);
  });

  it("chua bat thi o danh dau trong", () => {
    render(<CaiDatKhoangLang an={false} />);
    expect(o().checked).toBe(false);
  });

  it("bam la doi ngay tai cho va goi action voi gia tri moi", async () => {
    render(<CaiDatKhoangLang an={false} />);
    await bam();
    expect(o().checked).toBe(true);
    expect(actionKhoangLang).toHaveBeenCalledWith(true);
  });

  it("bam lan nua thi tat lai, va goi action voi false", async () => {
    render(<CaiDatKhoangLang an={true} />);
    await bam();
    expect(o().checked).toBe(false);
    expect(actionKhoangLang).toHaveBeenLastCalledWith(false);
  });

  it("cau chu khong hua 'khong luu': du lieu van con, tat la hien lai nhu moi nhat", () => {
    const { container } = render(<CaiDatKhoangLang an={false} />);
    const chu = container.textContent ?? "";
    expect(chu).not.toMatch(/không lưu|khong luu/i);
    expect(chu).toContain("dữ liệu vẫn còn nguyên");
    expect(chu).toContain("như mới nhất");
  });

  it("cau chu khong neu ten nguoi kia (Q2)", () => {
    const { container } = render(<CaiDatKhoangLang an={false} />);
    const chu = container.textContent ?? "";
    expect(chu).not.toContain("Linh");
    expect(chu).not.toContain("Mạnh");
    expect(chu).not.toContain("người kia");
  });

  it("luu that bai: hoan nguyen o danh dau va noi ra loi", async () => {
    actionKhoangLang.mockResolvedValueOnce({ error: "Chưa lưu được lựa chọn này. Thử lại nhé." });
    render(<CaiDatKhoangLang an={false} />);
    await bam();
    // Khong de nguoi dung tuong minh da bat trong khi chua bat duoc.
    expect(o().checked).toBe(false);
    expect(screen.getByText("Chưa lưu được lựa chọn này. Thử lại nhé.")).toBeDefined();
  });

  it("action nem loi khi mat mang: hoan nguyen o danh dau va noi ra loi, khong vang trang loi", async () => {
    actionKhoangLang.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<CaiDatKhoangLang an={false} />);
    await bam();
    expect(o().checked).toBe(false);
    expect(screen.getByText("Chưa lưu được lựa chọn này. Thử lại nhé.")).toBeDefined();
  });

  it("luu lai duoc sau mot lan that bai: loi cu bien di", async () => {
    actionKhoangLang.mockResolvedValueOnce({ error: "Chưa lưu được lựa chọn này. Thử lại nhé." });
    render(<CaiDatKhoangLang an={false} />);
    await bam();
    await bam();
    expect(o().checked).toBe(true);
    expect(screen.queryByText("Chưa lưu được lựa chọn này. Thử lại nhé.")).toBeNull();
  });

  it("tieu de muc khong qua 20 ky tu, va khong co dau gach dai trong chu hien cho nguoi dung", () => {
    const { container } = render(<CaiDatKhoangLang an={false} />);
    const tieuDe = screen.getByRole("heading", { level: 2 }).textContent ?? "";
    expect([...tieuDe].length).toBeLessThanOrEqual(20);
    expect(container.textContent).not.toContain("—");
  });
});
