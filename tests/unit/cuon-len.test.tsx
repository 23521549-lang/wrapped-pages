import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cuonLenDinh, LUOT_DAI_NHAT_MS, LUOT_NGAN_NHAT_MS, nhipCuon, thoiGianLuot } from "@/components/tam-trang/cuon-len";

/*
 * Bam "Thả" thi trang cuon len dai troi voi toc do mot cu cuon chuot (chu du an 27/09: "toc do giong nhu cuon chuot
 * binh thuong"), va dai troi doi NGAY khi toi noi. Giam chuyen dong thi nhay thang.
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
});

const dangO = (px: number) => {
  y = px;
  vi.stubGlobal("scrollY", px);
};

describe("thoiGianLuot va nhipCuon", () => {
  it("luot cang xa cang lau, nhung luon trong khoang cua mot cu cuon chuot (0,22 toi 0,6 giay)", () => {
    expect(thoiGianLuot(100)).toBe(LUOT_NGAN_NHAT_MS);
    expect(thoiGianLuot(900)).toBe(430);
    expect(thoiGianLuot(20_000)).toBe(LUOT_DAI_NHAT_MS);
    expect(LUOT_DAI_NHAT_MS).toBeLessThanOrEqual(600);
  });

  it("nhip cuon chuot: bat dau 0, ket thuc 1, luon tang, di nhanh ngay tu dau", () => {
    expect(nhipCuon(0)).toBe(0);
    expect(nhipCuon(1)).toBe(1);
    expect(nhipCuon(0.5)).toBeCloseTo(0.875, 10);
    for (let i = 0; i < 10; i++) expect(nhipCuon((i + 1) / 10)).toBeGreaterThan(nhipCuon(i / 10));
  });
});

describe("cuonLenDinh", () => {
  it("dang o dinh san: khong cuon, doi troi ngay trong cu bam", () => {
    dangO(0);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).not.toHaveBeenCalled();
    expect(xong).toHaveBeenCalledOnce();
  });

  it("dang o duoi: cuon tung khung hinh len dinh, khong bao gio di xuong, doi troi ngay khi toi noi", () => {
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    const dai = thoiGianLuot(900);
    const cacY: number[] = [];
    while (xong.mock.calls.length === 0 && cacY.length < 200) {
      vi.advanceTimersByTime(16);
      cacY.push(y);
    }
    // Nhu cu cuon chuot: toi nua thoi gian da di qua quang duong nhieu hon mot nua.
    expect(cacY[Math.floor(cacY.length / 2)]).toBeLessThan(450);
    for (let i = 1; i < cacY.length; i++) expect(cacY[i]).toBeLessThanOrEqual(cacY[i - 1]);
    expect(y).toBe(0);
    expect(xong).toHaveBeenCalledOnce();
    // Toi dinh trong dung khoang thoi gian cua lan luot, khong nghi them.
    expect(cacY.length * 16).toBeLessThanOrEqual(dai + 48);
  });

  it("nguoi dung tu cuon giua duong: dung luot ngay, khong keo trang nguoc lai, doi troi ngay", () => {
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    vi.advanceTimersByTime(96);
    globalThis.dispatchEvent(new Event("wheel"));
    expect(xong).toHaveBeenCalledOnce();
    const soLan = cuon.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(cuon.mock.calls.length).toBe(soLan);
  });

  it("giam chuyen dong: nhay thang toi dinh, khong luot, doi troi ngay", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    dangO(900);
    const xong = vi.fn();
    cuonLenDinh(xong);
    expect(cuon).toHaveBeenCalledOnce();
    expect(cuon).toHaveBeenCalledWith({ top: 0 });
    expect(xong).toHaveBeenCalledOnce();
  });

  it("huy giua chung (lan tha moi, hay go thanh phan): khong luot nua va khong bao gio doi troi", () => {
    dangO(900);
    const xong = vi.fn();
    const huy = cuonLenDinh(xong);
    vi.advanceTimersByTime(96);
    huy();
    const soLan = cuon.mock.calls.length;
    vi.advanceTimersByTime(LUOT_DAI_NHAT_MS * 2);
    expect(cuon.mock.calls.length).toBe(soLan);
    expect(xong).not.toHaveBeenCalled();
  });
});
