// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

/*
 * TuCapNhat (spec 5a muc G): khi tab dang duoc xem, cu --dur-tu-cap-nhat (15 giay; jsdom khong co token) hoi phien ban
 * cua Ke sach; khac phien ban luc trang ve thi router.refresh(). Tab vua hien lai thi hoi ngay. Khong lam moi khi dang go
 * (focus o o nhap), khi co hop dang mo (aria-expanded), khi mot action dang chay (aria-busy), hay khi dau Moi con dang tan.
 */

const { phienBan, router } = vi.hoisted(() => ({
  phienBan: vi.fn(async () => "v1"),
  router: { refresh: vi.fn() },
}));
vi.mock("@/app/actions/feed", () => ({ actionPhienBanKe: phienBan }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { TuCapNhat } from "@/components/TuCapNhat";

const CHU_KY = 15_000;
let hien = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  hien = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hien });
  phienBan.mockReset();
  phienBan.mockResolvedValue("v1");
  router.refresh.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

const qua = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Cac trang thai "dang ban": moi ham dung mot phan tu vao trang, xoa phan tu do la het ban. */
const BAN: [string, () => void][] = [
  ["dang go trong o nhap", () => {
    const o = document.createElement("textarea");
    document.body.append(o);
    o.focus();
  }],
  ["co hop dang mo", () => {
    const b = document.createElement("button");
    b.setAttribute("aria-expanded", "true");
    document.body.append(b);
  }],
  ["mot action dang chay", () => {
    const b = document.createElement("button");
    b.setAttribute("aria-busy", "true");
    document.body.append(b);
  }],
  ["dau Moi con dang tan", () => {
    const li = document.createElement("li");
    li.dataset.tan = String(Date.now() + 2 * CHU_KY);
    document.body.append(li);
  }],
];

describe("TuCapNhat", () => {
  it("cu 15 giay hoi mot lan; cung phien ban thi khong lam moi, khac thi lam moi dung mot lan", async () => {
    render(<TuCapNhat phienBan="v1" />);
    await qua(CHU_KY - 1);
    expect(phienBan).not.toHaveBeenCalled();
    await qua(1);
    expect(phienBan).toHaveBeenCalledTimes(1);
    expect(router.refresh).not.toHaveBeenCalled();
    phienBan.mockResolvedValue("v2");
    await qua(CHU_KY);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await qua(CHU_KY);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("tab an thi khong hoi; hien lai thi hoi ngay", async () => {
    hien = "hidden";
    render(<TuCapNhat phienBan="v1" />);
    await qua(3 * CHU_KY);
    expect(phienBan).not.toHaveBeenCalled();
    hien = "visible";
    phienBan.mockResolvedValue("v2");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(phienBan).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(BAN)("%s: khong lam moi; het ban thi lan sau lam moi", async (_ten, ban) => {
    phienBan.mockResolvedValue("v2");
    render(<TuCapNhat phienBan="v1" />);
    ban();
    await qua(CHU_KY);
    expect(router.refresh).not.toHaveBeenCalled();
    for (const e of document.body.querySelectorAll("textarea, button, li")) e.remove();
    await qua(CHU_KY);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("hoi loi (mat mang) thi bo qua, lan sau hoi tiep", async () => {
    phienBan.mockRejectedValueOnce(new Error("mat mang"));
    render(<TuCapNhat phienBan="v1" />);
    await qua(CHU_KY);
    phienBan.mockResolvedValue("v2");
    await qua(CHU_KY);
    expect(phienBan).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("trang ve lai voi phien ban moi thi lay do lam moc", async () => {
    const { rerender } = render(<TuCapNhat phienBan="v1" />);
    rerender(<TuCapNhat phienBan="v2" />);
    phienBan.mockResolvedValue("v2");
    await qua(CHU_KY);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
