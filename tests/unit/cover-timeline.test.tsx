// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoverTimeline } from "@/components/book/CoverTimeline";
import type { CoverSlot } from "@/server/library/timeline";

/*
 * Muc "Bia theo luot" cua man Sua sach. Truoc chang nay, san pham khong co cach nao doi bia cua mot cuon sau khi tao;
 * muc nay la mot trong hai cho dong lai cho hong do.
 */

const { actionSetCoverEntry, actionRemoveCoverEntry } = vi.hoisted(() => ({
  actionSetCoverEntry: vi.fn(async (_bookId: string, _roundId: string | null, _fd: FormData) => undefined as { error: string } | undefined),
  actionRemoveCoverEntry: vi.fn(async (_bookId: string, _roundId: string | null) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionSetCoverEntry, actionRemoveCoverEntry }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn(async () => ({ error: "khong dung toi" })) }));

const NOW = new Date(Date.UTC(2026, 8, 25, 3, 0, 0));
const L1 = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const L2 = "8b2c3d4e-5f6a-4b7c-8d8e-1f2a3b4c5d6e";
const ANH = "1111aaaa-1111-4111-8111-111111111111";

const moDau = (cover: CoverSlot["o"] = { id: "o0", cover: "nui-xa", coverMediaId: null }): CoverSlot =>
  ({ roundId: null, ordinal: null, first: null, last: null, at: new Date(Date.UTC(2026, 8, 18)), o: cover });

const cuaLuot = (roundId: string, ordinal: number, first: number, last: number, o: CoverSlot["o"]): CoverSlot =>
  ({ roundId, ordinal, first, last, at: new Date(Date.UTC(2026, 8, 20)), o });

function ve(slots: CoverSlot[]) {
  render(<CoverTimeline bookId="sach-1" slots={slots} photos={[{ id: ANH, nhan: "Ảnh của bạn, tải 20.09" }]} mediaEnabled now={NOW} />);
}

beforeAll(() => {
  // jsdom khong co scrollIntoView. Dong dang mo tu keo minh vao tam nhin mot lan, nen phai co ham nay de goi duoc.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: () => {}, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  actionSetCoverEntry.mockClear();
  actionRemoveCoverEntry.mockClear();
});

describe("muc Bia theo luot", () => {
  it("moi o mot dong, o mo dau ghi Luc tao sach", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    const dong = screen.getAllByRole("listitem");
    expect(dong).toHaveLength(2);
    expect(dong[0].textContent).toContain("Lúc tạo sách");
  });

  it("o cua mot luot ghi so luot, khoang to va ngay, noi bang dau phay", () => {
    ve([moDau(), cuaLuot(L2, 3, 12, 17, { id: "o2", cover: "cau-go", coverMediaId: null })]);
    expect(screen.getAllByRole("listitem")[1].textContent).toContain("Lượt 3, trang 12 tới 17, 20.09");
  });

  it("o trong ghi Chua co bia va nut Them bia", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, null)]);
    const dong = screen.getAllByRole("listitem")[1];
    expect(dong.textContent).toContain("Chưa có bìa");
    expect(dong.querySelector(".moc__hinh--trong")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Thêm bìa/ })).toBeTruthy();
  });

  it("chi con mot o bia thi khong dong nao co nut Bo o nay", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, null)]);
    expect(screen.queryByRole("button", { name: /Bỏ ô này/ })).toBeNull();
  });

  it("hai o tro len thi moi o da co deu bo duoc", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    expect(screen.getAllByRole("button", { name: /Bỏ ô này/ })).toHaveLength(2);
  });

  it("bam Bo o nay goi dung ma luot cua chinh dong do", async () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    fireEvent.click(screen.getAllByRole("button", { name: /Bỏ ô này/ })[1]);
    await waitFor(() => expect(actionRemoveCoverEntry).toHaveBeenCalledTimes(1));
    expect(actionRemoveCoverEntry.mock.calls[0]).toEqual(["sach-1", L1]);
  });

  it("bam Doi bia nay mo bang chon bia ngay trong chinh dong do, co Luu va Huy", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    const dong = screen.getAllByRole("listitem")[1];
    fireEvent.click(screen.getAllByRole("button", { name: /Đổi bìa này/ })[1]);
    const mo = dong.querySelector(".moc__mo");
    expect(mo).not.toBeNull();
    expect(mo?.querySelector(".picker")).not.toBeNull();
    // Khung mo ra nam TRONG chinh dong do, nen cac dong duoi khong bi day ngang.
    expect(screen.getAllByRole("listitem")[0].querySelector(".moc__mo")).toBeNull();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeTruthy();
  });

  it("luu mot o: gui dung ma luot va dung bia dang chon", async () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    fireEvent.click(screen.getAllByRole("button", { name: /Đổi bìa này/ })[1]);
    fireEvent.click(screen.getByRole("radio", { name: "Bìa cầu gỗ qua suối" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(actionSetCoverEntry).toHaveBeenCalledTimes(1));
    const [sach, luot, fd] = actionSetCoverEntry.mock.calls[0];
    expect([sach, luot]).toEqual(["sach-1", L1]);
    expect([fd.getAll("cover"), fd.get("coverMedia")]).toEqual([["cau-go"], ""]);
  });

  it("chon mot anh trong kho: truong an mang dung id do", async () => {
    ve([moDau()]);
    fireEvent.click(screen.getByRole("button", { name: /Đổi bìa này/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Ảnh của bạn, tải 20.09" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(actionSetCoverEntry).toHaveBeenCalledTimes(1));
    const fd = actionSetCoverEntry.mock.calls[0][2];
    expect(fd.get("coverMedia")).toBe(ANH);
  });

  it("bang chon bia trong mot dong khong co o Giu bia dang dung: o nay bat buoc co bia", () => {
    ve([moDau()]);
    fireEvent.click(screen.getByRole("button", { name: /Đổi bìa này/ }));
    expect(screen.queryByRole("radio", { name: /Giữ bìa đang dùng/ })).toBeNull();
  });

  it("may chu tu choi thi cau bao hien ngay trong dong do", async () => {
    actionRemoveCoverEntry.mockResolvedValueOnce({ error: "Mỗi cuốn phải còn ít nhất một bìa." });
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    fireEvent.click(screen.getAllByRole("button", { name: /Bỏ ô này/ })[0]);
    expect((await screen.findByRole("alert")).textContent).toBe("Mỗi cuốn phải còn ít nhất một bìa.");
  });

  it("moi nut trong danh sach co ten doc duoc kem o nao, de trinh doc man hinh phan biet duoc", () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    const ten = screen.getAllByRole("button").map((b) => b.textContent);
    expect(new Set(ten).size).toBe(ten.length);
  });

  it("bia anh cua mot o hien ca tranh du phong lan anh", () => {
    ve([moDau({ id: "o0", cover: "nui-xa", coverMediaId: ANH })]);
    const hinh = screen.getAllByRole("listitem")[0].querySelector(".moc__hinh");
    expect(hinh?.classList.contains("bia--nui-xa")).toBe(true);
    expect(hinh?.querySelector("img.bia__anh")?.getAttribute("src")).toBe(`/m/${ANH}`);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Ảnh của bạn");
  });

  it("luu duoc thi khung sua dong lai", async () => {
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    fireEvent.click(screen.getAllByRole("button", { name: /Đổi bìa này/ })[1]);
    expect(screen.getAllByRole("listitem")[1].querySelector(".moc__mo")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")[1].querySelector(".moc__mo")).toBeNull());
  });

  it("may chu tu choi thi khung van mo de sua tiep, kem cau bao trong chinh dong do", async () => {
    actionSetCoverEntry.mockResolvedValueOnce({ error: "Ảnh bìa không dùng được nữa. Chọn lại ảnh bìa." });
    ve([moDau(), cuaLuot(L1, 1, 1, 2, { id: "o1", cover: "hoa-dao", coverMediaId: null })]);
    fireEvent.click(screen.getAllByRole("button", { name: /Đổi bìa này/ })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Ảnh bìa không dùng được nữa");
    expect(screen.getAllByRole("listitem")[1].querySelector(".moc__mo")).not.toBeNull();
  });

  it("bam Huy tra o ve dung bia dang luu, khong giu lua chon dang do", () => {
    ve([moDau({ id: "o0", cover: "nui-xa", coverMediaId: null })]);
    fireEvent.click(screen.getByRole("button", { name: /Đổi bìa này/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Bìa cầu gỗ qua suối" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: /Đổi bìa này/ }));
    expect(screen.getByRole("radio", { name: "Bìa núi xa" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Bìa cầu gỗ qua suối" })).toHaveProperty("checked", false);
  });
});
