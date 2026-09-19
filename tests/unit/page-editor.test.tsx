// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { PageEditor, type PageEditorProps } from "@/components/editor/PageEditor";
import { pageEditKey } from "@/components/editor/pageEdit";
import type { OneSheet } from "@/components/editor/useOneSheet";
import type { DocJson, ListItemNode } from "@/lib/doc/types";

/*
 * Man sua mot to da dang tren TipTap that. Phep do mot to (useOneSheet, measureOneSheet) la gia de dieu khien tran; phep do
 * that da co bai rieng (one-sheet.test.ts) va la dung ham cua trang tra loi.
 */

const { actionEditPage, push, refresh, fit, measureOneSheet } = vi.hoisted(() => ({
  actionEditPage: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  fit: { value: { overflow: false, contentHeight: 120 } as OneSheet },
  measureOneSheet: vi.fn(),
}));
vi.mock("@/app/actions/library", () => ({ actionEditPage }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), unstable_rethrow: () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/components/editor/useOneSheet", () => ({ useOneSheet: () => fit.value, measureOneSheet }));

const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const MOC = "2026-09-18T07:05:00.000Z";
const KHOA = pageEditKey(SACH, 5);
const VE_SACH = `/sach/${SACH}?trang=5`;
const CU = "Trang này vừa được sửa ở nơi khác. Tải lại để xem bản mới.";

const doan = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
const muc = (text: string, noiTiep = false): ListItemNode =>
  noiTiep ? { type: "listItem", noiTiep: true, content: [doan(text)] } : { type: "listItem", content: [doan(text)] };

const DOC: DocJson = { type: "doc", content: [{ type: "bulletList", content: [muc("tiếp", true), muc("mới")] }, doan("Chiều nay.")] };
const DOC_ANH: DocJson = { type: "doc", content: [doan("Ảnh:"), { type: "anh", attrs: { id: ID, w: 800, h: 600 } }, doan("cuối")] };

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function props(p: Partial<PageEditorProps> = {}): PageEditorProps {
  return {
    bookId: SACH, bookTitle: "Chuyện chưa kể", position: 5, initialDoc: DOC, version: MOC, publishedAt: MOC, editedAt: null,
    now: "2026-09-20T02:00:00.000Z", author: "Linh", mediaEnabled: true, ...p,
  };
}

async function xong() {
  for (let i = 0; i < 10; i++) await act(async () => {});
}

async function ve(p: Partial<PageEditorProps> = {}) {
  const r = render(<PageEditor {...props(p)} />);
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
}

const nut = (ten: string) => screen.getByRole("button", { name: ten });

beforeEach(() => {
  // jsdom khong co hinh hoc cua Range; ProseMirror can no de cuon toi con tro sau khi focus.
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
  fit.value = { overflow: false, contentHeight: 120 };
  measureOneSheet.mockReset();
  measureOneSheet.mockReturnValue({ overflow: false, contentHeight: 120 });
  for (const f of [actionEditPage, push, refresh]) f.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PageEditor", () => {
  it("vao man: tieu de, dong phu, trang thai vua mot trang, vung soan thao co nhan va dang co focus", async () => {
    await ve();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sửa trang 5");
    expect(screen.getByText("Chuyện chưa kể, đăng 18.09")).toBeTruthy();
    expect(document.querySelector("output#vua-trang")?.textContent).toBe("Vừa một trang");
    const vung = document.querySelector(".ProseMirror");
    expect(vung?.getAttribute("aria-label")).toBe("Trang đang sửa");
    expect(vung?.getAttribute("aria-describedby")).toBe("vua-trang");
    expect(document.activeElement).toBe(vung);
  });

  it("da sua hom qua: dong phu noi them", async () => {
    await ve({ editedAt: "2026-09-19T07:00:00.000Z" });
    expect(screen.getByText("Chuyện chưa kể, đăng 18.09, đã sửa hôm qua")).toBeTruthy();
  });

  it("tran: output doi chu, nut luu khoa, vach het trang hien", async () => {
    fit.value = { overflow: true, contentHeight: 600 };
    const { container } = await ve();
    const output = container.querySelector("output#vua-trang");
    expect(output?.textContent).toBe("!Đã tràn khỏi trang, cần gọn lại");
    expect(output?.classList.contains("vua-trang--tran")).toBe(true);
    expect((nut("Lưu thay đổi") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".het-cho")?.getAttribute("data-hien")).toBe("co");
  });

  it("chua doi gi: Huy va Luu deu chi ve man doc, khong hoi, khong goi action", async () => {
    await ve();
    fireEvent.click(nut("Hủy"));
    expect(push).toHaveBeenLastCalledWith(VE_SACH);
    expect(screen.queryByRole("group", { name: "Bỏ các thay đổi trên trang này?" })).toBeNull();
    fireEvent.click(nut("Lưu thay đổi"));
    await xong();
    expect(push).toHaveBeenCalledTimes(2);
    expect(actionEditPage).not.toHaveBeenCalled();
  });

  it("da doi, bam Huy: hoi lai, focus o Sua tiep; Esc dong va tra focus ve Huy; Bo thay doi xoa ban tam roi ve", async () => {
    await ve();
    await go(" thêm");
    fireEvent.click(nut("Hủy"));
    const hop = screen.getByRole("group", { name: "Bỏ các thay đổi trên trang này?" });
    expect(document.activeElement).toBe(within(hop).getByRole("button", { name: "Sửa tiếp" }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(hop, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Bỏ các thay đổi trên trang này?" })).toBeNull();
    expect(document.activeElement).toBe(nut("Hủy"));
    fireEvent.click(nut("Hủy"));
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    fireEvent.click(nut("Bỏ thay đổi"));
    expect(sessionStorage.getItem(KHOA)).toBeNull();
    expect(push).toHaveBeenLastCalledWith(VE_SACH);
  });

  it("ban tam: ghi moi lan go, cung version thi khoi phuc kem dong bao va nut Dung ban da dang", async () => {
    await ve();
    await go(" thêm");
    expect(JSON.parse(sessionStorage.getItem(KHOA) ?? "null")).toMatchObject({ version: MOC, doc: { type: "doc" } });
    cleanup();
    await ve();
    expect(document.querySelector(".ProseMirror")?.textContent).toContain("Chiều nay. thêm");
    const bao = screen.getByText("Đã khôi phục chữ đang sửa dở.");
    expect(bao.closest('[aria-live="polite"]')).not.toBeNull();
    fireEvent.click(nut("Dùng bản đã đăng"));
    await xong();
    expect(document.querySelector(".ProseMirror")?.textContent).not.toContain("thêm");
    expect(sessionStorage.getItem(KHOA)).toBeNull();
    expect(screen.queryByText("Đã khôi phục chữ đang sửa dở.")).toBeNull();
  });

  it("ban tam cua version khac: khong khoi phuc", async () => {
    await ve();
    await go(" thêm");
    cleanup();
    await ve({ version: "2026-09-19T01:00:00.000Z" });
    expect(document.querySelector(".ProseMirror")?.textContent).not.toContain("thêm");
    expect(screen.queryByText("Đã khôi phục chữ đang sửa dở.")).toBeNull();
  });

  it("luu co doi: khoa vung soan thao truoc khi goi action, gui tai lieu da lam sach va giu dau noi tiep", async () => {
    await ve();
    await go(" thêm");
    let sua: boolean | null = null;
    actionEditPage.mockImplementation(async () => {
      sua = soanThao().isEditable;
      return new Promise(() => {});
    });
    await act(async () => {
      fireEvent.click(nut("Lưu thay đổi"));
    });
    expect(sua).toBe(false);
    expect(actionEditPage).toHaveBeenCalledTimes(1);
    const [sach, viTri, doc, moc] = actionEditPage.mock.calls[0];
    expect([sach, viTri, moc]).toEqual([SACH, 5, MOC]);
    expect(doc).toEqual({ type: "doc", content: [{ type: "bulletList", content: [muc("tiếp", true), muc("mới")] }, doan("Chiều nay. thêm")] });
  });

  it("action bao trang vua duoc sua noi khac: loi, mo khoa, giu ban tam, Tai lai hoi roi lam moi", async () => {
    await ve();
    await go(" thêm");
    actionEditPage.mockResolvedValue({ error: CU });
    await act(async () => {
      fireEvent.click(nut("Lưu thay đổi"));
    });
    await xong();
    expect(screen.getByRole("alert").textContent).toBe(CU);
    expect(soanThao().isEditable).toBe(true);
    expect(sessionStorage.getItem(KHOA)).not.toBeNull();
    fireEvent.click(nut("Tải lại"));
    const hop = screen.getByRole("group", { name: "Bỏ các thay đổi trên trang này?" });
    expect(document.activeElement).toBe(within(hop).getByRole("button", { name: "Sửa tiếp" }));
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(within(hop).getByRole("button", { name: "Tải bản mới" }));
    expect(sessionStorage.getItem(KHOA)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("do trang nem loi: bao loi, mo khoa, khong goi action", async () => {
    await ve();
    await go(" thêm");
    measureOneSheet.mockImplementation(() => {
      throw new Error("lech");
    });
    await act(async () => {
      fireEvent.click(nut("Lưu thay đổi"));
    });
    expect(screen.getByRole("alert").textContent).toBe("Chưa đo được trang. Thử lại sau một giây.");
    expect(soanThao().isEditable).toBe(true);
    expect(actionEditPage).not.toHaveBeenCalled();
  });

  it("bo mot anh cua ban goc thi bao truoc se xoa han; hoan tac thi dong bao mat", async () => {
    await ve({ initialDoc: DOC_ANH });
    const bao = "Ảnh hoặc ghi âm bỏ khỏi trang sẽ bị xóa hẳn sau khi lưu.";
    expect(screen.queryByText(bao)).toBeNull();
    await act(async () => {
      const ed = soanThao();
      let tu = -1;
      ed.state.doc.forEach((node, offset) => {
        if (node.type.name === "anh") tu = offset;
      });
      ed.chain().deleteRange({ from: tu, to: tu + 1 }).run();
    });
    expect(screen.getByText(bao).classList.contains("field__help")).toBe(true);
    await act(async () => {
      soanThao().commands.undo();
    });
    expect(screen.queryByText(bao)).toBeNull();
  });

  it("co nhom Them vao trang, khong co nut Tap trung", async () => {
    await ve();
    const nhom = screen.getByRole("group", { name: "Thêm vào trang" });
    expect(within(nhom).getByRole("button", { name: "Thêm ảnh" })).toBeTruthy();
    expect(within(nhom).getByRole("button", { name: "Ghi âm" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tập trung" })).toBeNull();
  });

  it("beforeunload chi chan khi da doi ma chua gui", async () => {
    await ve();
    const roi = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(roi()).toBe(false);
    await go(" thêm");
    expect(roi()).toBe(true);
  });
});
