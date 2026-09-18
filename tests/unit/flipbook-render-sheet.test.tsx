// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Flipbook } from "@/components/reader/Flipbook";
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
