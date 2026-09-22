// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { DraftRemove } from "@/components/book/DraftRemove";

const { actionDeleteBook, actionDiscardDraft } = vi.hoisted(() => ({
  actionDeleteBook: vi.fn(async (_id: string): Promise<{ error: string } | undefined> => undefined),
  actionDiscardDraft: vi.fn(async (_id: string): Promise<{ error: string } | undefined> => undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionDeleteBook, actionDiscardDraft }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  actionDeleteBook.mockClear();
  actionDiscardDraft.mockClear();
});

function ve(hasPages: boolean) {
  render(
    <>
      <h1 id="tieu-de" tabIndex={-1}>Bản nháp</h1>
      <ul>
        <li>
          <DraftRemove bookId="b1" hasPages={hasPages} headingId="tieu-de">
            <Link href="/sach/b1/viet">Viết tiếp</Link>
          </DraftRemove>
        </li>
      </ul>
    </>,
  );
}

const nut = (ten: string) => screen.getByRole("button", { name: ten }) as HTMLButtonElement;

describe("DraftRemove", () => {
  it("sach chua dang: nut Xoa sach canh Viet tiep; bam thi hop hoi hien ngay trong the, Thoi duoc focus san", () => {
    const hoiXacNhan = vi.spyOn(window, "confirm");
    ve(false);
    expect(screen.getByRole("link", { name: "Viết tiếp" }).closest(".nhap__nut")).toBe(nut("Xóa sách").closest(".nhap__nut"));
    expect(screen.queryByRole("button", { name: "Bỏ bản nháp" })).toBeNull();
    expect(nut("Xóa sách").getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(nut("Xóa sách"));
    const hop = screen.getByRole("group", { name: "Xóa hẳn cuốn sách này?" });
    expect(hop.textContent).toContain("Xóa hẳn cuốn sách này?");
    expect(document.activeElement).toBe(nut("Thôi"));
    expect(nut("Xóa sách").getAttribute("aria-expanded")).toBe("true");
    expect(nut("Xóa sách").getAttribute("aria-controls")).toBe(hop.id);
    expect(hoiXacNhan).not.toHaveBeenCalled();
  });

  it("Esc hay Thoi dong hop, focus ve nut Xoa sach, khong goi action", () => {
    ve(false);
    fireEvent.click(nut("Xóa sách"));
    fireEvent.keyDown(nut("Thôi"), { key: "Escape" });
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.activeElement).toBe(nut("Xóa sách"));
    fireEvent.click(nut("Xóa sách"));
    fireEvent.click(nut("Thôi"));
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.activeElement).toBe(nut("Xóa sách"));
    expect(actionDeleteBook).not.toHaveBeenCalled();
  });

  it("Xoa: goi actionDeleteBook voi id cuon; xong thi focus ve tieu de trang (the se bien mat khi trang lam moi)", async () => {
    ve(false);
    fireEvent.click(nut("Xóa sách"));
    await act(async () => {
      fireEvent.click(nut("Xóa"));
    });
    expect(actionDeleteBook).toHaveBeenCalledWith("b1");
    expect(document.activeElement?.id).toBe("tieu-de");
  });

  it("may chu tu choi: cau loi trong hop, hop van mo; mat mang: Chua xoa duoc, thu lai", async () => {
    actionDeleteBook.mockResolvedValueOnce({ error: "Cuốn này đã có trang đăng nên không xóa được. Bạn vẫn bỏ được bản nháp." });
    actionDeleteBook.mockRejectedValueOnce(new Error("mat mang"));
    ve(false);
    fireEvent.click(nut("Xóa sách"));
    await act(async () => {
      fireEvent.click(nut("Xóa"));
    });
    expect(screen.getByRole("alert").textContent).toBe("Cuốn này đã có trang đăng nên không xóa được. Bạn vẫn bỏ được bản nháp.");
    await act(async () => {
      fireEvent.click(nut("Xóa"));
    });
    expect(screen.getByRole("alert").textContent).toBe("Chưa xóa được, thử lại.");
    expect(screen.getByRole("group", { name: "Xóa hẳn cuốn sách này?" })).toBeTruthy();
  });

  it("dang gui: hai nut trong hop khoa, Xoa bao ban", async () => {
    let xong!: () => void;
    actionDeleteBook.mockImplementationOnce(() => new Promise((ok) => { xong = () => ok(undefined); }));
    ve(false);
    fireEvent.click(nut("Xóa sách"));
    act(() => {
      fireEvent.click(nut("Xóa"));
    });
    expect([nut("Thôi").disabled, nut("Xóa").disabled, nut("Xóa").getAttribute("aria-busy")]).toEqual([true, true, "true"]);
    await act(async () => xong());
  });

  it("sach da co trang: Bo ban nhap, hoi Bo ban nhap nay?, nut Bo goi actionDiscardDraft", async () => {
    ve(true);
    expect(screen.queryByRole("button", { name: "Xóa sách" })).toBeNull();
    fireEvent.click(nut("Bỏ bản nháp"));
    expect(screen.getByRole("group", { name: "Bỏ bản nháp này?" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(nut("Bỏ"));
    });
    expect(actionDiscardDraft).toHaveBeenCalledWith("b1");
    expect(actionDeleteBook).not.toHaveBeenCalled();
  });
});
