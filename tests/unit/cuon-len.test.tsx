import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cuonLenDinh, CUON_TOI_DA_MS, NHIP_SAU_CUON_MS } from "@/components/tam-trang/cuon-len";

/*
 * Spec bo sung B5: bam "Thả" thi trang cuon muot len dai troi, toi noi roi troi moi doi sau mot nhip ngan. Giam chuyen
 * dong thi nhay thang va doi ngay.
 */

let cuon: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  cuon = vi.fn();
  vi.stubGlobal("scrollTo", cuon);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }) as unknown as MediaQueryList));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("cuonLenDinh", () => {
  it("dang o dinh san: khong cuon, doi troi sau mot nhip", () => {
    vi.stubGlobal("scrollY", 0);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS - 1);
    expect(xong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("dang o duoi: cuon muot len dinh, cho cuon xong (scrollend) roi mot nhip moi doi troi, va chi mot lan", () => {
    vi.stubGlobal("scrollY", 800);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    vi.advanceTimersByTime(400);
    expect(xong).not.toHaveBeenCalled();
    globalThis.dispatchEvent(new Event("scrollend"));
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS);
    expect(xong).toHaveBeenCalledOnce();
    // Hen du phong khong goi them lan nao nua.
    vi.advanceTimersByTime(CUON_TOI_DA_MS * 2);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("trinh duyet khong ban scrollend: hen du phong van dua troi toi", () => {
    vi.stubGlobal("scrollY", 800);
    const xong = vi.fn();
    cuonLenDinh(xong);
    vi.advanceTimersByTime(CUON_TOI_DA_MS + NHIP_SAU_CUON_MS - 1);
    expect(xong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("giam chuyen dong: nhay thang toi dinh, doi troi ngay, khong cho gi", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    vi.stubGlobal("scrollY", 800);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).toHaveBeenCalledWith({ top: 0 });
    expect(xong).toHaveBeenCalledOnce();
  });

  it("huy giua chung (lan tha moi, hay go thanh phan): khong bao gio doi troi", () => {
    vi.stubGlobal("scrollY", 800);
    const xong = vi.fn();
    const huy = cuonLenDinh(xong);
    huy();
    globalThis.dispatchEvent(new Event("scrollend"));
    vi.advanceTimersByTime(CUON_TOI_DA_MS * 2);
    expect(xong).not.toHaveBeenCalled();
  });
});
