// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { BookForm } from "@/components/book/BookForm";

/*
 * O Nhac nen cua form sach tren DOM that: bao loi luc roi o va luc bam gui bang dung
 * parseYoutubeLink cua may chu, chip "Da nhan video" khi link dung, dien lai link ngan khi sua sach.
 */

const { actionCreateBook, actionUpdateBook } = vi.hoisted(() => ({
  actionCreateBook: vi.fn(async (_fd: FormData) => ({ error: "Chưa tạo được." })),
  actionUpdateBook: vi.fn(async (_bookId: string, _fd: FormData) => ({ error: "Chưa lưu được." })),
}));
vi.mock("@/app/actions/library", () => ({ actionCreateBook, actionUpdateBook }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const MA = "5qap5aO4i9A";
const GOI_Y = "Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.";

const oNhac = () => screen.getByLabelText("Nhạc nền") as HTMLInputElement;
const dongDuoi = () => document.getElementById(oNhac().getAttribute("aria-describedby") ?? "") as HTMLElement;

function formMoi() {
  render(<BookForm book={null} nickname="Linh" partnerNickname="Manh" mediaEnabled={false} />);
  fireEvent.change(screen.getByLabelText("Tên sách"), { target: { value: "Chuyện chưa kể" } });
}

afterEach(() => {
  cleanup();
  actionCreateBook.mockClear();
  actionUpdateBook.mockClear();
});

describe("BookForm o nhac nen", () => {
  it("o trong: goi y khong bat buoc, khong loi, khong chip", () => {
    formMoi();
    expect(oNhac().value).toBe("");
    expect(oNhac().getAttribute("type")).toBe("url");
    expect(oNhac().getAttribute("aria-invalid")).toBe("false");
    expect(dongDuoi().textContent).toBe(GOI_Y);
  });

  it("link sai chi bao loi sau khi roi o", () => {
    formMoi();
    fireEvent.change(oNhac(), { target: { value: "https://youtube.com/@linh" } });
    expect(oNhac().getAttribute("aria-invalid")).toBe("false");
    expect(dongDuoi().textContent).toBe(GOI_Y);
    fireEvent.blur(oNhac());
    expect(oNhac().getAttribute("aria-invalid")).toBe("true");
    expect(dongDuoi().textContent).toBe("Link YouTube chưa đúng.");
    expect(dongDuoi().className).toBe("field__help field__help--loi");
    expect(document.querySelector(".field__o .dau-loi")).not.toBeNull();
  });

  it("link dung hien chip Da nhan video ngay khi go xong", () => {
    formMoi();
    fireEvent.change(oNhac(), { target: { value: `https://www.youtube.com/watch?v=${MA}` } });
    expect(dongDuoi().className).toBe("field__help field__help--co");
    expect(dongDuoi().querySelector(".chip--key")?.textContent).toBe("Đã nhận video");
    expect(dongDuoi().textContent).toBe("Đã nhận video Nhạc phát khi mở bìa sách.");
  });

  it("bam gui voi link sai: bao loi, dua focus ve o nhac, khong goi action", () => {
    formMoi();
    fireEvent.change(oNhac(), { target: { value: `https://youtube.com.evil.test/watch?v=${MA}` } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo sách" }));
    expect(oNhac().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(oNhac());
    expect(actionCreateBook).not.toHaveBeenCalled();
  });

  it("bam gui voi link dung: form gui nguyen link trong truong music", async () => {
    formMoi();
    const link = `https://youtu.be/${MA}?si=abc`;
    fireEvent.change(oNhac(), { target: { value: link } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo sách" }));
    await waitFor(() => expect(actionCreateBook).toHaveBeenCalledTimes(1));
    expect(actionCreateBook.mock.calls[0][0].get("music")).toBe(link);
  });

  /*
   * Phan quyet B2 cua dot 24.09: "o bia va o nhac ROI KHOI phan tren cua Sua sach, chuyen han xuong hai muc danh sach.
   * Ly do: giu ca hai la hai duong ghi cho cung mot gia tri." Nen form sua chi con ten sach va Ai doc duoc; form tao
   * van hoi ca ba, vi ca ba deu di thang vao hai o mo dau cua cuon moi.
   */
  it("form sua chi con ten sach va Ai doc duoc; form tao van co ca bang bia lan o nhac", async () => {
    render(
      <BookForm
        book={{ id: "b1", title: "Chuyện chưa kể", mode: "chia-se", cover: "nui-xa", youtubeId: MA, coverMediaId: null }}
        nickname="Linh"
        partnerNickname="Manh"
        mediaEnabled={false}
      />,
    );
    expect(screen.getByLabelText("Tên sách")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Ai đọc được" })).toBeTruthy();
    expect(screen.queryByLabelText("Nhạc nền")).toBeNull();
    expect(screen.queryByRole("group", { name: "Bìa" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(actionUpdateBook).toHaveBeenCalledTimes(1));
    const gui = actionUpdateBook.mock.calls[0][1];
    expect([gui.get("title"), gui.get("mode"), gui.get("cover"), gui.get("coverMedia"), gui.get("music")])
      .toEqual(["Chuyện chưa kể", "chia-se", null, null, null]);

    cleanup();
    formMoi();
    expect(screen.getByLabelText("Nhạc nền")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Bìa" })).toBeTruthy();
  });
});
