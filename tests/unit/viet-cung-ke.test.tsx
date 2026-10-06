// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { ShelfBook } from "@/components/book/ShelfBook";
import { LoiMoi } from "@/components/viet-cung/LoiMoi";
import { NhanLoiThe } from "@/components/viet-cung/NhanLoiThe";

/* Ke sach cua sach viet cung (5c muc E): dong de nghi gui toi minh, the sach viet cung, dau cho nhan loi. */

const { actionTraLoi } = vi.hoisted(() => ({
  actionTraLoi: vi.fn(async (_bookId: string, _dongY: boolean) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/viet-cung", () => ({ actionTraLoi }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const A = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const B = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const C = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

afterEach(() => {
  cleanup();
  actionTraLoi.mockClear();
});

describe("LoiMoi", () => {
  it("khong co de nghi thi khong ve gi", () => {
    const { container } = render(<LoiMoi dong={[]} partnerNickname="Linh" />);
    expect(container.innerHTML).toBe("");
  });

  it("moi loai mot cau va hai nut dung; nut mang mo ta la cau cua dong", () => {
    render(<LoiMoi partnerNickname="Linh" dong={[
      { bookId: A, title: "Những bữa sáng", loai: "moi-viet" },
      { bookId: B, title: "Chạy bộ mùa thu", loai: "xin-viet" },
      { bookId: C, title: "Mưa", loai: "xoa-sach" },
    ]} />);
    const dong = [...document.querySelectorAll(".loi-moi")];
    expect(dong.map((d) => d.querySelector(".loi-moi__chu")?.textContent)).toEqual([
      "Linh mời bạn viết cùng Những bữa sáng", "Linh xin viết cùng Chạy bộ mùa thu", "Linh đề nghị xóa Mưa",
    ]);
    expect(dong.map((d) => [...d.querySelectorAll(".loi-moi__nut > button")].map((b) => b.textContent))).toEqual([
      ["Nhận lời", "Từ chối"], ["Đồng ý", "Từ chối"], ["Đồng ý xóa", "Giữ lại"],
    ]);
    const nhan = screen.getByRole("button", { name: "Nhận lời" });
    expect(document.getElementById(nhan.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Linh mời bạn viết cùng Những bữa sáng");
  });

  it("bam goi dung action; Dong y xoa phai hoi lai truoc", async () => {
    render(<LoiMoi partnerNickname="Linh" dong={[
      { bookId: A, title: "Những bữa sáng", loai: "moi-viet" },
      { bookId: C, title: "Mưa", loai: "xoa-sach" },
    ]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận lời" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(A, true);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Từ chối" })[0]);
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(A, false);
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý xóa" }));
    expect(actionTraLoi).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("group", { name: "Xóa hẳn Mưa?" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xóa hẳn" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(C, true);
  });

  it("loi cua action hien ngay duoi dong", async () => {
    actionTraLoi.mockResolvedValueOnce({ error: "Đề nghị này không còn nữa." });
    render(<LoiMoi partnerNickname="Linh" dong={[{ bookId: A, title: "Những bữa sáng", loai: "moi-viet" }]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận lời" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Đề nghị này không còn nữa.");
  });
});

describe("ShelfBook sach viet cung", () => {
  const coBan = { title: "Những bữa sáng", href: `/sach/${A}`, cover: "hoa-dao" as const, coverMediaId: null, pageCount: 4, when: "21.08", lockedCount: 0, isPrivate: false };

  it("hai chu cai dau o goc bia, so luot, Luot moi cua ten", () => {
    render(<ul><ShelfBook {...coBan} newCount={2} vietCung={{ doi: ["L", "M"], luot: 3, nguoiKia: "Linh" }} /></ul>);
    expect([...document.querySelectorAll(".cuon__doi span")].map((s) => s.textContent)).toEqual(["L", "M"]);
    expect(document.querySelector(".cuon__doi")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector(".cuon__phu")?.textContent).toBe("3 lượt, 21.08");
    expect(screen.getByText("Lượt mới của Linh")).toBeTruthy();
  });

  it("cuon cua minh dang cho nhan loi: dau Cho ten nhan loi; sach thuong khong co", () => {
    const { unmount } = render(<ul><ShelfBook {...coBan} newCount={0} choNhanLoi="Linh" /></ul>);
    expect(document.querySelector(".dh--cho")?.textContent).toBe("Chờ Linh nhận lời");
    expect(document.querySelector(".cuon__phu")?.textContent).toBe("4 trang, 21.08");
    unmount();
    render(<ul><ShelfBook {...coBan} newCount={0} /></ul>);
    expect(document.querySelector(".dh--cho")).toBeNull();
    expect(document.querySelector(".cuon__doi")).toBeNull();
  });

  it("nguoi kia dang moi minh: cau moi va hai nut, the giu nguyen dang the thuong", () => {
    render(<ul><ShelfBook {...coBan} newCount={0} moiToi={<NhanLoiThe bookId={A} ten="Linh" title="Những bữa sáng" />} /></ul>);
    expect(document.querySelector(".cuon__moi-chu")?.textContent).toBe("Linh mời bạn viết cùng");
    // Chua phai sach viet cung: khong muon truoc hai chu cai dau hay "N lượt".
    expect(document.querySelector(".cuon__doi")).toBeNull();
    expect(document.querySelector(".cuon__phu")?.textContent).toBe("4 trang, 21.08");
    // Ten tro nang mang ten cuon, vi mot ngan co nhieu cuon va "Nhận lời" khong noi len cuon nao.
    expect(screen.getByRole("button", { name: "Nhận lời viết cùng Những bữa sáng" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Từ chối viết cùng Những bữa sáng" })).toBeTruthy();
  });

  it("hai nut tra loi nam NGOAI the neo cua cuon", () => {
    render(<ul><ShelfBook {...coBan} newCount={0} moiToi={<NhanLoiThe bookId={A} ten="Linh" title="Những bữa sáng" />} /></ul>);
    const neo = document.querySelector("a.cuon__lien");
    expect(neo).toBeTruthy();
    expect(neo?.querySelector("button")).toBeNull();
    expect(document.querySelectorAll(".cuon__moi-nut button")).toHaveLength(2);
  });

  it("bam Nhan loi hay Tu choi goi dung action voi ma cuon", async () => {
    render(<ul><ShelfBook {...coBan} newCount={0} moiToi={<NhanLoiThe bookId={A} ten="Linh" title="Những bữa sáng" />} /></ul>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận lời viết cùng Những bữa sáng" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(A, true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Từ chối viết cùng Những bữa sáng" }));
    });
    expect(actionTraLoi).toHaveBeenLastCalledWith(A, false);
  });

  it("loi cua action hien ngay duoi cuon", async () => {
    actionTraLoi.mockResolvedValueOnce({ error: "Đề nghị này không còn nữa." });
    render(<ul><ShelfBook {...coBan} newCount={0} moiToi={<NhanLoiThe bookId={A} ten="Linh" title="Những bữa sáng" />} /></ul>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận lời viết cùng Những bữa sáng" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Đề nghị này không còn nữa.");
  });
});
