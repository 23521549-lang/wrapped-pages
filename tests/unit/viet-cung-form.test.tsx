// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BookForm } from "@/components/book/BookForm";
import { XoaCuon } from "@/components/viet-cung/XoaCuon";

/*
 * Giao dien Sach moi, Sua sach cua sach viet cung (5c muc F, D): lua chon thu ba "Viết cùng", nhan "Chủ đề", ghi chu loi
 * moi, dong khoa cua sach viet cung, muc Xoa cuon bon trang thai.
 */

const { actionCreateBook, actionUpdateBook, actionDeNghiXoa, actionRutLai, actionTraLoi } = vi.hoisted(() => ({
  actionCreateBook: vi.fn(async (_fd: FormData) => ({ error: "Chưa tạo được." })),
  actionUpdateBook: vi.fn(async (_bookId: string, _fd: FormData) => ({ error: "Chưa lưu được." })),
  actionDeNghiXoa: vi.fn(async (_bookId: string) => undefined as { error: string } | undefined),
  actionRutLai: vi.fn(async (_bookId: string) => undefined as { error: string } | undefined),
  actionTraLoi: vi.fn(async (_bookId: string, _dongY: boolean) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionCreateBook, actionUpdateBook }));
vi.mock("@/app/actions/viet-cung", () => ({ actionDeNghiXoa, actionRutLai, actionTraLoi }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const SACH = { id: "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a", title: "Chạy bộ mùa thu", mode: "chia-se" as const, cover: "nui-xa" as const, youtubeId: null, coverMediaId: null };

afterEach(() => {
  cleanup();
  for (const f of [actionCreateBook, actionUpdateBook, actionDeNghiXoa, actionRutLai, actionTraLoi]) f.mockClear();
});

describe("Sach moi: lua chon Viet cung", () => {
  it("ba lua chon; chon Viet cung thi o ten thanh Chu de, nut thanh Tao va moi, form gui viet-cung", async () => {
    render(<BookForm book={null} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} />);
    const cheDo = screen.getAllByRole("radio").filter((r) => r.getAttribute("name") === "mode");
    expect(cheDo.map((r) => r.getAttribute("value"))).toEqual(["chia-se", "rieng-tu", "viet-cung"]);
    expect(screen.getByLabelText("Tên sách")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Viết cùng Linh" }));
    expect(screen.getByLabelText("Chủ đề")).toBeTruthy();
    expect(screen.getByText("Tên chung của cuốn, hiện trên kệ. Mỗi lượt đăng sẽ có tên riêng.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Chủ đề"), { target: { value: "Những bữa sáng" } });
    const nut = screen.getByRole("button", { name: "Tạo và mời Linh" });
    await waitFor(() => expect((nut as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(nut);
    });
    expect(actionCreateBook).toHaveBeenCalledTimes(1);
    const fd = actionCreateBook.mock.calls[0][0];
    expect([fd.get("title"), fd.get("mode")]).toEqual(["Những bữa sáng", "viet-cung"]);
    expect(screen.getByText("Linh sẽ thấy lời mời ở Kệ sách. Trước khi Linh nhận lời, cuốn nằm ở kệ của bạn như sách chia sẻ.")).toBeTruthy();
  });
});

describe("Sua sach: sach mot nguoi viet", () => {
  it("chon Viet cung hien ghi chu gui loi moi, noi voi radio qua aria-describedby", () => {
    render(<BookForm book={SACH} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} />);
    expect(document.querySelector(".ghi-chung")).toBeNull();
    const radio = screen.getByRole("radio", { name: "Viết cùng Linh" });
    fireEvent.click(radio);
    const ghi = document.querySelector(".ghi-chung") as HTMLElement;
    expect(ghi.textContent).toContain("Bấm Lưu là gửi lời mời.");
    expect(radio.getAttribute("aria-describedby")?.split(" ")).toContain(ghi.id);
  });

  it("dang moi: Viet cung chon san, ghi Da moi; nguoi kia dang xin: ghi chu dang xin", () => {
    const { unmount } = render(<BookForm book={SACH} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} deNghi={{ loai: "moi-viet", cuaToi: true }} />);
    expect((screen.getByRole("radio", { name: "Viết cùng Linh" }) as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector(".ghi-chung")?.textContent).toContain("Đã mời Linh.");
    unmount();
    render(<BookForm book={SACH} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} deNghi={{ loai: "xin-viet", cuaToi: false }} />);
    expect((screen.getByRole("radio", { name: "Chia sẻ" }) as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector(".ghi-chung")?.textContent).toContain("Linh đang xin viết cùng cuốn này.");
  });
});

describe("Sua sach: sach viet cung", () => {
  it("o ten la Chu de, khong co radio, dong khoa, form gui che do chia se", async () => {
    render(<BookForm book={SACH} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} vietCung />);
    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(screen.getByLabelText("Chủ đề")).toBeTruthy();
    expect(document.querySelector(".khoa-chung")?.textContent).toContain("Viết cùng Linh.");
    await waitFor(() => expect((screen.getByRole("button", { name: "Lưu" }) as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    });
    expect(actionUpdateBook.mock.calls[0][1].get("mode")).toBe("chia-se");
  });
});

describe("XoaCuon", () => {
  it("chua ai de nghi: De nghi xoa goi action", async () => {
    render(<XoaCuon bookId={SACH.id} partnerNickname="Linh" deNghi="khong" headingId="xoa" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Đề nghị xóa" }));
    });
    expect(actionDeNghiXoa).toHaveBeenCalledWith(SACH.id);
  });

  it("minh da de nghi: Rut de nghi goi action rut", async () => {
    render(<XoaCuon bookId={SACH.id} partnerNickname="Linh" deNghi="cua-toi" headingId="xoa" />);
    expect(screen.getByText("Bạn đã đề nghị xóa.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rút đề nghị" }));
    });
    expect(actionRutLai).toHaveBeenCalledWith(SACH.id);
  });

  it("nguoi kia de nghi: Dong y xoa hoi lai, Thoi duoc focus, Esc dong va tra focus; Xoa han moi goi action; Giu lai tu choi", async () => {
    render(<XoaCuon bookId={SACH.id} partnerNickname="Linh" deNghi="cua-kia" headingId="xoa" />);
    const dongY = screen.getByRole("button", { name: "Đồng ý xóa" });
    fireEvent.click(dongY);
    const hop = screen.getByRole("group", { name: "Xóa hẳn cuốn này?" });
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Thôi"));
    fireEvent.keyDown(hop, { key: "Escape" });
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.activeElement).toBe(dongY);
    fireEvent.click(dongY);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xóa hẳn" }));
    });
    expect(actionTraLoi).toHaveBeenCalledWith(SACH.id, true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Giữ lại" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(SACH.id, false);
  });

  it("loi cua action hien bang form__loi", async () => {
    actionDeNghiXoa.mockResolvedValueOnce({ error: "Cuốn này đang có một đề nghị chờ trả lời." });
    render(<XoaCuon bookId={SACH.id} partnerNickname="Linh" deNghi="khong" headingId="xoa" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Đề nghị xóa" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Cuốn này đang có một đề nghị chờ trả lời.");
  });
});
