// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { ShownSheetsProvider } from "@/components/reader/ShownSheets";
import { CacLuot, type LuotMucLuc } from "@/components/viet-cung/CacLuot";
import { TenLuotForm } from "@/components/viet-cung/TenLuotForm";
import { XinViet } from "@/components/viet-cung/XinViet";

/* Man doc va man Sua luot cua sach viet cung (5c muc G, H3): muc luc Cac luot, nut Xin viet cung, o ten luot. */

const { actionXinViet, actionRutLai, actionTraLoi, actionDoiTenLuot } = vi.hoisted(() => ({
  actionXinViet: vi.fn(async (_b: string) => undefined as { error: string } | undefined),
  actionRutLai: vi.fn(async (_b: string) => undefined as { error: string } | undefined),
  actionTraLoi: vi.fn(async (_b: string, _d: boolean) => undefined as { error: string } | undefined),
  actionDoiTenLuot: vi.fn(async (_b: string, _r: string, _t: string) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/viet-cung", () => ({ actionXinViet, actionRutLai, actionTraLoi, actionDoiTenLuot }));
vi.mock("next/link", () => ({
  default: ({ href, children, scroll: _scroll, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const LUOT: LuotMucLuc[] = [
  { id: "l1", ordinal: 1, ten: "Mưa phùn đầu ngõ", first: 1, last: 1, ai: "Linh", hoiDap: "Thương ghê" },
  { id: "l2", ordinal: 2, ten: null, first: 2, last: 3, ai: "Mạnh", hoiDap: null },
];

afterEach(() => {
  cleanup();
  for (const f of [actionXinViet, actionRutLai, actionTraLoi, actionDoiTenLuot]) f.mockClear();
});

describe("CacLuot", () => {
  it("moi luot mot lien ket toi trang dau, ten luot hay Luot N, nguoi viet va trang", () => {
    render(<ShownSheetsProvider start={1}><CacLuot bookId={SACH} luot={LUOT} /></ShownSheetsProvider>);
    const lk = screen.getAllByRole("link");
    expect(lk.map((a) => a.getAttribute("href"))).toEqual([`/sach/${SACH}?trang=1`, `/sach/${SACH}?trang=2`]);
    expect(lk.map((a) => a.textContent)).toEqual(["1Mưa phùn đầu ngõLinh, trang 1", "2Lượt 2Mạnh, trang 2"]);
    expect(screen.getByText("2 lượt, hai người viết")).toBeTruthy();
  });

  it("luot dang mo theo to dang hien: aria-current; loi hoi dap cu chi hien khi luot do dang mo", () => {
    const { unmount } = render(<ShownSheetsProvider start={1}><CacLuot bookId={SACH} luot={LUOT} /></ShownSheetsProvider>);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("aria-current"))).toEqual([null, "true"]);
    expect(screen.queryByText("Thương ghê")).toBeNull();
    unmount();
    render(<ShownSheetsProvider start={0}><CacLuot bookId={SACH} luot={LUOT} /></ShownSheetsProvider>);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("aria-current"))).toEqual(["true", null]);
    expect(screen.getByText("Thương ghê")).toBeTruthy();
  });
});

describe("XinViet", () => {
  it("chua xin: hoi lai roi moi gui", async () => {
    render(<XinViet bookId={SACH} chu="Linh" trangThai="khong" />);
    fireEvent.click(screen.getByRole("button", { name: "Xin viết cùng" }));
    expect(actionXinViet).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Gửi lời xin tới Linh?" }).textContent).toContain("Linh đồng ý thì cuốn sang kệ Hai Ngòi Bút");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gửi lời xin" }));
    });
    expect(actionXinViet).toHaveBeenCalledWith(SACH);
  });

  it("da xin: dong cho va Rut loi xin", async () => {
    render(<XinViet bookId={SACH} chu="Linh" trangThai="da-xin" />);
    expect(screen.getByText("Đã xin, chờ Linh")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rút lời xin" }));
    });
    expect(actionRutLai).toHaveBeenCalledWith(SACH);
  });

  it("duoc moi: Nhan loi va Tu choi goi traLoi", async () => {
    render(<XinViet bookId={SACH} chu="Linh" trangThai="duoc-moi" />);
    expect(screen.getByText("Linh mời bạn viết cùng cuốn này.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận lời" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(SACH, true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(SACH, false);
  });
});

describe("TenLuotForm", () => {
  it("luot chua ten: goi y Luot N; de trong ma luu thi nhac va focus ve o, khong goi action", () => {
    render(<TenLuotForm bookId={SACH} roundId="l2" ordinal={2} ten={null} />);
    const o = screen.getByLabelText("Tên lượt") as HTMLInputElement;
    expect(o.placeholder).toBe("Lượt 2");
    fireEvent.click(screen.getByRole("button", { name: "Lưu tên" }));
    expect(screen.getByRole("alert").textContent).toBe("Đặt tên cho lượt này nhé.");
    expect(o.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(o);
    expect(actionDoiTenLuot).not.toHaveBeenCalled();
  });

  it("co ten: gui ten da gom khoang trang, bao Da luu ten", async () => {
    render(<TenLuotForm bookId={SACH} roundId="l1" ordinal={1} ten="Mưa" />);
    fireEvent.change(screen.getByLabelText("Tên lượt"), { target: { value: "  Mưa   phùn " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lưu tên" }));
    });
    expect(actionDoiTenLuot).toHaveBeenCalledWith(SACH, "l1", "Mưa phùn");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Đã lưu tên."));
  });
});
