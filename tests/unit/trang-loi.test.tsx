// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import LoiTrang from "@/app/error";
import LoiToanCuc from "@/app/global-error";
import KhongThay from "@/app/not-found";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

// next/font chi chay duoi trinh bien dich cua Next; o day chi can mot chuoi lop de kiem no duoc dat len <html>.
vi.mock("@/app/phong", () => ({ lopPhong: "phong-gia" }));

afterEach(() => {
  cleanup();
});

/** Mot loi mang chi tiet noi bo, nhu loi that khi database khong toi duoc. */
function loiNoiBo(digest?: string): Error & { digest?: string } {
  const e: Error & { digest?: string } = new Error("connect ECONNREFUSED 10.0.0.5:5432 postgres://admin:bi-mat@db/mqce");
  if (digest !== undefined) e.digest = digest;
  return e;
}

describe("error.tsx (ranh gioi loi cua moi trang)", () => {
  it("noi bang giong cua web, khong bao gio lo error.message, co duong ve trang chinh", () => {
    const { container } = render(<LoiTrang error={loiNoiBo()} retry={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Trang chưa mở được" })).toBeTruthy();
    expect(container.textContent).not.toContain("ECONNREFUSED");
    expect(container.textContent).not.toContain("bi-mat");
    expect(screen.getByRole("link", { name: "Về trang chính" }).getAttribute("href")).toBe("/");
  });

  it("bam Thu lai goi retry dung mot lan (lay lai du lieu va dung lai trang)", () => {
    const retry = vi.fn();
    render(<LoiTrang error={loiNoiBo("12345")} retry={retry} />);
    const nut = screen.getByRole("button", { name: "Thử lại" });
    expect(nut.getAttribute("type")).toBe("button");
    fireEvent.click(nut);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("loi may chu co digest thi hien ma de doi voi log; loi client khong co digest thi khong co dong ma", () => {
    render(<LoiTrang error={loiNoiBo("2717465891")} retry={() => {}} />);
    expect(screen.getByText("Mã lỗi: 2717465891")).toBeTruthy();
    cleanup();
    render(<LoiTrang error={loiNoiBo()} retry={() => {}} />);
    expect(screen.queryByText(/Mã lỗi/)).toBeNull();
  });
});

describe("not-found.tsx (trang 404 cua ca web)", () => {
  it("tieu de tieng Viet va mot duong ve trang chinh", () => {
    render(<KhongThay />);
    expect(screen.getByRole("heading", { level: 1, name: "Không thấy trang này" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Về trang chính" }).getAttribute("href")).toBe("/");
  });
});

describe("global-error.tsx (thay layout goc khi chinh layout goc hong)", () => {
  it("tu dung <html lang=vi> mang lop phong chu cua web, co tieu de trang, va dung lai dung giao dien cua error.tsx", () => {
    // Dung HTML bang react-dom/server: <html> khong gan duoc vao mot the <div> cua jsdom.
    const html = renderToStaticMarkup(<LoiToanCuc error={loiNoiBo("99")} retry={() => {}} />);
    expect(html.startsWith('<html lang="vi" class="phong-gia">')).toBe(true);
    // React 19 tu keo the <title> len <head>.
    expect(html).toContain("<head><title>Món Quà Của Em</title></head>");
    expect(html).toContain("Trang chưa mở được");
    expect(html).toContain("Mã lỗi: 99");
    expect(html).not.toContain("ECONNREFUSED");
  });
});
