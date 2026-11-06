// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublishButton, PublishPanel, usePublish, type PublishDeps } from "@/components/editor/PublishBar";
import { SealKinds } from "@/components/editor/SealPicker";
import { RoundEditor, type RoundEditorProps } from "@/components/editor/RoundEditor";
import type { TrimInput } from "@/lib/book";
import type { DocJson } from "@/lib/doc/types";

/*
 * Khoang Lang tren cau chu (task 11, Q2a): cac cau nhac ten doi phuong trong khung dang/niem phong dung ten chung
 * "người đọc" khi trang truyen ten chung xuong (trang truyen "người đọc" thay biet danh khi bat co). Tat co thi cau cu
 * nguyen ven. Test nay khoa cau chu o muc component; viec trang truyen dung ten do nam o cac page viet/sua-luot.
 */

const { actionPublish, actionEditRound, push, refresh, bo, cutSheets, processImage } = vi.hoisted(() => ({
  actionPublish: vi.fn(async (..._args: unknown[]) => ({ error: "Chưa đăng được." })),
  actionEditRound: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  bo: { value: { sheetCount: 3, chars: 120, breaks: [] as readonly number[] } },
  cutSheets: vi.fn(),
  processImage: vi.fn(),
}));
vi.mock("@/app/actions/library", () => ({ actionPublish, actionEditRound }));
vi.mock("@/app/actions/media", () => ({ actionUploadMedia: vi.fn() }));
vi.mock("@/components/editor/processImage", () => ({ processImage }));
vi.mock("@/components/editor/usePagedLayout", () => ({ usePagedLayout: () => bo.value }));
vi.mock("@/components/editor/cutSheets", () => ({ cutSheets }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), unstable_rethrow: () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

const O_TRONG: TrimInput = { cover: null, coverMediaId: null, youtubeId: null, dropTrack: false };
const SHEET: DocJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Mot" }] }] };

function Khung(p: PublishDeps & { onCancel: () => void }) {
  const flow = usePublish(p);
  return (
    <>
      <PublishButton flow={flow} />
      <button type="button" onClick={flow.refresh}>Xếp lại</button>
      {flow.open && <PublishPanel flow={flow} bookId={p.bookId} bookTitle="Chuyện chưa kể" partnerNickname={p.partnerNickname} oLuot={O_TRONG} onCancel={() => { p.onCancel(); flow.cancel(); }} />}
    </>
  );
}

function moHop(partnerNickname: string | null) {
  render(<Khung bookId="b" partnerNickname={partnerNickname} prepare={vi.fn((): { sheets: DocJson[] } | { error: string } => ({ sheets: [SHEET] }))} beforePublish={vi.fn(async () => {})} afterFail={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng trang" }));
}

const cauXacNhan = () => document.querySelector(".dang-hoi__chu")?.textContent;

afterEach(() => {
  cleanup();
  actionPublish.mockClear();
});

describe("Khoang Lang: cau xac nhan dang trang", () => {
  it("tat co (kiem soat duong): cau xac nhan goi ten doi phuong nhu cu", () => {
    moHop("Linh");
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, Linh đọc được ngay.");
    fireEvent.click(screen.getByRole("radio", { name: /Trao đổi/ }));
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, mở khi Linh viết trang trả lời.");
  });

  it("ten chung: cau xac nhan dung 'người đọc', khong ten doi phuong", () => {
    moHop("người đọc");
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, người đọc đọc được ngay.");
    fireEvent.click(screen.getByRole("radio", { name: /Câu đố/ }));
    expect(document.querySelector(".niem__ghi")?.textContent).toBe("người đọc cần trả lời đúng mới đọc được.");
    fireEvent.click(screen.getByRole("radio", { name: /Trao đổi/ }));
    expect(cauXacNhan()).toBe("Đăng 1 trang vào Chuyện chưa kể, mở khi người đọc viết trang trả lời.");
    expect(document.body.textContent).not.toContain("Linh");
  });
});

describe("Khoang Lang: lua chon niem phong", () => {
  it("ten chung: lua chon dung 'người đọc', khong ten doi phuong", () => {
    render(<SealKinds partnerNickname="người đọc" value="khong" onChange={() => {}} disabled={false} />);
    expect(document.body.textContent).toContain("Chọn cách người đọc mở những trang này.");
    expect(document.body.textContent).toContain("người đọc đọc được ngay.");
    expect(document.body.textContent).not.toContain("Linh");
  });
});

const doan = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
const to = (text: string): DocJson => ({ type: "doc", content: [doan(text)] });
const DOC: DocJson = { type: "doc", content: [doan("Chiều nay."), doan("Mai kể tiếp.")] };
const SACH = "5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a";
const LUOT = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
const MOC = "2026-09-18T07:05:00.000Z";

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  // jsdom khong co hinh hoc cua Range; ProseMirror can no de cuon toi con tro sau khi focus.
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
  cutSheets.mockReturnValue([to("Chiều nay."), to("Mai kể tiếp.")]);
});

function propsRound(p: Partial<RoundEditorProps> = {}): RoundEditorProps {
  return {
    bookId: SACH, bookTitle: "Chuyện chưa kể", roundId: LUOT, ordinal: 2, first: 6, initialDoc: DOC, version: MOC,
    publishedAt: MOC, editedAt: null, now: "2026-09-20T02:00:00.000Z", startSheet: 1, author: "Linh", mediaEnabled: true,
    niemPhong: false, partnerNickname: "Mạnh", ...p,
  };
}

async function veRound(p: Partial<RoundEditorProps> = {}) {
  const r = render(<RoundEditor {...propsRound(p)} />);
  for (let i = 0; i < 10; i++) await act(async () => {});
  await act(async () => {
    await new Promise((xongKhung) => requestAnimationFrame(() => xongKhung(null)));
  });
  return r;
}

describe("Khoang Lang: dong bao niem phong khi sua luot", () => {
  it("ten chung: dong bao dung 'người đọc', khong ten doi phuong", async () => {
    await veRound({ niemPhong: true, partnerNickname: "người đọc" });
    expect(document.querySelector(".sua-ghi")?.textContent).toContain("Lượt này đang niêm phong với người đọc.");
    expect(document.body.textContent).not.toContain("Mạnh");
  });
});
