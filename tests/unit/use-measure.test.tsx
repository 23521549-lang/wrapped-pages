// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { measureUnits } from "@/components/editor/measure";
import { CHO_MS, useMeasure } from "@/components/editor/useMeasure";
import type { Unit } from "@/lib/paginate";

vi.mock("@/components/editor/measure", () => ({ measureUnits: vi.fn() }));

/**
 * Lich do dung chung cua man viet (usePagedLayout) va trang tra loi (useOneSheet). measureUnits can bo cuc
 * that nen duoc gia lap; o day chi kiem lich: cho CHO_MS, rao ghep chu, phong chu, nuot loi, go bo nghe.
 * Rao ghep chu tren trinh duyet that van do tests/e2e/viet-tran-trang.spec.ts giu.
 */

const DON_VI: Unit[] = [{ top: 0, bottom: 27, pos: 1 }];

/** Editor gia: chi co dung nhung gi useMeasure cham toi. */
function taoEditorGia() {
  const nghe = new Set<() => void>();
  const view = { composing: false, dom: document.createElement("div") };
  const editor = {
    view,
    state: { doc: {} },
    on: (_ten: string, fn: () => void) => {
      nghe.add(fn);
    },
    off: (_ten: string, fn: () => void) => {
      nghe.delete(fn);
    },
  } as unknown as Editor;
  const doi = () => {
    for (const fn of nghe) fn();
  };
  return { editor, view, nghe, doi };
}

let phongChuXong: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(measureUnits).mockReset();
  vi.mocked(measureUnits).mockReturnValue(DON_VI);
  // jsdom khong co document.fonts: gia lap mot loi hua ma test tu quyet luc nao xong.
  const ready = new Promise<void>((xong) => {
    phongChuXong = xong;
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mirror = { current: document.createElement("div") };

describe("useMeasure", () => {
  it("chua co editor thi khong do", () => {
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(null, mirror, onMeasure));
    vi.advanceTimersByTime(CHO_MS * 2);
    expect(measureUnits).not.toHaveBeenCalled();
    expect(onMeasure).not.toHaveBeenCalled();
  });

  it("do ngay luc gan, dua don vi va editor cho onMeasure", () => {
    const { editor } = taoEditorGia();
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(editor, mirror, onMeasure));
    expect(onMeasure).toHaveBeenCalledTimes(1);
    expect(onMeasure).toHaveBeenCalledWith(DON_VI, editor);
  });

  it("nhieu lan doi lien tiep chi do mot lan, CHO_MS sau lan doi cuoi", () => {
    const { editor, doi } = taoEditorGia();
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(editor, mirror, onMeasure));
    onMeasure.mockClear();
    doi();
    vi.advanceTimersByTime(CHO_MS - 20);
    doi();
    vi.advanceTimersByTime(CHO_MS - 1);
    expect(onMeasure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMeasure).toHaveBeenCalledTimes(1);
  });

  it("dang ghep chu thi khong do, du cho lau; do lai CHO_MS sau compositionend", () => {
    const { editor, view, doi } = taoEditorGia();
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(editor, mirror, onMeasure));
    vi.mocked(measureUnits).mockClear();
    onMeasure.mockClear();
    view.composing = true;
    doi();
    vi.advanceTimersByTime(CHO_MS * 10);
    expect(measureUnits).not.toHaveBeenCalled();
    expect(onMeasure).not.toHaveBeenCalled();
    view.composing = false;
    view.dom.dispatchEvent(new Event("compositionend"));
    vi.advanceTimersByTime(CHO_MS - 1);
    expect(onMeasure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMeasure).toHaveBeenCalledTimes(1);
  });

  it("ban sao lech so doan: nuot loi, lan doi sau do lai", () => {
    const { editor, doi } = taoEditorGia();
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(editor, mirror, onMeasure));
    onMeasure.mockClear();
    vi.mocked(measureUnits).mockImplementationOnce(() => {
      throw new Error("ban sao lech so doan voi tai lieu");
    });
    doi();
    expect(() => vi.advanceTimersByTime(CHO_MS)).not.toThrow();
    expect(onMeasure).not.toHaveBeenCalled();
    doi();
    vi.advanceTimersByTime(CHO_MS);
    expect(onMeasure).toHaveBeenCalledTimes(1);
  });

  it("phong chu tai xong thi do them mot lan", async () => {
    const { editor } = taoEditorGia();
    const onMeasure = vi.fn();
    renderHook(() => useMeasure(editor, mirror, onMeasure));
    expect(onMeasure).toHaveBeenCalledTimes(1);
    phongChuXong();
    await document.fonts.ready;
    expect(onMeasure).toHaveBeenCalledTimes(2);
  });

  it("doi ham onMeasure khong gan lai bo nghe; lan do sau dung ham moi nhat", () => {
    const { editor, nghe, doi } = taoEditorGia();
    const cu = vi.fn();
    const moi = vi.fn();
    const { rerender } = renderHook(({ cb }) => useMeasure(editor, mirror, cb), { initialProps: { cb: cu } });
    rerender({ cb: moi });
    expect(nghe.size).toBe(1);
    cu.mockClear();
    doi();
    vi.advanceTimersByTime(CHO_MS);
    expect(cu).not.toHaveBeenCalled();
    expect(moi).toHaveBeenCalledTimes(1);
  });

  it("go ra thi huy hen gio va bo nghe", () => {
    const { editor, view, nghe, doi } = taoEditorGia();
    const onMeasure = vi.fn();
    const { unmount } = renderHook(() => useMeasure(editor, mirror, onMeasure));
    onMeasure.mockClear();
    doi();
    unmount();
    expect(nghe.size).toBe(0);
    view.dom.dispatchEvent(new Event("compositionend"));
    vi.advanceTimersByTime(CHO_MS * 2);
    expect(onMeasure).not.toHaveBeenCalled();
  });
});
