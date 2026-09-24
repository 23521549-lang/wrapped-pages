// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublishPanel, usePublish } from "@/components/editor/PublishBar";
import type { DocJson } from "@/lib/doc/types";

/*
 * Muc gap "Doi bia, ten, nhac" o buoc dang: cuon chua co to thi khong co muc nay; khong mo thi lan dang khong gui gi;
 * mo ra thi cac o dien san gia tri hien tai va gia tri moi di kem lan dang, va bia moi con dang doc hay dang tai len
 * thi chua dang duoc.
 */

const { actionPublish, docAnh } = vi.hoisted(() => ({ actionPublish: vi.fn(), docAnh: vi.fn() }));
vi.mock("@/app/actions/library", () => ({ actionPublish }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
// Doc anh bia: gia lap de o bia dung yen o trang thai dang ban bao lau tuy bai kiem, khong can canvas hay bo giai ma.
vi.mock("@/components/book/coverFile", () => ({
  readSourceImage: docAnh,
  releaseSourceImage: () => {},
  encodeCover: async () => "broken",
}));

const SACH = "5d3a1c2b-8e7f-4a6b-9c0d-1e2f3a4b5c6d";
const TO: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Sáng" }] }] };
const NOW = { title: "Chuyện chưa kể", cover: "nui-xa" as const, youtubeId: null, coverMediaId: null };

function Khung({ bookNow, mediaEnabled = false }: { bookNow: typeof NOW | null; mediaEnabled?: boolean }) {
  const flow = usePublish({
    bookId: SACH,
    partnerNickname: "Linh",
    bookNow,
    mediaEnabled,
    prepare: () => ({ sheets: [TO] }),
    beforePublish: async () => {},
    afterFail: () => {},
  });
  return (
    <>
      <button type="button" onClick={() => flow.start()}>Đăng trang</button>
      {flow.open && <PublishPanel flow={flow} bookTitle={NOW.title} partnerNickname="Linh" onCancel={() => {}} />}
    </>
  );
}

const moKhung = () => fireEvent.click(screen.getByRole("button", { name: "Đăng trang" }));

afterEach(() => {
  cleanup();
  actionPublish.mockReset();
  docAnh.mockReset();
});

describe("muc doi bia, ten, nhac o buoc dang", () => {
  it("cuon chua co to thi khong co muc nay", () => {
    render(<Khung bookNow={null} />);
    moKhung();
    expect(screen.queryByRole("button", { name: "Đổi bìa, tên, nhạc" })).toBeNull();
  });

  it("khong mo thi dang khong gui gi ve sach", async () => {
    render(<Khung bookNow={NOW} />);
    moKhung();
    const nut = screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" });
    expect(nut.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Tên sách")).toBeNull();
    expect(screen.queryByLabelText("Nhạc nền")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Bìa núi xa" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    await waitFor(() => expect(actionPublish).toHaveBeenCalled());
    expect(actionPublish.mock.calls[0][3]).toBeNull();
  });

  it("mo ra thi dien san gia tri hien tai, va gia tri moi di kem lan dang", async () => {
    render(<Khung bookNow={NOW} />);
    moKhung();
    const nut = screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" });
    fireEvent.click(nut);
    expect(nut.getAttribute("aria-expanded")).toBe("true");
    // Nut mo tro toi dung khoi vua hien, de trinh doc man hinh di thang toi cac o.
    expect(document.getElementById(nut.getAttribute("aria-controls") ?? "")).not.toBeNull();
    const o = screen.getByLabelText("Tên sách") as HTMLInputElement;
    expect(o.value).toBe("Chuyện chưa kể");
    expect((screen.getByRole("radio", { name: "Bìa núi xa" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).value).toBe("");
    fireEvent.change(o, { target: { value: "Tên mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    await waitFor(() => expect(actionPublish).toHaveBeenCalled());
    expect(actionPublish.mock.calls[0][3]).toEqual({ title: "Tên mới", cover: "nui-xa", coverMedia: "", music: "" });
  });

  it("dong muc gap lai thi lan dang khong mang gia tri vua go", async () => {
    render(<Khung bookNow={NOW} />);
    moKhung();
    const nut = screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" });
    fireEvent.click(nut);
    fireEvent.change(screen.getByLabelText("Tên sách"), { target: { value: "Tên mới" } });
    fireEvent.click(nut);
    expect(nut.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Tên sách")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    await waitFor(() => expect(actionPublish).toHaveBeenCalled());
    expect(actionPublish.mock.calls[0][3]).toBeNull();
  });

  it("ten de trong thi khong dang, va focus quay ve o ten", async () => {
    render(<Khung bookNow={NOW} />);
    moKhung();
    fireEvent.click(screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" }));
    const o = screen.getByLabelText("Tên sách") as HTMLInputElement;
    fireEvent.change(o, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(actionPublish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(o);
  });

  it("bia moi con dang doc hay dang tai len thi chua dang duoc, xong thi dang lai duoc", async () => {
    let xong: ((r: "broken") => void) | null = null;
    docAnh.mockImplementation(() => new Promise<"broken">((ok) => {
      xong = ok;
    }));
    render(<Khung bookNow={NOW} mediaEnabled />);
    moKhung();
    fireEvent.click(screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" }));
    const dang = screen.getByRole("button", { name: "Đăng" }) as HTMLButtonElement;
    expect(dang.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Ảnh của bạn, chọn ảnh làm bìa"), {
      target: { files: [new File([new Uint8Array([1])], "bia.jpg", { type: "image/jpeg" })] },
    });
    // Dang luc nay se giu nguyen bia cu va bo roi bia vua tai len: nut phai khoa, nhu form sach van lam.
    expect(dang.disabled).toBe(true);
    fireEvent.click(dang);
    expect(actionPublish).not.toHaveBeenCalled();
    await act(async () => {
      xong?.("broken");
    });
    expect(dang.disabled).toBe(false);
  });

  it("link nhac hong thi khong dang, va focus quay ve o nhac", () => {
    render(<Khung bookNow={NOW} />);
    moKhung();
    fireEvent.click(screen.getByRole("button", { name: "Đổi bìa, tên, nhạc" }));
    const o = screen.getByLabelText("Nhạc nền") as HTMLInputElement;
    fireEvent.change(o, { target: { value: "https://vimeo.com/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(actionPublish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(o);
  });
});
