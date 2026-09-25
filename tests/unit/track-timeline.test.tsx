// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrackTimeline } from "@/components/book/TrackTimeline";
import type { TrackSlot } from "@/server/library/timeline";

/*
 * Muc "Nhac theo luot" cua man Sua sach. Khac muc bia o ba diem: co nut dat O GO NHAC, khong co bat bien "luon con it
 * nhat mot o", va o nhap la mot link YouTube chu khong phai mot bang.
 */

const { actionSetTrackEntry, actionRemoveTrackEntry } = vi.hoisted(() => ({
  actionSetTrackEntry: vi.fn(async (_bookId: string, _roundId: string | null, _fd: FormData) => undefined as { error: string } | undefined),
  actionRemoveTrackEntry: vi.fn(async (_bookId: string, _roundId: string | null) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionSetTrackEntry, actionRemoveTrackEntry }));

const NOW = new Date(Date.UTC(2026, 8, 25, 3, 0, 0));
const L1 = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const MA = "dQw4w9WgXcQ";

const moDau = (o: TrackSlot["o"]): TrackSlot =>
  ({ roundId: null, ordinal: null, first: null, last: null, at: new Date(Date.UTC(2026, 8, 18)), o });

const cuaLuot = (o: TrackSlot["o"]): TrackSlot =>
  ({ roundId: L1, ordinal: 2, first: 6, last: 11, at: new Date(Date.UTC(2026, 8, 20)), o });

function ve(slots: TrackSlot[]) {
  render(<TrackTimeline bookId="sach-1" slots={slots} now={NOW} />);
}

afterEach(() => {
  cleanup();
  actionSetTrackEntry.mockClear();
  actionRemoveTrackEntry.mockClear();
});

describe("muc Nhac theo luot", () => {
  it("o co nhac hien link ngan cua video, khong hien ma tho", () => {
    // May chu chi luu MA video; bieu mau va dong chu dien lai thanh link ngan, dung ham youtubeLink.
    ve([moDau({ id: "o0", youtubeId: MA })]);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain(`https://youtu.be/${MA}`);
  });

  it("o nhap dien san link ngan chu khong phai ma tho", () => {
    ve([moDau({ id: "o0", youtubeId: MA })]);
    fireEvent.click(screen.getByRole("button", { name: /Đổi nhạc này/ }));
    expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).value).toBe(`https://youtu.be/${MA}`);
  });

  it("o go nhac hien chu Go nhac nen, va khong con nut go nua", () => {
    ve([moDau({ id: "o0", youtubeId: null })]);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Gỡ nhạc nền");
    expect(screen.queryByRole("button", { name: /Gỡ nhạc từ lượt này/ })).toBeNull();
  });

  it("o trong hien Chua dung toi nhac va nut Them nhac", () => {
    ve([moDau(null)]);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Chưa dùng tới nhạc");
    expect(screen.getByRole("button", { name: /Thêm nhạc/ })).toBeTruthy();
  });

  it("o trong khong co nut Bo o nay: khong co gi de bo", () => {
    ve([moDau(null)]);
    expect(screen.queryByRole("button", { name: /Bỏ ô này/ })).toBeNull();
  });

  it("nhac khong co luat o cuoi cung: o mo dau duy nhat van bo duoc", async () => {
    ve([moDau({ id: "o0", youtubeId: MA })]);
    fireEvent.click(screen.getByRole("button", { name: /Bỏ ô này/ }));
    await waitFor(() => expect(actionRemoveTrackEntry).toHaveBeenCalledTimes(1));
    expect(actionRemoveTrackEntry.mock.calls[0]).toEqual(["sach-1", null]);
  });

  it("bam Go nhac tu luot nay gui dau go, khong gui ma video nao", async () => {
    ve([cuaLuot({ id: "o1", youtubeId: MA })]);
    fireEvent.click(screen.getByRole("button", { name: /Gỡ nhạc từ lượt này/ }));
    await waitFor(() => expect(actionSetTrackEntry).toHaveBeenCalledTimes(1));
    const [sach, luot, fd] = actionSetTrackEntry.mock.calls[0];
    expect([sach, luot, fd.get("dropTrack"), fd.get("music")]).toEqual(["sach-1", L1, "1", null]);
  });

  it("luu mot link moi: gui dung ma luot va dung link", async () => {
    ve([cuaLuot(null)]);
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: `https://youtu.be/${MA}` } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(actionSetTrackEntry).toHaveBeenCalledTimes(1));
    const [, luot, fd] = actionSetTrackEntry.mock.calls[0];
    expect([luot, fd.get("music")]).toEqual([L1, `https://youtu.be/${MA}`]);
  });

  it("link hong bao loi ngay trong dong do va khong gui len", async () => {
    ve([cuaLuot(null)]);
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: "https://vi.wikipedia.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true"));
    expect(actionSetTrackEntry).not.toHaveBeenCalled();
  });

  it("may chu tu choi thi cau bao hien ngay trong dong do", async () => {
    actionRemoveTrackEntry.mockResolvedValueOnce({ error: "Không tìm thấy cuốn sách này." });
    ve([moDau({ id: "o0", youtubeId: MA })]);
    fireEvent.click(screen.getByRole("button", { name: /Bỏ ô này/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Không tìm thấy cuốn sách này.");
  });

  it("moi nut trong danh sach co ten doc duoc rieng", () => {
    ve([moDau({ id: "o0", youtubeId: MA }), cuaLuot({ id: "o1", youtubeId: null })]);
    const ten = screen.getAllByRole("button").map((b) => b.textContent);
    expect(new Set(ten).size).toBe(ten.length);
  });

  it("luu duoc thi khung sua dong lai", async () => {
    ve([cuaLuot(null)]);
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: `https://youtu.be/${MA}` } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(document.querySelector(".o__mo")).toBeNull());
  });

  it("may chu tu choi thi khung van mo de sua tiep", async () => {
    actionSetTrackEntry.mockResolvedValueOnce({ error: "Không tìm thấy cuốn sách này." });
    ve([cuaLuot(null)]);
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: `https://youtu.be/${MA}` } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Không tìm thấy cuốn sách này.");
    expect(document.querySelector(".o__mo")).not.toBeNull();
  });

  it("bam Huy tra o ve dung link dang luu, khong giu chu dang go do", () => {
    ve([moDau({ id: "o0", youtubeId: MA })]);
    fireEvent.click(screen.getByRole("button", { name: /Đổi nhạc này/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: "https://youtu.be/aaaaaaaaaaa" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: /Đổi nhạc này/ }));
    expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).value).toBe(`https://youtu.be/${MA}`);
  });

  it("o trong: bam Huy roi mo lai thi o nhap van rong", () => {
    ve([cuaLuot(null)]);
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    fireEvent.change(screen.getByLabelText("Nhạc nền"), { target: { value: "https://youtu.be/aaaaaaaaaaa" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: /Thêm nhạc/ }));
    expect((screen.getByLabelText("Nhạc nền") as HTMLInputElement).value).toBe("");
  });
});
