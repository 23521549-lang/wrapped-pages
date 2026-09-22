// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { RoundEditor, type RoundEditorProps } from "@/components/editor/RoundEditor";
import { ROUND_EDIT_TEMP_MAX_MS, roundEditKey, roundEditTemp } from "@/components/editor/roundEdit";
import type { DocJson } from "@/lib/doc/types";

/*
 * Man sua luot tren TipTap that. Bo xep trang (usePagedLayout) va phep cat to (cutSheets) la gia de dieu khien so to va
 * cac to gui di; phep do that cua chung da co bai rieng va e2e sua-luot chay chung tren trinh duyet that.
 */

const { actionEditRound, push, refresh, bo, cutSheets, processImage } = vi.hoisted(() => ({
  actionEditRound: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  bo: { value: { sheetCount: 3, chars: 120, breaks: [] as readonly number[] } },
  cutSheets: vi.fn(),
  processImage: vi.fn(),
}));
vi.mock("@/app/actions/library", () => ({ actionEditRound }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("@/components/editor/processImage", () => ({ processImage }));
vi.mock("@/components/editor/usePagedLayout", () => ({ usePagedLayout: () => bo.value }));
vi.mock("@/components/editor/cutSheets", () => ({ cutSheets }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), unstable_rethrow: () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const LUOT = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
const ANH = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const MOC = "2026-09-18T07:05:00.000Z";
const KHOA = roundEditKey(LUOT);
const VE_SACH = `/sach/${SACH}?trang=6`;
const CU = "Lượt này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.";
const HOI = "Bỏ các thay đổi trong lượt này?";

const doan = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
const to = (text: string): DocJson => ({ type: "doc", content: [doan(text)] });
const DOC: DocJson = { type: "doc", content: [doan("Chiều nay."), doan("Mai kể tiếp.")] };
const DOC_ANH: DocJson = { type: "doc", content: [doan("Ảnh:"), { type: "anh", attrs: { id: ANH, w: 800, h: 600 } }, doan("cuối")] };

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function props(p: Partial<RoundEditorProps> = {}): RoundEditorProps {
  return {
    bookId: SACH, bookTitle: "Chuyện chưa kể", roundId: LUOT, ordinal: 2, first: 6, initialDoc: DOC, version: MOC,
    publishedAt: MOC, editedAt: null, now: "2026-09-20T02:00:00.000Z", startSheet: 1, author: "Linh", mediaEnabled: true, ...p,
  };
}

async function xong() {
  for (let i = 0; i < 10; i++) await act(async () => {});
}

async function ve(p: Partial<RoundEditorProps> = {}) {
  const r = render(<RoundEditor {...props(p)} />);
  await xong();
  // TipTap dat focus trong mot khung ve (requestAnimationFrame).
  await act(async () => {
    await new Promise((xongKhung) => requestAnimationFrame(() => xongKhung(null)));
  });
  return r;
}

function soanThao(): TiptapEditor {
  const el = document.querySelector(".ProseMirror") as (HTMLElement & { editor?: TiptapEditor }) | null;
  if (!el?.editor) throw new Error("chua co trinh soan thao");
  return el.editor;
}

async function go(text: string) {
  await act(async () => {
    soanThao().chain().focus("end").insertContent(text).run();
  });
  // focus cua TipTap chay trong mot khung ve: cho no xong de no khong cuop focus cua buoc sau.
  await act(async () => {
    await new Promise((xongKhung) => requestAnimationFrame(() => xongKhung(null)));
  });
}

async function bam(ten: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: ten }));
  });
  await xong();
}

beforeEach(() => {
  // jsdom khong co hinh hoc cua Range; ProseMirror can no de cuon toi con tro sau khi focus.
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  // jsdom chi bao "Not implemented" cho window.scrollTo; man sua luot goi no khi mo dung to ?trang=.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
  bo.value = { sheetCount: 3, chars: 120, breaks: [] };
  for (const f of [actionEditRound, push, refresh, processImage, cutSheets]) f.mockReset();
  cutSheets.mockReturnValue([to("Chiều nay."), to("Mai kể tiếp.")]);
});

afterEach(() => {
  cleanup();
});

describe("RoundEditor", () => {
  it("vao man: tieu de, dong phu, so to, vung soan thao co nhan va co focus, so trang in tu to dau cua luot", async () => {
    await ve();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sửa lượt 2");
    expect(screen.getByText("Chuyện chưa kể, đăng 18.09")).toBeTruthy();
    expect(screen.getByText("3 trang")).toBeTruthy();
    const vung = document.querySelector(".ProseMirror");
    expect(vung?.getAttribute("aria-label")).toBe("Lượt đang sửa");
    expect(document.activeElement).toBe(vung);
    expect([...document.querySelectorAll(".to-giay__so")].map((x) => x.textContent)).toEqual(["6", "7", "8"]);
    expect(screen.getByRole("link", { name: "Về sách" }).getAttribute("href")).toBe(VE_SACH);
  });

  it("da sua hom qua: dong phu noi them", async () => {
    await ve({ editedAt: "2026-09-19T07:00:00.000Z" });
    expect(screen.getByText("Chuyện chưa kể, đăng 18.09, đã sửa hôm qua")).toBeTruthy();
  });

  it("chua doi gi: Huy va Luu deu chi ve man doc, khong cat trang, khong goi action", async () => {
    await ve();
    await bam("Hủy");
    expect(push).toHaveBeenLastCalledWith(VE_SACH);
    await bam("Lưu thay đổi");
    expect(push).toHaveBeenCalledTimes(2);
    expect(cutSheets).not.toHaveBeenCalled();
    expect(actionEditRound).not.toHaveBeenCalled();
  });

  it("da doi: Luu cat trang va gui ma luot, cac to da qua kiem, moc phien ban; ban tam bi xoa", async () => {
    actionEditRound.mockResolvedValue(undefined);
    await ve();
    await go(" Thêm.");
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    await bam("Lưu thay đổi");
    expect(actionEditRound).toHaveBeenCalledWith(SACH, LUOT, [to("Chiều nay."), to("Mai kể tiếp.")], MOC);
    expect(sessionStorage.getItem(KHOA)).toBeNull();
  });

  it("cat ra rong, qua 40 to hay cat hong: bao dung cau, khong goi action, vung soan thao mo lai", async () => {
    await ve();
    await go(" Thêm.");
    const truongHop: [DocJson[] | null, string][] = [
      [[], "Lượt phải còn ít nhất một trang không trống."],
      [Array.from({ length: 41 }, () => to("x")), "Mỗi lượt tối đa 40 trang."],
      [null, "Chưa cắt được trang. Thử sửa một chút rồi lưu lại."],
    ];
    for (const [tra, loi] of truongHop) {
      if (tra === null) {
        cutSheets.mockImplementationOnce(() => {
          throw new Error("ban sao lech");
        });
      } else {
        cutSheets.mockReturnValueOnce(tra);
      }
      await bam("Lưu thay đổi");
      expect(screen.getByRole("alert").textContent).toBe(loi);
      expect(soanThao().isEditable).toBe(true);
    }
    expect(actionEditRound).not.toHaveBeenCalled();
  });

  it("action bao luot vua sua noi khac: hien loi va nut Tai lai, giu ban tam; Tai ban moi thi lam moi trang", async () => {
    actionEditRound.mockResolvedValue({ error: CU });
    await ve();
    await go(" Thêm.");
    await bam("Lưu thay đổi");
    expect(screen.getByRole("alert").textContent).toBe(CU);
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    await bam("Tải lại");
    const hoi = screen.getByRole("group", { name: HOI });
    expect(document.activeElement).toBe(within(hoi).getByRole("button", { name: "Sửa tiếp" }));
    await act(async () => {
      fireEvent.click(within(hoi).getByRole("button", { name: "Tải bản mới" }));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(KHOA)).toBeNull();
  });

  it("Huy khi da doi: hop xac nhan, Esc dong va tra focus ve Huy, Bo thay doi thi ve man doc", async () => {
    await ve();
    await go(" Thêm.");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    const hoi = screen.getByRole("group", { name: HOI });
    expect(document.activeElement).toBe(within(hoi).getByRole("button", { name: "Sửa tiếp" }));
    fireEvent.keyDown(hoi, { key: "Escape" });
    expect(screen.queryByRole("group", { name: HOI })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenLastCalledWith(VE_SACH);
    expect(actionEditRound).not.toHaveBeenCalled();
  });

  it("ban tam cung moc thi khoi phuc va bao; Dung ban da dang tra ve noi dung goc; ban tam khac moc thi xoa", async () => {
    sessionStorage.setItem(KHOA, roundEditTemp(MOC, { type: "doc", content: [doan("Bản tạm.")] }, Date.now()));
    await ve();
    expect(soanThao().getText()).toContain("Bản tạm.");
    expect(screen.getByText("Đã khôi phục chữ đang sửa dở.")).toBeTruthy();
    await bam("Dùng bản đã đăng");
    expect(soanThao().getText()).toContain("Chiều nay.");
    expect(sessionStorage.getItem(KHOA)).toBeNull();
    cleanup();

    sessionStorage.setItem(KHOA, roundEditTemp("2020-01-01T00:00:00.000Z", { type: "doc", content: [doan("Bản tạm.")] }, Date.now()));
    await ve();
    expect(soanThao().getText()).not.toContain("Bản tạm.");
    expect(sessionStorage.getItem(KHOA)).toBeNull();
  });

  it("vao man don ban tam cu cua luot khac va ban tam cua man sua mot to da bo", async () => {
    const khac = roundEditKey("11111111-2222-4333-8444-555555555555");
    sessionStorage.setItem(khac, roundEditTemp(MOC, { type: "doc", content: [doan("x")] }, Date.now() - ROUND_EDIT_TEMP_MAX_MS - 1));
    sessionStorage.setItem("mqce-sua-trang-abc-1", "{}");
    await ve();
    expect(sessionStorage.getItem(khac)).toBeNull();
    expect(sessionStorage.getItem("mqce-sua-trang-abc-1")).toBeNull();
  });

  it("bo anh cua ban goc thi bao truoc anh se bi xoa sau khi luu", async () => {
    await ve({ initialDoc: DOC_ANH });
    await act(async () => {
      soanThao().commands.setContent({ type: "doc", content: [doan("Ảnh:"), doan("cuối")] });
    });
    expect(screen.getByText("Ảnh hoặc ghi âm bỏ khỏi lượt sẽ bị xóa hẳn sau khi lưu.")).toBeTruthy();
  });

  it("?trang=3: con tro o dau to 3 va cuon toi to do", async () => {
    // DOC: doan dau chiem vi tri 0..12, chu cua doan hai bat dau o 13.
    bo.value = { sheetCount: 3, chars: 120, breaks: [5, 13] };
    await ve({ startSheet: 3 });
    expect(soanThao().state.selection.from).toBe(13);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("bo dem: gan tran thi hien so ky tu, vuot tran thi bao cau rieng cua man sua luot", async () => {
    bo.value = { sheetCount: 3, chars: 18_500, breaks: [] };
    await ve();
    expect(screen.getByText("18 500 / 20 000 ký tự")).toBeTruthy();
    cleanup();
    bo.value = { sheetCount: 3, chars: 20_001, breaks: [] };
    await ve();
    expect(screen.getByText("Vượt 20 000 ký tự, chưa lưu được. Bớt chữ rồi lưu lại.")).toBeTruthy();
  });
});
