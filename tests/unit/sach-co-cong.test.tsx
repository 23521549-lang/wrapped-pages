import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SachCoCong } from "@/components/reader/SachCoCong";

/*
 * Cuon khong nhac cung mo qua tam bia (chu du an chot 26/09). Con cong thi noi dung sach va khung hoi dap chua gan: chua
 * ghi to da xem, chua co phim mui ten, chua chay nghi thuc. Mo roi thi focus vao vung sach.
 */

afterEach(cleanup);

const BIA = <p>Tấm bìa của Chuyện chưa kể</p>;
const SACH = <div className="doc__khung" tabIndex={-1}>Tờ một</div>;
const PHU = <section aria-label="Lời hồi đáp">Khung hồi đáp</section>;

describe("SachCoCong", () => {
  it("con cong: chi co tam bia va nut Mo sach; sach va khung hoi dap chua co trong cay", () => {
    render(<SachCoCong gate cover={BIA} side={PHU}>{SACH}</SachCoCong>);
    expect(screen.getByText("Tấm bìa của Chuyện chưa kể")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mở sách" })).toBeTruthy();
    expect(screen.queryByText("Tờ một")).toBeNull();
    expect(screen.queryByText("Khung hồi đáp")).toBeNull();
    expect(document.querySelector(".doc-luoi")).toBeNull();
  });

  it("bam Mo sach: gan sach va khung hoi dap o luoi hai cot, focus vao vung sach, tam bia bien mat", () => {
    render(<SachCoCong gate cover={BIA} side={PHU}>{SACH}</SachCoCong>);
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    expect(screen.queryByText("Tấm bìa của Chuyện chưa kể")).toBeNull();
    expect(document.querySelector(".doc-luoi .doc-luoi__chinh")?.textContent).toBe("Tờ một");
    expect(document.querySelector(".doc-luoi .doc-luoi__phu")?.textContent).toBe("Khung hồi đáp");
    expect(document.activeElement).toBe(document.querySelector(".doc__khung"));
  });

  it("sach chua co to nao (khong co vung sach): focus ve chinh cot chinh, khong roi ve body", () => {
    render(<SachCoCong gate cover={BIA} side={null}><p>Chưa có trang nào.</p></SachCoCong>);
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    expect(document.activeElement).toBe(document.querySelector(".doc-luoi__chinh"));
    // Khong co khung hoi dap thi mot cot, khong co luoi.
    expect(document.querySelector(".doc-luoi")).toBeNull();
  });

  it("khong co cong (loi vao ?trang hay ?mo): sach va khung hoi dap hien ngay, khong co nut Mo sach", () => {
    render(<SachCoCong gate={false} cover={BIA} side={PHU}>{SACH}</SachCoCong>);
    expect(screen.queryByRole("button", { name: "Mở sách" })).toBeNull();
    expect(screen.getByText("Tờ một")).toBeTruthy();
    expect(screen.getByText("Khung hồi đáp")).toBeTruthy();
  });

  it("cong chi doc luc gan: ve lai voi gate khac khong hien lai hay go tam bia giua chung", () => {
    const { rerender } = render(<SachCoCong gate cover={BIA} side={null}>{SACH}</SachCoCong>);
    rerender(<SachCoCong gate={false} cover={BIA} side={null}>{SACH}</SachCoCong>);
    expect(screen.getByRole("button", { name: "Mở sách" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    rerender(<SachCoCong gate cover={BIA} side={null}>{SACH}</SachCoCong>);
    expect(screen.queryByRole("button", { name: "Mở sách" })).toBeNull();
  });
});
