// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DongBia } from "@/components/book/DongBia";
import { DongNhac } from "@/components/book/DongNhac";
import type { CoverSlot, TrackSlot } from "@/server/library/timeline";

/*
 * Hai dong thoi gian cua man Sua sach (chu du an duyet 28/09, ban mo phong 6): mac dinh thu gon, bam dong tom tat thi mo;
 * bam mot moc thi bang chon rũ xuống ngay duoi moc, chon xong la luu va cuon len; co Hoan tac.
 */

const { actionSetCoverEntry, actionRemoveCoverEntry, actionSetTrackEntry, actionRemoveTrackEntry } = vi.hoisted(() => ({
  actionSetCoverEntry: vi.fn(async (_b: string, _r: string | null, _fd: FormData) => undefined as { error: string } | undefined),
  actionRemoveCoverEntry: vi.fn(async (_b: string, _r: string | null) => undefined as { error: string } | undefined),
  actionSetTrackEntry: vi.fn(async (_b: string, _r: string | null, _fd: FormData) => undefined as { error: string } | undefined),
  actionRemoveTrackEntry: vi.fn(async (_b: string, _r: string | null) => undefined as { error: string } | undefined),
}));
vi.mock("@/app/actions/library", () => ({ actionSetCoverEntry, actionRemoveCoverEntry, actionSetTrackEntry, actionRemoveTrackEntry }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn(async () => ({ error: "khong dung toi" })) }));

const SACH = "sach-1";
const NOW = new Date(Date.UTC(2026, 8, 28, 3));
const L1 = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const L2 = "8b2c3d4e-5f6a-4b7c-8d8e-1f2a3b4c5d6e";
const L3 = "7c3d4e5f-6a7b-4c8d-9e9f-2a3b4c5d6e7f";
const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";

const moc = <T,>(roundId: string | null, ordinal: number | null, ngay: number, o: T) =>
  ({ roundId, ordinal, first: ordinal, last: ordinal, at: new Date(Date.UTC(2026, 8, ngay, 3)), o });

/** Tao sach: nui xa; luot 1 giu; luot 2 hoa dao; luot 3 giu. */
const BIA: CoverSlot[] = [
  moc(null, null, 12, { id: "b0", cover: "nui-xa", coverMediaId: null }),
  moc(L1, 1, 14, null),
  moc(L2, 2, 20, { id: "b2", cover: "hoa-dao", coverMediaId: null }),
  moc(L3, 3, 23, null),
];
/** Tao sach: bai A; luot 1 phat tiep; luot 2 tat nhac; luot 3 bai B. */
const NHAC: TrackSlot[] = [
  moc(null, null, 12, { id: "n0", youtubeId: A }),
  moc(L1, 1, 14, null),
  moc(L2, 2, 20, { id: "n2", youtubeId: null }),
  moc(L3, 3, 23, { id: "n3", youtubeId: B }),
];
const TEN = { [A]: { ten: "Hẹn Một Mai", kenh: "Bùi Anh Tuấn" }, [B]: { ten: "Nàng Thơ", kenh: "Hoàng Dũng" } };

const veBia = (slots = BIA) =>
  render(<DongBia bookId={SACH} slots={slots} photos={[{ id: "1111aaaa-1111-4111-8111-111111111111", nhan: "Ảnh của bạn, tải 20.09" }]} mediaEnabled now={NOW} />);
const veNhac = (slots = NHAC) => render(<DongNhac bookId={SACH} slots={slots} ten={TEN} now={NOW} />);

const tomTat = () => screen.getByRole("button", { expanded: false, name: /Theo lượt/ });
const cacMoc = () => [...document.querySelectorAll<HTMLButtonElement>(".tg-dong")];
const rot = (i: number) => document.querySelectorAll<HTMLElement>(".tg-rot")[i];

async function moMoc(i: number) {
  fireEvent.click(tomTat());
  fireEvent.click(cacMoc()[i]);
  await act(async () => {});
}

/**
 * Bam Hoan tac khi nut da bat: nut hien ra ngay luc luu xong nhung con tat toi khi luot chuyen (useTransition) ket thuc.
 * Bam vao luc nut con tat thi khong co gi xay ra; chay ca bo kiem duoi tai nang da roi dung vao khe do.
 */
async function bamHoanTac() {
  const nut = await screen.findByRole<HTMLButtonElement>("button", { name: "Hoàn tác" });
  await waitFor(() => expect(nut.disabled).toBe(false));
  fireEvent.click(nut);
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: () => {}, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  for (const f of [actionSetCoverEntry, actionRemoveCoverEntry, actionSetTrackEntry, actionRemoveTrackEntry]) f.mockClear();
});

describe("dong thoi gian Bia", () => {
  it("thu gon: nhan Bia, tom tat bia dang dung va so bia qua so luot; phan than inert", () => {
    veBia();
    expect(screen.getByText("Bìa", { selector: "legend" })).toBeTruthy();
    const tom = tomTat();
    expect(tom.textContent).toContain("Cành hoa đào");
    expect(tom.textContent).toContain("2 bìa qua 3 lượt đăng");
    expect(document.querySelectorAll(".xap-bia__la")).toHaveLength(2);
    expect(document.querySelector(".tg__mo")?.hasAttribute("inert")).toBe(true);
  });

  it("bam tom tat thi mo dong thoi gian: moi moc mot dong, moc dau la Tao sach, luot giu bia ghi Giu bia truoc", () => {
    veBia();
    fireEvent.click(tomTat());
    expect(screen.getByRole("button", { expanded: true, name: /Thu gọn/ })).toBeTruthy();
    expect(document.querySelector(".tg__mo")?.hasAttribute("inert")).toBe(false);
    const dong = cacMoc();
    expect(dong).toHaveLength(4);
    expect(dong[0].textContent).toContain("12.09");
    expect(dong[0].textContent).toContain("Tạo sách");
    expect(dong[0].textContent).toContain("Núi xa");
    expect(dong[1].textContent).toContain("Giữ bìa trước");
    expect(dong[1].querySelector(".tg-dong__bia--giu")).not.toBeNull();
    expect(dong[2].textContent).toContain("Đang dùng");
  });

  it("bam mot moc: bang bia rũ xuống duoi moc do, co o Giu bia truoc; moc tao sach thi khong co o giu", async () => {
    veBia();
    await moMoc(1);
    expect(cacMoc()[1].getAttribute("aria-expanded")).toBe("true");
    expect(rot(1).classList.contains("tg-rot--mo")).toBe(true);
    expect(within(rot(1)).getByRole("radio", { name: "Giữ bìa trước" })).toBeTruthy();
    expect(within(rot(1)).getByLabelText("Thêm ảnh của bạn làm bìa")).toBeTruthy();
    fireEvent.click(cacMoc()[0]);
    await act(async () => {});
    expect(rot(1).classList.contains("tg-rot--mo")).toBe(false);
    expect(within(rot(0)).queryByRole("radio", { name: "Giữ bìa trước" })).toBeNull();
  });

  it("chon mot tranh: luu ngay dung luot, cuon len, bao Da luu kem Hoan tac; Hoan tac tra lai o cu", async () => {
    veBia();
    await moMoc(1);
    fireEvent.click(within(rot(1)).getByRole("radio", { name: "Bìa thuyền nhỏ dưới trăng" }));
    await waitFor(() => expect(actionSetCoverEntry).toHaveBeenCalledTimes(1));
    const [sach, luot, fd] = actionSetCoverEntry.mock.calls[0];
    expect([sach, luot, fd.get("cover"), fd.get("coverMedia")]).toEqual([SACH, L1, "thuyen-trang", null]);
    await waitFor(() => expect(rot(1).classList.contains("tg-rot--mo")).toBe(false));
    expect(cacMoc()[1].getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Đã lưu bìa lượt 1.")).toBeTruthy();
    await bamHoanTac();
    await waitFor(() => expect(actionRemoveCoverEntry).toHaveBeenCalledWith(SACH, L1));
    await waitFor(() => expect(screen.getByText("Đã trả lại như cũ.")).toBeTruthy());
  });

  it("chon Giu bia truoc: bo o bia cua luot; Hoan tac dat lai dung tranh cu", async () => {
    veBia();
    await moMoc(2);
    fireEvent.click(within(rot(2)).getByRole("radio", { name: "Giữ bìa trước" }));
    await waitFor(() => expect(actionRemoveCoverEntry).toHaveBeenCalledWith(SACH, L2));
    await bamHoanTac();
    await waitFor(() => expect(actionSetCoverEntry).toHaveBeenCalledTimes(1));
    expect(actionSetCoverEntry.mock.calls[0][2].get("cover")).toBe("hoa-dao");
  });

  it("may chu tu choi: bang chon giu mo va bao loi ngay trong do", async () => {
    actionSetCoverEntry.mockResolvedValueOnce({ error: "Mỗi cuốn phải còn ít nhất một bìa." });
    veBia();
    await moMoc(3);
    fireEvent.click(within(rot(3)).getByRole("radio", { name: "Bìa khóm trúc" }));
    expect(await within(rot(3)).findByRole("alert")).toBeTruthy();
    expect(rot(3).classList.contains("tg-rot--mo")).toBe(true);
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
  });

  it("Esc thu bang chon lai va tra focus ve moc", async () => {
    veBia();
    await moMoc(2);
    fireEvent.keyDown(within(rot(2)).getAllByRole("radio")[0], { key: "Escape" });
    await act(async () => {});
    expect(rot(2).classList.contains("tg-rot--mo")).toBe(false);
    expect(document.activeElement).toBe(cacMoc()[2]);
  });
});

describe("dong thoi gian Nhac nen", () => {
  it("thu gon: bai phat khi mo sach kem kenh, so lan dat nhac qua so luot", () => {
    veNhac();
    const tom = tomTat();
    expect(tom.textContent).toContain("Nàng Thơ");
    expect(tom.textContent).toContain("Hoàng Dũng, 3 lần đặt nhạc qua 3 lượt đăng");
  });

  it("cac moc: bai rieng ghi ten bai, luot khong dat ghi Phat tiep, o go nhac ghi Tat nhac; doan im co soi cham", () => {
    veNhac();
    fireEvent.click(tomTat());
    const dong = cacMoc();
    expect(dong[0].textContent).toContain("Hẹn Một Mai");
    expect(dong[1].textContent).toContain("Phát tiếp");
    expect(dong[2].textContent).toContain("Tắt nhạc từ lượt này");
    expect(dong[3].textContent).toContain("Đang phát");
    const im = [...document.querySelectorAll(".tg-o")].map((li) => li.classList.contains("tg-o--im"));
    expect(im).toEqual([false, false, true, false]);
  });

  it("ba lua chon; Tat nhac luu o go nhac, Phat tiep bo o cua luot", async () => {
    veNhac();
    await moMoc(1);
    const nut = within(rot(1)).getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(nut).toEqual(["Một bài", "Phát tiếp Hẹn Một Mai", "Tắt nhạc"]);
    fireEvent.click(within(rot(1)).getByRole("radio", { name: "Tắt nhạc" }));
    await waitFor(() => expect(actionSetTrackEntry).toHaveBeenCalledTimes(1));
    expect([actionSetTrackEntry.mock.calls[0][1], actionSetTrackEntry.mock.calls[0][2].get("dropTrack")]).toEqual([L1, "1"]);
    await waitFor(() => expect(screen.getByText("Đã lưu nhạc lượt 1.")).toBeTruthy());
    cleanup();
    veNhac();
    await moMoc(3);
    fireEvent.click(within(rot(3)).getByRole("radio", { name: /^Phát tiếp/ }));
    await waitFor(() => expect(actionRemoveTrackEntry).toHaveBeenCalledWith(SACH, L3));
  });

  it("Mot bai: dan link, doc ra video thi luu; link sai thi khong gui gi", async () => {
    veNhac();
    await moMoc(1);
    fireEvent.click(within(rot(1)).getByRole("radio", { name: "Một bài" }));
    const o = within(rot(1)).getByLabelText("Link YouTube");
    fireEvent.change(o, { target: { value: "không phải link" } });
    await act(async () => {});
    expect(actionSetTrackEntry).not.toHaveBeenCalled();
    fireEvent.change(o, { target: { value: "https://youtu.be/ccccccccccc" } });
    await waitFor(() => expect(actionSetTrackEntry).toHaveBeenCalledTimes(1));
    expect(actionSetTrackEntry.mock.calls[0][2].get("music")).toBe("https://youtu.be/ccccccccccc");
  });

  it("moc tao sach: hai lua chon Mot bai va Khong nhac", async () => {
    veNhac();
    await moMoc(0);
    const nut = within(rot(0)).getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(nut).toEqual(["Một bài", "Không nhạc"]);
  });
});
