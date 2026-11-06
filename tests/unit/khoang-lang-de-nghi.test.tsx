// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BookForm } from "@/components/book/BookForm";

const { actionCreateBook, actionUpdateBook } = vi.hoisted(() => ({
  actionCreateBook: vi.fn(async (_fd: FormData) => ({ error: "Chưa tạo được." })),
  actionUpdateBook: vi.fn(async (_bookId: string, _fd: FormData) => ({ error: "Chưa lưu được." })),
}));
vi.mock("@/app/actions/library", () => ({ actionCreateBook, actionUpdateBook }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const SACH = { id: "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a", title: "Chạy bộ mùa thu", mode: "chia-se" as const, cover: "nui-xa" as const, youtubeId: null, coverMediaId: null };

afterEach(() => {
  cleanup();
  for (const f of [actionCreateBook, actionUpdateBook]) f.mockClear();
});

const ve = (p: { khoangLang?: boolean; deNghi?: { loai: "moi-viet" | "xin-viet" | "xoa-sach"; cuaToi: boolean } | null } = {}) =>
  render(<BookForm book={SACH} nickname="Mạnh" partnerNickname="Linh" mediaEnabled={false} photos={[]} khoangLang={p.khoangLang} deNghi={p.deNghi} />);

/*
 * Khoang Lang tren form sach (task 10, Q3b): tat co thi moi/xin viet cung nhu cu; bat co thi khong moi duoc nua
 * (lua chon "Viết cùng" khoa), khong con dong "đang xin" cua doi phuong, loi moi cua minh van giu (cau chung).
 */
describe("Khoang Lang: form sach", () => {
  it("tat co (kiem soat duong): Viết cùng bam duoc; dang xin hien ten", () => {
    ve({ deNghi: { loai: "xin-viet", cuaToi: false } });
    expect((screen.getByRole("radio", { name: "Viết cùng Linh" }) as HTMLInputElement).disabled).toBe(false);
    expect(document.querySelector(".ghi-chung")?.textContent).toContain("Linh đang xin viết cùng cuốn này.");
  });

  it("bat co: Viết cùng khoa, khong ten doi phuong, khong dong dang xin", () => {
    ve({ khoangLang: true, deNghi: { loai: "xin-viet", cuaToi: false } });
    const radio = screen.getByRole("radio", { name: "Viết cùng người đọc" }) as HTMLInputElement;
    // Radio khoa: trinh duyet that khong cho bam (fireEvent cua jsdom van dispatch nen khong bam thu o day).
    expect(radio.disabled).toBe(true);
    expect(radio.checked).toBe(false);
    expect(document.body.textContent).not.toContain("Linh");
    expect(document.querySelector(".ghi-chung")).toBeNull();
  });

  it("bat co, loi moi cua minh: Viet cung chon san nhung khoa, ghi chu giu bang cau chung", () => {
    ve({ khoangLang: true, deNghi: { loai: "moi-viet", cuaToi: true } });
    const radio = screen.getByRole("radio", { name: "Viết cùng người đọc" }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
    expect(radio.disabled).toBe(true);
    expect(document.querySelector(".ghi-chung")?.textContent).toContain("Đã mời người đọc.");
    expect(document.body.textContent).not.toContain("Linh");
  });
});
