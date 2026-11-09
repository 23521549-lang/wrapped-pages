// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaiDatChip } from "@/components/linh-vat/CaiDatChip";
import { DANG_CHIP, DANG_CHIP_MAP } from "@/lib/cam-xuc";

/*
 * Muc "Chíp" o Cai dat: ba lua chon hinh dang (ga con, blob xanh, dai bang) kem anh xem truoc, lua chon theo dung dang
 * da luu, bam la doi ngay tai cho va goi action voi dang moi; cau mo ta trung tinh voi form, noi ro form chi la dien
 * mao luc ranh.
 */

const { actionCaiDatChip, actionXoaChip } = vi.hoisted(() => ({
  actionCaiDatChip: vi.fn(async (_dat: unknown): Promise<void> => {}),
  actionXoaChip: vi.fn(async (): Promise<void> => {}),
}));
vi.mock("@/app/actions/chip", () => ({ actionCaiDatChip, actionXoaChip }));

afterEach(() => {
  cleanup();
  actionCaiDatChip.mockClear();
});

const o = (ten: string) => screen.getByRole("radio", { name: new RegExp(ten) }) as HTMLInputElement;

describe("muc Chip o Cai dat: chon hinh dang", () => {
  it("ba lua chon co anh xem truoc dung, dang da luu duoc chon san", () => {
    const { container } = render(<CaiDatChip an={false} tuNoi={true} dang="blob" tenKia="Linh" />);
    // Ten hien thi phai dung ba ten da chot, khong lay ten mac dinh "Chíp" cua ga con.
    expect(["Gà con", "Blob xanh", "Đại bàng"]).toEqual(DANG_CHIP.map((d) => DANG_CHIP_MAP[d].ten));
    for (const d of ["ga-con", "blob", "dai-bang"] as const) {
      expect(o(DANG_CHIP_MAP[d].ten).checked).toBe(d === "blob");
      expect(container.querySelector(`img[src="${DANG_CHIP_MAP[d].anhTinh}"]`)).not.toBeNull();
    }
    expect(container.textContent).toContain("Chíp là bạn nhỏ");
    expect(container.textContent).not.toContain("bạn gà con");
    expect(container.textContent).toContain("lúc rảnh");
  });

  it("bam mot dang khac la doi ngay tai cho va goi action voi dang moi", async () => {
    render(<CaiDatChip an={false} tuNoi={true} dang="ga-con" tenKia="Linh" />);
    await act(async () => {
      fireEvent.click(o("Đại bàng"));
    });
    expect(o("Đại bàng").checked).toBe(true);
    expect(actionCaiDatChip).toHaveBeenCalledWith({ dang: "dai-bang" });
  });
});
