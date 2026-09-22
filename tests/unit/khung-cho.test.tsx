// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ChoKeSach from "@/app/ke-sach/loading";
import ChoBanNhap from "@/app/ban-nhap/loading";
import ChoCaiDat from "@/app/cai-dat/loading";
import ChoDoc from "@/app/sach/[id]/(doc)/loading";
import ChoViet from "@/app/sach/[id]/viet/loading";
import ChoSua from "@/app/sach/[id]/sua/loading";

afterEach(cleanup);

const KHUNG = [
  { ten: "ke sach", C: ChoKeSach, chu: "Đang mở kệ sách…", muc: "Kệ sách" },
  { ten: "ban nhap", C: ChoBanNhap, chu: "Đang mở bản nháp…", muc: "Bản nháp" },
  { ten: "cai dat", C: ChoCaiDat, chu: "Đang mở cài đặt…", muc: "Cài đặt" },
  { ten: "man doc", C: ChoDoc, chu: "Đang mở sách…", muc: "Kệ sách" },
  { ten: "man viet", C: ChoViet, chu: "Đang mở trang viết…", muc: "Kệ sách" },
  { ten: "sua sach", C: ChoSua, chu: "Đang mở sách…", muc: "Kệ sách" },
];

describe("khung giu cho (loading.tsx)", () => {
  it.each(KHUNG)("$ten: dong trang thai cho trinh doc man hinh, vung aria-busy, hinh an di", ({ C, chu }) => {
    const { container } = render(<C />);
    expect(screen.getByRole("status")).toHaveProperty("textContent", chu);
    const vung = container.querySelector("[aria-busy='true']");
    expect(vung).not.toBeNull();
    // Moi hinh giu cho nam trong mot khoi aria-hidden; ngoai dong trang thai, trinh doc man hinh khong doc gi them.
    const hinh = vung?.querySelector(".khung-cho__hinh");
    expect(hinh?.getAttribute("aria-hidden")).toBe("true");
    expect(hinh?.textContent).toBe("");
  });

  it.each(KHUNG)("$ten: khong co main hay tieu de, nen khong bi nham la trang that da tai xong", ({ C }) => {
    const { container } = render(<C />);
    expect(container.querySelector("main, h1, h2, h3")).toBeNull();
  });

  it.each(KHUNG)("$ten: thanh dieu huong cung hinh, dung muc dang o, an voi trinh doc man hinh", ({ C, muc }) => {
    const { container } = render(<C />);
    const nav = container.querySelector(".nav");
    expect(nav?.getAttribute("aria-hidden")).toBe("true");
    expect(nav?.querySelector("[aria-current]")?.textContent).toBe(muc);
    expect(nav?.querySelector(".who")).toBeNull();
  });

  it.each(KHUNG)("$ten: khong co dieu khien nao nhan Tab, khong lien ket nao", ({ C }) => {
    const { container } = render(<C />);
    expect([...container.querySelectorAll("a, button, input, textarea, select, [tabindex]")]).toEqual([]);
  });
});
