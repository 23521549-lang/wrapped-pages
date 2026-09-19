// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flipbook, GIAM_CHUYEN_DONG, MAN_RONG } from "@/components/reader/Flipbook";
import type { DocJson } from "@/lib/doc/types";

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

/** Man hep (MAN_RONG khong khop), khong giam chuyen dong: che do mot trang. */
function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
});

describe("Flipbook: renderSheet", () => {
  it("to nao renderSheet tra phan tu thi ve phan tu do thay cho vung chu, van giu so trang", () => {
    const { container } = render(
      <Flipbook title="Thu" author="Linh" sheets={[to("Chu that")]} start={0} renderSheet={() => <p className="rieng">Riêng</p>} />,
    );
    expect(container.querySelector(".to-giay .rieng")?.textContent).toBe("Riêng");
    expect(container.textContent).not.toContain("Chu that");
    expect(container.querySelector(".to-giay__so")?.textContent).toBe("1");
  });

  it("tra undefined thi ve nhu khi khong co prop", () => {
    const { container } = render(<Flipbook title="Thu" author="Linh" sheets={[to("Chu that")]} start={0} renderSheet={() => undefined} />);
    expect(container.querySelector(".to-giay .giay-noi-dung")?.textContent).toBe("Chu that");
  });
});

describe("Flipbook: onShow", () => {
  it("bao to dang hien khi khung dung yen", () => {
    const onShow = vi.fn();
    render(<Flipbook title="Thu" author="Linh" sheets={[to("Mot"), to("Hai"), to("Ba")]} start={1} onShow={onShow} />);
    expect(onShow).toHaveBeenLastCalledWith(2, 2);
  });
});

/** Cac query khop (MAN_RONG, GIAM_CHUYEN_DONG), con lai khong khop. */
function khop(...queries: string[]): (query: string) => MediaQueryList {
  return (query) => ({ ...matchMediaGia(query), matches: queries.includes(query) }) as MediaQueryList;
}

describe("Flipbook: renderFoot", () => {
  const ba = [to("Mot"), to("Hai"), to("Ba")];

  it("khong truyen renderFoot thi khong co .doc__chan", () => {
    const { container } = render(<Flipbook title="Thu" author="Linh" sheets={ba} start={0} />);
    expect(container.querySelector(".doc__chan")).toBeNull();
  });

  it("renderFoot tra null thi cung khong co .doc__chan", () => {
    const { container } = render(<Flipbook title="Thu" author="Linh" sheets={ba} start={0} renderFoot={() => null} />);
    expect(container.querySelector(".doc__chan")).toBeNull();
  });

  it("mot trang: nhan [i], ve ngay sau khung sach, truoc nut lat", () => {
    const renderFoot = vi.fn((shown: readonly (number | null)[]) => <p className="chan-thu">{shown.join(",")}</p>);
    const { container } = render(<Flipbook title="Thu" author="Linh" sheets={ba} start={1} renderFoot={renderFoot} />);
    expect(renderFoot).toHaveBeenLastCalledWith([1]);
    const chan = container.querySelector(".doc__chan");
    expect(chan?.textContent).toBe("1");
    expect(chan?.previousElementSibling?.classList.contains("doc__khung")).toBe(true);
    expect(chan?.nextElementSibling?.classList.contains("doc__dk")).toBe(true);
  });

  it("hai trang o khung cuoi le: nhan [i, null]", () => {
    window.matchMedia = khop(MAN_RONG);
    const renderFoot = vi.fn(() => <p>chan</p>);
    render(<Flipbook title="Thu" author="Linh" sheets={ba} start={2} renderFoot={renderFoot} />);
    expect(renderFoot).toHaveBeenLastCalledWith([2, null]);
  });

  it("trong luc lat van nhan khung cu, dung yen roi moi nhan khung moi", () => {
    const hoatAnh: { onfinish: (() => void) | null; cancel(): void }[] = [];
    window.matchMedia = khop(GIAM_CHUYEN_DONG);
    Element.prototype.animate = (() => {
      const a = { onfinish: null, cancel() {} };
      hoatAnh.push(a);
      return a as unknown as Animation;
    }) as typeof Element.prototype.animate;
    const renderFoot = vi.fn(() => <p>chan</p>);
    render(<Flipbook title="Thu" author="Linh" sheets={ba} start={0} renderFoot={renderFoot} />);
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(hoatAnh).toHaveLength(1);
    expect(renderFoot).toHaveBeenLastCalledWith([0]);
    act(() => {
      hoatAnh[0].onfinish?.();
    });
    expect(renderFoot).toHaveBeenLastCalledWith([1]);
  });
});
