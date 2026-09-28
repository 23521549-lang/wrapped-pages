// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { RoundEditor, type RoundEditorProps } from "@/components/editor/RoundEditor";
import { ROUND_EDIT_TEMP_MAX_MS, roundEditKey, roundEditTemp } from "@/components/editor/roundEdit";
import { markedExcerpt } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { PUBLISH_TOTAL_MAX_CHARS } from "@/lib/doc/validate";

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
    publishedAt: MOC, editedAt: null, now: "2026-09-20T02:00:00.000Z", startSheet: 1, author: "Linh", mediaEnabled: true,
    niemPhong: false, partnerNickname: "Mạnh", ...p,
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

/** Cho luat chi-them tinh lai (no doi nguoi viet ngung go mot nhip, 300ms). */
async function choTinh() {
  await act(async () => {
    await new Promise((xongNhip) => setTimeout(xongNhip, 400));
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

  it("chon duoc doan tren ke ngay trong man sua luot, va bo lai duoc", async () => {
    const { container } = await ve();
    const nut = () => screen.getByRole("button", { name: /đoạn trên kệ$/ });
    expect([nut().textContent, nut().getAttribute("aria-disabled")]).toEqual(["Chọn làm đoạn trên kệ", "true"]);
    await act(async () => {
      soanThao().commands.setTextSelection({ from: 1, to: 7 });
    });
    await bam("Chọn làm đoạn trên kệ");
    expect(markedExcerpt(soanThao().getJSON() as DocJson)).toBe("Chiều");
    expect([nut().textContent, nut().getAttribute("aria-pressed")]).toEqual(["Bỏ đoạn trên kệ", "true"]);
    expect(container.querySelector("p.sr-only[aria-live]")?.textContent).toBe("Đã chọn đoạn trên kệ.");
    await bam("Bỏ đoạn trên kệ");
    expect(markedExcerpt(soanThao().getJSON() as DocJson)).toBeNull();
    expect(container.querySelector("p.sr-only[aria-live]")?.textContent).toBe("Đã bỏ đoạn trên kệ.");
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

  it("dang gui: ban tam va canh bao dong tab con nguyen; chi bo khi may chu da nhan xong", async () => {
    let traLoi: (v: undefined) => void = () => {};
    actionEditRound.mockReturnValue(new Promise<undefined>((giaiQuyet) => {
      traLoi = giaiQuyet;
    }));
    await ve();
    await go(" Thêm.");
    await bam("Lưu thay đổi");
    expect(actionEditRound).toHaveBeenCalledTimes(1);
    // Request dang bay: dong tab dung luc nay thi chu phai con o ban tam, va tab phai hoi truoc khi dong.
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    const dangBay = new Event("beforeunload", { cancelable: true });
    fireEvent(window, dangBay);
    expect(dangBay.defaultPrevented).toBe(true);

    await act(async () => {
      traLoi(undefined);
    });
    await xong();
    expect(sessionStorage.getItem(KHOA)).toBeNull();
    const daXong = new Event("beforeunload", { cancelable: true });
    fireEvent(window, daXong);
    expect(daXong.defaultPrevented).toBe(false);
  });

  it("gui hong (mat mang): giu ban tam, bao loi, va van canh bao truoc khi dong tab", async () => {
    actionEditRound.mockRejectedValue(new Error("mat mang"));
    await ve();
    await go(" Thêm.");
    await bam("Lưu thay đổi");
    expect(screen.getByRole("alert").textContent).toBe("Chưa lưu được. Kiểm tra mạng rồi thử lại.");
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    const conDo = new Event("beforeunload", { cancelable: true });
    fireEvent(window, conDo);
    expect(conDo.defaultPrevented).toBe(true);
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

  it("luon co dong luat; luot niem phong thi them dong bao niem phong voi ten nguoi kia", async () => {
    await ve();
    expect(screen.getByText("Chỉ viết thêm và sửa chính tả. Chữ, ảnh và ghi âm đã đăng không xoá được.")).toBeTruthy();
    expect(screen.queryByText(/đang niêm phong/)).toBeNull();
    cleanup();
    await ve({ niemPhong: true });
    expect(screen.getByText("Lượt này đang niêm phong với Mạnh. Sửa xong vẫn giữ niêm phong như cũ.")).toBeTruthy();
  });

  it("xoa mot chu cu: chu do hien gach ngang dung cho, Luu bi khoa; bam vao thi tra lai dung cho", async () => {
    await ve();
    // "Chiều nay." nam o vi tri 1..11: "nay" la 7..10.
    await act(async () => {
      soanThao().commands.deleteRange({ from: 7, to: 10 });
    });
    await choTinh();
    const mat = document.querySelector<HTMLElement>(".chu-mat");
    expect(mat?.textContent).toBe("nay");
    expect(mat?.getAttribute("role")).toBe("button");
    expect(screen.getByText("Còn 1 chữ cũ bị xoá.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(mat as HTMLElement);
    });
    await choTinh();
    expect(soanThao().getText()).toContain("Chiều nay.");
    expect(document.querySelector(".chu-mat")).toBeNull();
    expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Tra lai het: moi chu cu bi xoa ve dung cho", async () => {
    await ve();
    await act(async () => {
      soanThao().commands.deleteRange({ from: 7, to: 10 });
    });
    await act(async () => {
      // Lan xoa truoc lui moi vi tri sau no 3: "Mai kể tiếp." nay bat dau o 10, "kể " la 14..17.
      soanThao().commands.deleteRange({ from: 14, to: 17 });
    });
    await choTinh();
    expect(document.querySelectorAll(".chu-mat").length).toBe(2);
    await bam("Trả lại hết");
    await choTinh();
    expect(document.querySelector(".chu-mat")).toBeNull();
    expect(soanThao().getText()).toMatch(/^Chiều nay\.\s+Mai kể tiếp\.$/);
  });

  it("go them va sua chinh ta: chu moi co nen, bao so chu them va sua; Luu van bam duoc", async () => {
    await ve({ initialDoc: { type: "doc", content: [doan("Em ngồi bên cửa sỏ.")] } });
    await act(async () => {
      // "Em ngồi bên cửa sỏ." bat dau o 1: "sỏ" la 17..19, sua thanh "sổ".
      soanThao().chain().insertContentAt({ from: 17, to: 19 }, "sổ").run();
    });
    await go(" Trời mưa.");
    await choTinh();
    expect([...document.querySelectorAll(".chu-moi")].map((x) => x.textContent)).toEqual(["sổ", "Trời mưa"]);
    expect(screen.getByText("Viết thêm 2 chữ, sửa 1 lỗi chính tả. Chữ nền xanh nhạt là chữ bạn vừa thêm hay vừa sửa.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("anh cua ban da dang: khong co nut Bo anh, va khong xoa duoc bang ban phim hay lenh", async () => {
    await ve({ initialDoc: DOC_ANH });
    expect(screen.queryByRole("button", { name: "Bỏ ảnh" })).toBeNull();
    await act(async () => {
      soanThao().commands.setContent({ type: "doc", content: [doan("Ảnh:"), doan("cuối")] });
    });
    expect(JSON.stringify(soanThao().getJSON())).toContain(ANH);
    await act(async () => {
      soanThao().commands.deleteRange({ from: 5, to: 8 });
    });
    expect(JSON.stringify(soanThao().getJSON())).toContain(ANH);
  });

  it("?trang=3: con tro o dau to 3 va cuon toi to do", async () => {
    // DOC: doan dau chiem vi tri 0..12, chu cua doan hai bat dau o 13.
    bo.value = { sheetCount: 3, chars: 120, breaks: [5, 13] };
    await ve({ startSheet: 3 });
    expect(soanThao().state.selection.from).toBe(13);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  // Tran cua man sua luot la tran cua mot lan dang (PUBLISH_TOTAL_MAX_CHARS = 100 000), khong phai tran cua mot ban
  // nhap: mot luot da dang 25 000 ky tu phai sua duoc, nen bo dem cung phai noi dung con so may chu that su xet.
  it("bo dem: gan tran cua mot luot thi hien so ky tu, vuot thi bao cau rieng cua man sua luot", async () => {
    expect(PUBLISH_TOTAL_MAX_CHARS).toBe(100_000);
    bo.value = { sheetCount: 3, chars: 25_000, breaks: [] };
    await ve();
    expect(screen.queryByText(/ký tự$/)).toBeNull();
    cleanup();
    bo.value = { sheetCount: 3, chars: 92_500, breaks: [] };
    await ve();
    expect(screen.getByText("92 500 / 100 000 ký tự")).toBeTruthy();
    cleanup();
    bo.value = { sheetCount: 3, chars: 100_001, breaks: [] };
    await ve();
    expect(screen.getByText("Vượt 100 000 ký tự, chưa lưu được. Bớt chữ rồi lưu lại.")).toBeTruthy();
  });
});
