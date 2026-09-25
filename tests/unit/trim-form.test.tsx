// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { TrimForm, type TrimFormProps } from "@/components/book/TrimForm";

/*
 * Trang Viet tiep: chon bia va nhac cho LUOT SAP DANG roi mo man viet. Diem 8 cua chu du an: "hien mot trang giao dien
 * tua trang Sach moi nhung KHONG co o ten sach va KHONG co muc Ai doc duoc - chi de them bia va them nhac cho luot nay."
 */

const { actionSetDraftTrim } = vi.hoisted(() => ({
  actionSetDraftTrim: vi.fn(async (_bookId: string, _fd: FormData) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionSetDraftTrim }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn(async () => ({ error: "khong dung toi" })) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const ANH = "1111aaaa-1111-4111-8111-111111111111";
const MA = "dQw4w9WgXcQ";
const TRONG = { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false } as const;

function ve(props: Partial<TrimFormProps> = {}) {
  render(
    <TrimForm
      bookId="sach-1"
      title="Chuyện chưa kể"
      nickname="Linh"
      bia={{ cover: "nui-xa", coverMediaId: null }}
      isPrivate={false}
      photos={[{ id: ANH, nhan: "Ảnh của bạn, tải 20.09" }]}
      coNhac={false}
      trim={TRONG}
      mediaEnabled
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  actionSetDraftTrim.mockClear();
});

describe("trang Viet tiep", () => {
  it("khong co o ten sach va khong co muc Ai doc duoc", () => {
    ve();
    expect(screen.queryByLabelText("Tên sách")).toBeNull();
    expect(screen.queryByRole("group", { name: "Ai đọc được" })).toBeNull();
    // Van co du hai thu can chon.
    expect(screen.getByRole("group", { name: "Bìa" })).toBeTruthy();
    expect(screen.getByLabelText("Nhạc nền")).toBeTruthy();
  });

  it("mo trang thi nut chinh duoc focus san", () => {
    ve();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Viết trang" }));
  });

  it("chua chon gi thi o Giu bia dang dung dang duoc chon", () => {
    ve();
    expect(screen.getByRole("radio", { name: /Giữ bìa đang dùng/ })).toHaveProperty("checked", true);
  });

  it("nhap dang giu mot bia thi o do duoc chon san, khong phai bia hien hanh cua cuon", () => {
    ve({ bia: { cover: "nui-xa", coverMediaId: null }, trim: { ...TRONG, cover: "hoa-dao" } });
    expect(screen.getByRole("radio", { name: "Bìa cành hoa đào" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Bìa núi xa" })).toHaveProperty("checked", false);
  });

  it("nhap dang giu mot ma nhac thi o nhap dien san link ngan", () => {
    ve({ trim: { ...TRONG, youtubeId: MA } });
    expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).value).toBe(`https://youtu.be/${MA}`);
  });

  it("cuon dang co nhac: co o danh dau Go nhac nen cho luot nay", () => {
    ve({ coNhac: true });
    expect(screen.getByLabelText("Gỡ nhạc nền cho lượt này")).toBeTruthy();
  });

  it("cuon khong co nhac: khong co o danh dau do", () => {
    ve({ coNhac: false });
    expect(screen.queryByLabelText("Gỡ nhạc nền cho lượt này")).toBeNull();
  });

  it("bat o go nhac thi o nhap nhac bi khoa va xoa trang", () => {
    ve({ coNhac: true, trim: { ...TRONG, youtubeId: MA } });
    const o = screen.getByLabelText("Nhạc nền") as HTMLInputElement;
    expect(o.value).not.toBe("");
    fireEvent.click(screen.getByLabelText("Gỡ nhạc nền cho lượt này"));
    expect([o.value, o.disabled]).toEqual(["", true]);
  });

  it("gui: khong chon gi thi ca hai truong deu rong", async () => {
    ve();
    fireEvent.click(screen.getByRole("button", { name: "Viết trang" }));
    await waitFor(() => expect(actionSetDraftTrim).toHaveBeenCalledTimes(1));
    const fd = actionSetDraftTrim.mock.calls[0][1];
    expect([fd.getAll("cover"), fd.get("coverMedia"), fd.get("music"), fd.get("dropTrack")]).toEqual([[""], "", "", null]);
  });

  it("gui: chon mot anh trong kho va mot ban nhac", async () => {
    ve();
    fireEvent.click(screen.getByRole("radio", { name: "Ảnh của bạn, tải 20.09" }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: `https://youtu.be/${MA}` } });
    fireEvent.click(screen.getByRole("button", { name: "Viết trang" }));
    await waitFor(() => expect(actionSetDraftTrim).toHaveBeenCalledTimes(1));
    const fd = actionSetDraftTrim.mock.calls[0][1];
    expect([fd.get("coverMedia"), fd.get("music")]).toEqual([ANH, `https://youtu.be/${MA}`]);
  });

  it("gui: bat go nhac thi co dau go va khong co ma video", async () => {
    ve({ coNhac: true });
    fireEvent.click(screen.getByLabelText("Gỡ nhạc nền cho lượt này"));
    fireEvent.click(screen.getByRole("button", { name: "Viết trang" }));
    await waitFor(() => expect(actionSetDraftTrim).toHaveBeenCalledTimes(1));
    const fd = actionSetDraftTrim.mock.calls[0][1];
    // O nhap nhac dang khoa nen trinh duyet khong gui no di; may chu doc thieu truong nay thanh chuoi rong.
    expect([fd.get("dropTrack"), fd.get("music")]).toEqual(["1", null]);
  });

  it("link nhac hong thi bao loi tai cho, khong gui len", async () => {
    ve();
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: "https://vi.wikipedia.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Viết trang" }));
    await waitFor(() => expect(screen.getByLabelText("Nhạc nền").getAttribute("aria-invalid")).toBe("true"));
    expect(actionSetDraftTrim).not.toHaveBeenCalled();
  });

  it("xem truoc ve bia dang chon kem cau bia nay bat dau tu luot sap dang", () => {
    ve();
    fireEvent.click(screen.getByRole("radio", { name: "Bìa cành hoa đào" }));
    const xem = screen.getByRole("complementary", { name: "Xem trước trên kệ" });
    expect(xem.querySelector(".book__cover.bia--hoa-dao")).not.toBeNull();
    expect(xem.textContent).toContain("Bìa này bắt đầu từ lượt bạn sắp đăng.");
  });

  it("chon Giu bia dang dung thi xem truoc ve bia hien hanh cua cuon", () => {
    ve({ bia: { cover: "meo-mai", coverMediaId: ANH }, trim: { ...TRONG, cover: "hoa-dao" } });
    fireEvent.click(screen.getByRole("radio", { name: /Giữ bìa đang dùng/ }));
    const xem = screen.getByRole("complementary", { name: "Xem trước trên kệ" });
    expect(xem.querySelector(".book__cover.bia--meo-mai")).not.toBeNull();
    expect(xem.querySelector("img.bia__anh")?.getAttribute("src")).toBe(`/m/${ANH}`);
    expect(xem.textContent).toContain("Cuốn giữ bìa đang dùng.");
  });

  it("nut Thoi ve man doc cua chinh cuon do", () => {
    ve();
    expect(screen.getByRole("link", { name: "Thôi" }).getAttribute("href")).toBe("/sach/sach-1");
  });

  it("may chu tu choi thi cau bao hien ngay tren form", async () => {
    actionSetDraftTrim.mockResolvedValueOnce({ error: "Không tìm thấy cuốn sách này." });
    ve();
    fireEvent.click(screen.getByRole("button", { name: "Viết trang" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Không tìm thấy cuốn sách này.");
  });
});
