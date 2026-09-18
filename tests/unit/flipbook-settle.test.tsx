// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Flipbook, GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import type { DocJson } from "@/lib/doc/types";

/**
 * Tai hien loi: settle (trong Flipbook.tsx) dong bang gia tri m/n cua lan
 * render da tao ra hieu ung lat, nhung mang phu thuoc cua hieu ung chi co [turn]. Neu mot lan render
 * lai lam doi n (do dai sheets) TRONG LUC turn con giu nguyen tham chieu, settle CU (dong bang n cu)
 * van la ham duoc goi khi hoat anh ket thuc - ha canh sai trang.
 *
 * Tai hien qua duong "mo" (giam chuyen dong), khong qua duong "lat" 3D: turn.plan cua duong lat da
 * dong bang san cac chi so to (front/back/left/right) tu luc bam, nen sheets ngan lai giua chung se lam
 * Sheet doc sheets[i] ngoai mang o MOT cho khac (luc render lai, truoc ca khi settle kip chay) - do la
 * mot lo ho rieng cua turn.plan, khong phai loi dang kiem o day. Duong "mo" khong dong bang chi so
 * nao (layer() luon doc m/n moi nhat o moi lan render), nen no lam lo dung mot minh loi cua settle.
 */

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

type HoatAnhGia = { onfinish: (() => void) | null; cancel(): void };

function taoHoatAnhGia(): HoatAnhGia {
  return { onfinish: null, cancel() {} };
}

/** GIAM_CHUYEN_DONG luon khop (di duong "mo"); moi query khac (vd MAN_RONG) khong khop, nen mode la "mot". */
function matchMediaGia(query: string): MediaQueryList {
  return {
    matches: query === GIAM_CHUYEN_DONG,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let hoatAnhTao: HoatAnhGia[] = [];

beforeEach(() => {
  hoatAnhTao = [];
  window.matchMedia = matchMediaGia;
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  Element.prototype.animate = ((..._args: unknown[]) => {
    const hoatAnh = taoHoatAnhGia();
    hoatAnhTao.push(hoatAnh);
    return hoatAnh as unknown as Animation;
  }) as typeof Element.prototype.animate;
});

afterEach(() => {
  cleanup();
});

describe("Flipbook: settle khong duoc dong bang m/n cua lan render da tao ra hieu ung", () => {
  it("sach ngan lai giua luc dang lat (turn khong doi): ha canh dung trang con lai, khong dung so lieu cu", () => {
    const banDau = [to("Mot"), to("Hai"), to("Ba")];
    const { container, rerender } = render(<Flipbook title="Truyen thu" author="Linh" sheets={banDau} start={0} />);

    const nutSau = container.querySelector<HTMLButtonElement>('button[aria-label="Trang sau"]');
    expect(nutSau).toBeTruthy();
    fireEvent.click(nutSau as HTMLButtonElement);

    // Da tao dung mot hoat anh mo chong cho lan lat nay, va no dang "cho" (chua goi onfinish).
    expect(hoatAnhTao).toHaveLength(1);
    const [hoatAnh] = hoatAnhTao;

    // Sach ngan lai con 1 to trong luc hoat anh dang chay - turn khong doi, chi sheets (nen n) doi.
    rerender(<Flipbook title="Truyen thu" author="Linh" sheets={[to("Mot")]} start={0} />);

    // Hoat anh ket thuc: settle chay.
    act(() => {
      hoatAnh.onfinish?.();
    });

    // Dung: ha canh o trang 1/1 con lai (to thu hai da bien mat), khong phai trang 2 da mat cua so lieu cu.
    expect(container.querySelector(".doc__dem")?.textContent).toBe("Trang 1 / 1");
    expect(container.querySelector(".to-giay--trong")).toBeNull();
    expect(container.textContent).toContain("Mot");
  });
});
