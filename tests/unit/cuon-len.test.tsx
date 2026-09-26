import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cuonLenDinh, LUOT_DAI_NHAT_MS, LUOT_NGAN_NHAT_MS, NHIP_SAU_CUON_MS, nhipEm, thoiGianLuot,
} from "@/components/tam-trang/cuon-len";

/*
 * Bam "Thả" thi trang luot tu tu len dai troi (chu du an 26/09: "luot len mot cach nhe nhang va cham rai"), toi noi thi
 * nghi 3 giay roi troi moi doi. Giam chuyen dong thi nhay thang, van nghi 3 giay.
 */

let cuon: ReturnType<typeof vi.fn>;
let y = 0;

beforeEach(() => {
  vi.useFakeTimers();
  y = 0;
  cuon = vi.fn((a: number | ScrollToOptions, b?: number) => {
    y = typeof a === "number" ? (b ?? 0) : (a.top ?? 0);
  });
  vi.stubGlobal("scrollTo", cuon);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }) as unknown as MediaQueryList));
  // Khung hinh gia 16ms, dem theo dong ho gia: bai kiem di tung khung hinh bang advanceTimersByTime.
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => setTimeout(() => f(Date.now()), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.minHeight = "";
});

const caoGiu = () => document.documentElement.style.minHeight;

const dangO = (px: number) => {
  y = px;
  vi.stubGlobal("scrollY", px);
};

describe("thoiGianLuot va nhipEm", () => {
  it("luot cang xa cang lau, nhung luon trong khoang tu tu", () => {
    expect(thoiGianLuot(200)).toBe(LUOT_NGAN_NHAT_MS);
    expect(thoiGianLuot(2000)).toBe(1900);
    expect(thoiGianLuot(20_000)).toBe(LUOT_DAI_NHAT_MS);
  });

  it("nhip vao ra: bat dau 0, ket thuc 1, giua duong 0.5, luon tang", () => {
    expect(nhipEm(0)).toBe(0);
    expect(nhipEm(1)).toBe(1);
    expect(nhipEm(0.5)).toBeCloseTo(0.5, 10);
    for (let i = 0; i < 10; i++) expect(nhipEm((i + 1) / 10)).toBeGreaterThan(nhipEm(i / 10));
  });
});

describe("cuonLenDinh", () => {
  it("dang o dinh san: khong cuon, doi troi sau nhip nghi 3 giay", () => {
    dangO(0);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS - 1);
    expect(xong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("dang o duoi: luot tung khung hinh len dinh, tu tu va khong bao gio di xuong, roi nghi 3 giay moi doi troi", () => {
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    const dai = thoiGianLuot(900);
    const cacY: number[] = [];
    for (let t = 0; t < dai + 64; t += 16) {
      vi.advanceTimersByTime(16);
      cacY.push(y);
    }
    // Khong nhay mot cu: nua duong van con o giua trang, va moi khung hinh chi di len.
    expect(cacY[Math.floor(cacY.length / 2)]).toBeGreaterThan(200);
    expect(cacY[Math.floor(cacY.length / 2)]).toBeLessThan(700);
    for (let i = 1; i < cacY.length; i++) expect(cacY[i]).toBeLessThanOrEqual(cacY[i - 1]);
    expect(y).toBe(0);
    expect(xong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("trong luc luot: trang duoc giu cao du de hop vua dong khong keo trang ve dinh; toi noi thi tra lai chieu cao that", () => {
    dangO(900);
    cuonLenDinh(vi.fn());
    expect(caoGiu()).toBe(`${900 + globalThis.innerHeight}px`);
    vi.advanceTimersByTime(thoiGianLuot(900) - 64);
    expect(caoGiu()).not.toBe("");
    vi.advanceTimersByTime(128);
    expect(y).toBe(0);
    expect(caoGiu()).toBe("");
  });

  it("dang o dinh san hay giam chuyen dong: khong giu chieu cao nao", () => {
    dangO(0);
    cuonLenDinh(vi.fn());
    expect(caoGiu()).toBe("");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    dangO(900);
    cuonLenDinh(vi.fn());
    expect(caoGiu()).toBe("");
  });

  it("nguoi dung tu cuon giua duong: dung luot ngay, khong keo trang nguoc lai, van doi troi sau 3 giay", () => {
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    vi.advanceTimersByTime(320);
    globalThis.dispatchEvent(new Event("wheel"));
    expect(caoGiu()).toBe("");
    const soLan = cuon.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(cuon.mock.calls.length).toBe(soLan);
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("giam chuyen dong: nhay thang toi dinh, khong luot, van nghi 3 giay roi doi troi", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).toHaveBeenCalledOnce();
    expect(cuon).toHaveBeenCalledWith({ top: 0 });
    vi.advanceTimersByTime(NHIP_SAU_CUON_MS - 1);
    expect(xong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(xong).toHaveBeenCalledOnce();
  });

  it("huy giua chung (lan tha moi, hay go thanh phan): khong luot nua va khong bao gio doi troi", () => {
    dangO(900);
    const xong = vi.fn();
    const huy = cuonLenDinh(xong);
    vi.advanceTimersByTime(160);
    huy();
    expect(caoGiu()).toBe("");
    const soLan = cuon.mock.calls.length;
    vi.advanceTimersByTime(LUOT_DAI_NHAT_MS + NHIP_SAU_CUON_MS * 2);
    expect(cuon.mock.calls.length).toBe(soLan);
    expect(xong).not.toHaveBeenCalled();
  });
});
