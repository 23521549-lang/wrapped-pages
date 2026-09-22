// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getSchema } from "@tiptap/core";
import { DOMSerializer, Node as PMNode } from "@tiptap/pm/model";
import { DocView } from "@/components/doc/DocView";
import { editorExtensions } from "@/components/editor/extensions";
import { Flipbook, GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { Reader } from "@/components/reader/Reader";
import { TypeReveal } from "@/components/seal/TypeReveal";
import type { DocJson, ParagraphNode } from "@/lib/doc/types";
import { PEAK_COUNT } from "@/lib/media/kinds";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/library", () => ({ actionMarkRead: vi.fn(async () => {}) }));
vi.mock("@/app/actions/seal", () => ({ actionAnswer: vi.fn(), actionGiftKey: vi.fn() }));

const ID = "0b6f3c2e-7d1a-4f5b-9c8e-2a4d6f8b0c1e";
const ID_2 = "7c1d9e4a-2b3f-4a6c-8d5e-1f0a9b8c7d6e";
const ID_3 = "3a5c7e9f-1b2d-4e6f-8a9c-0d1e2f3a4b5c";
const PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => (i * 11) % 101);
const ANH = { type: "anh", attrs: { id: ID, w: 1200, h: 900 } } as const;
const GHI_AM = { type: "ghi-am", attrs: { id: ID_2, ms: 84_000, peaks: PEAKS } } as const;
/** Ghi am khac GHI_AM, cung dung o cung vi tri trong noi dung (chi so 0) o mot to khac. */
const GHI_AM_2 = { type: "ghi-am", attrs: { id: ID_3, ms: 5_000, peaks: PEAKS } } as const;
const p = (text: string): ParagraphNode => ({ type: "paragraph", content: [{ type: "text", text }] });
/** 7 ky tu: "Xin" 3, roi anh va ghi am (0 ky tu), roi "chao" 4. */
const TO_MEDIA: DocJson = { type: "doc", content: [p("Xin"), ANH, GHI_AM, p("chào")] };

let giam = false;

function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG && giam, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Khoi media nao dang an cho luot go (theo thu tu trong trang). */
const dangAn = (c: HTMLElement) => Array.from(c.querySelectorAll("figure"), (f) => f.classList.contains("chua-go-khoi"));

beforeEach(() => {
  giam = false;
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style");
});

describe("DocView ve khoi media", () => {
  it("anh va ghi am o dung cho giua cac doan, doc qua /m, ten nguoi dang trong chu thay the va nhan", () => {
    const { container } = render(<div className="giay-noi-dung"><DocView doc={TO_MEDIA} author="Linh" /></div>);
    const vung = container.querySelector(".giay-noi-dung") as HTMLElement;
    expect(Array.from(vung.children, (el) => `${el.tagName}.${el.className}`)).toEqual(["P.", "FIGURE.khoi-anh", "FIGURE.khoi-ghi-am", "P."]);
    const img = screen.getByRole("img", { name: "Ảnh Linh đăng" });
    expect([img.getAttribute("src"), img.getAttribute("width"), img.getAttribute("height")]).toEqual([`/m/${ID}`, "304", "228"]);
    const ghiAm = screen.getByRole("figure", { name: "Linh ghi âm, dài 1:24" });
    expect([ghiAm.querySelector("audio")?.getAttribute("src"), ghiAm.querySelector("audio")?.hasAttribute("autoplay")]).toEqual([`/m/${ID_2}`, false]);
  });

  // Gioi han cua ca test nay: ca hai ben deu lay so do tu chinh imageBox, nen no bat duoc lech ten lop va lech thuoc
  // tinh, nhung khong bat duoc lech CSS (vi du giay.css dat padding cho .khoi-anh ma ban sao do lai nam duoi mot selector
  // khac). Bao dam that ve cho ngat trang nam o e2e tests/e2e/media-anh.spec.ts, ca (e).
  it("man doc va ban sao do cua man viet ve cung khoi, cung lop, cung kich thuoc, nen cho ngat trang trung nhau", () => {
    const schema = getSchema(editorExtensions("Linh"));
    const banSao = document.createElement("div");
    banSao.append(DOMSerializer.fromSchema(schema).serializeFragment(PMNode.fromJSON(schema, TO_MEDIA).content));
    const { container } = render(<div className="giay-noi-dung"><DocView doc={TO_MEDIA} author="Linh" /></div>);
    const hinh = (goc: Element) => Array.from(goc.children, (el) => {
      const hop = el.querySelector("img, .khoi-anh__cho");
      return [el.tagName, el.className, hop?.getAttribute("width") ?? null, hop?.getAttribute("height") ?? null];
    });
    expect(hinh(container.querySelector(".giay-noi-dung") as HTMLElement)).toEqual(hinh(banSao));
    expect(hinh(banSao)[1]).toEqual(["FIGURE", "khoi-anh", "304", "228"]);
  });
});

describe("TypeReveal voi khoi media", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--dur-go", ".05s");
    document.documentElement.style.setProperty("--dur-nhay", ".3s");
  });

  it("khoi media khong go: giu cho nhung an toi khi chu truoc no go xong, roi hien ngay", () => {
    const { container } = render(<TypeReveal doc={TO_MEDIA} author="Linh" />);
    expect(dangAn(container)).toEqual([true, true]);
    act(() => {
      vi.advanceTimersByTime(50 * 2);
    });
    expect(dangAn(container)).toEqual([true, true]);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(dangAn(container)).toEqual([false, false]);
    act(() => {
      vi.advanceTimersByTime(50 * 4);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect([dangAn(container), container.querySelector(".con-tro")]).toEqual([[false, false], null]);
  });

  it("giam chuyen dong thi khoi media hien ngay cung chu; to chi co media thi xong ngay", () => {
    giam = true;
    expect(dangAn(render(<TypeReveal doc={TO_MEDIA} author="Linh" />).container)).toEqual([false, false]);
    cleanup();
    giam = false;
    const onDone = vi.fn();
    const chiMedia = render(<TypeReveal doc={{ type: "doc", content: [ANH, GHI_AM] }} author="Linh" onDone={onDone} />);
    expect(dangAn(chiMedia.container)).toEqual([false, false]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("nghi thuc khong bao gio tu phat ghi am", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<TypeReveal doc={TO_MEDIA} author="Linh" />);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(play).not.toHaveBeenCalled();
  });
});

describe("Flipbook voi ghi am", () => {
  it("dang phat ma lat trang thi tieng dung ngay luc bam, ca khi to cu con nam tren man trong luc mo chong", async () => {
    giam = true;
    const animateCu = Element.prototype.animate;
    Element.prototype.animate = (() => ({ onfinish: null, cancel() {} })) as unknown as typeof Element.prototype.animate;
    try {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, "paused", { configurable: true, value: false });
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
      const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
        if (this.paused) return;
        Object.defineProperty(this, "paused", { configurable: true, value: true });
        this.dispatchEvent(new Event("pause"));
      });
      render(<Flipbook title="Thu" author="Linh" sheets={[{ type: "doc", content: [GHI_AM] }, { type: "doc", content: [p("Hai")] }]} start={0} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Phát ghi âm" }));
      });
      fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
      // Mo chong chua ket thuc nen to cu van gan trong trang: tieng dung vi Flipbook dung no, khong phai vi to bi go ra.
      expect(pause.mock.contexts.map((audio) => (audio as HTMLAudioElement).isConnected)).toEqual([true]);
      expect(screen.getByRole("button", { name: "Phát ghi âm" })).toBeTruthy();
    } finally {
      Element.prototype.animate = animateCu;
    }
  });
});

describe("Flipbook: khoi ghi am gan lai qua key kem id, khong dinh trang thai giua hai to", () => {
  it("lat tu to co ghi am A sang to co ghi am B o cung vi tri trong noi dung: gio da nghe ve lai 0:00, khong dinh tu A", async () => {
    giam = true;
    let hoatAnh: { onfinish: (() => void) | null; cancel(): void } | null = null;
    const animateCu = Element.prototype.animate;
    Element.prototype.animate = (() => {
      hoatAnh = { onfinish: null, cancel() {} };
      return hoatAnh as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;
    try {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, "paused", { configurable: true, value: false });
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
        if (this.paused) return;
        Object.defineProperty(this, "paused", { configurable: true, value: true });
        this.dispatchEvent(new Event("pause"));
      });
      const { container } = render(
        <Flipbook title="Thu" author="Linh" sheets={[{ type: "doc", content: [GHI_AM] }, { type: "doc", content: [GHI_AM_2] }]} start={0} />,
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Phát ghi âm" }));
      });
      const audioA = container.querySelector("audio") as HTMLAudioElement;
      Object.defineProperty(audioA, "currentTime", { configurable: true, value: 42 });
      fireEvent.timeUpdate(audioA);
      expect(container.querySelector(".khoi-ghi-am__gio")?.textContent).toBe("0:42 / 1:24");
      fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
      act(() => {
        hoatAnh?.onfinish?.();
      });
      // To moi co ghi am B (do dai khac han A): gio da nghe phai la 0:00 cua B, khong phai 42 giay dinh lai tu A.
      expect(container.querySelector(".khoi-ghi-am__gio")?.textContent).toBe("0:00 / 0:05");
    } finally {
      Element.prototype.animate = animateCu;
    }
  });
});

describe("Reader: to khoa", () => {
  it("to khoa chi ve dong he lo va vach nhoe, khong bao gio ve khoi media", () => {
    const { container } = render(
      <Reader
        bookId="b1"
        title="Thu"
        sheets={[TO_MEDIA]}
        looks={[{ kind: "khoa", teaser: null }]}
        seals={[]}
        ownerName="Linh"
        readerName="Mạnh"
        now={new Date("2026-09-16T00:00:00.000Z")}
        start={0}
        revealAt={null}
        mark={0}
        trackRead={false}
        mine={false}
        editedAt={[null]}
        editHref={[null]}
      />,
    );
    expect(container.querySelector(".to-giay")).not.toBeNull();
    expect(container.querySelectorAll("figure, img, audio")).toHaveLength(0);
  });
});
