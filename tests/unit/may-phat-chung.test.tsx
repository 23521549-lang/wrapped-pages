import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { MayPhatChung, OPhat, useNhacChung, useTatNhacChung, type HangDoi } from "@/components/music/MayPhatChung";
import { YT_STATE, type YTNamespace, type YTPlayerOptions } from "@/components/music/youtubeApi";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest}>{children}</a>,
}));

/*
 * Trinh phat chung (5b, spec C): mot trinh phat cho moi trang, dat len o giu cho cung chu; roi trang ma dang nghe thi
 * thanh cua so video nho o goc duoi ben phai (thanh mong: ten bai ve trang nguon, tam dung, bai ke, tat); het hang doi hay
 * tat thi go han trinh phat; chi nap san ma roi trang thi go; man doc sach gan la tat.
 */

class PlayerGia {
  readonly opts: YTPlayerOptions;
  readonly khung = document.createElement("iframe");
  readonly playVideo = vi.fn();
  readonly pauseVideo = vi.fn();
  readonly loadVideoById = vi.fn();
  readonly stopVideo = vi.fn();
  readonly destroy = vi.fn();

  constructor(el: HTMLElement, opts: YTPlayerOptions) {
    this.opts = opts;
    el.replaceWith(this.khung);
    cacMay.push(this);
  }

  getIframe() {
    return this.khung;
  }
}

const cacMay: PlayerGia[] = [];
const may = () => cacMay[cacMay.length - 1];
const san = () => act(() => may().opts.events.onReady({ target: may() }));
const bao = (data: number) => act(() => may().opts.events.onStateChange({ target: may(), data }));
const doi = () => act(async () => {});

const bai = (id: string, ten: string) => ({ youtubeId: id.repeat(11).slice(0, 11), ten, kenh: `Kênh ${ten}` });
const A = bai("a", "Bài A");
const B = bai("b", "Bài B");
const C = bai("c", "Bài C");
const SO: HangDoi = { chu: "so-2026-09", nhan: "2026-09", href: "/dau-thoi-gian/thang/2026-09", ds: [[A, B], [], [C]] };

/** Mot trang gia: o giu cho (tuy chon) va cac nut goi trinh phat chung. */
function Trang({ chu, hang = SO }: { chu: string | null; hang?: HangDoi }) {
  const nhac = useNhacChung();
  return (
    <div>
      {chu !== null && <OPhat chu={chu} className="o-gia"><p>Chỗ trống</p></OPhat>}
      <button type="button" onClick={() => nhac.phatTu(hang, { ds: 0, bai: 0 })}>Phát sổ</button>
      <button type="button" onClick={() => nhac.chuanBi(hang)}>Nạp sẵn</button>
      <p data-testid="tt">{`${nhac.hang?.chu ?? "-"} ${nhac.vt ? `${nhac.vt.ds}:${nhac.vt.bai}` : "-"} ${nhac.trangThai} ${nhac.daPhat}`}</p>
    </div>
  );
}

function ManDoc() {
  useTatNhacChung();
  return <p>Sách đang mở</p>;
}

const khung = () => document.querySelector("aside.mph") as HTMLElement;
const tt = () => screen.getByTestId("tt").textContent;

beforeAll(() => {
  window.YT = { Player: PlayerGia } as unknown as YTNamespace;
});

beforeEach(() => {
  cacMay.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("o-gia") ? new DOMRect(40, 120, 640, 360) : new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("trinh phat chung", () => {
  it("chua phat gi: khong co trinh phat, khung an", async () => {
    render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    await doi();
    expect(cacMay).toHaveLength(0);
    expect(khung().hidden).toBe(true);
  });

  it("phat tren trang co o cung chu: khung dat dung len o, bai dau nap khi san sang", async () => {
    render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    expect(cacMay).toHaveLength(1);
    expect(khung().hidden).toBe(false);
    expect(khung().className).toBe("mph mph--lon");
    expect([khung().style.top, khung().style.left, khung().style.width, khung().style.height]).toEqual(["120px", "40px", "640px", "360px"]);
    expect(khung().querySelector(".mph__thanh")).toBeNull();
    await san();
    expect(may().loadVideoById).toHaveBeenLastCalledWith(A.youtubeId);
    await bao(YT_STATE.PLAYING);
    expect(tt()).toBe("so-2026-09 0:0 phat true");
  });

  it("het bai sang bai ke; het danh sach sang danh sach ke (bo danh sach rong); het ca thi dung, o khung lon van nap san", async () => {
    render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    await san();
    await bao(YT_STATE.ENDED);
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B.youtubeId);
    await bao(YT_STATE.ENDED);
    expect(may().loadVideoById).toHaveBeenLastCalledWith(C.youtubeId);
    expect(tt()).toMatch(/^so-2026-09 2:0/);
    await bao(YT_STATE.ENDED);
    expect(may().stopVideo).toHaveBeenCalled();
    expect(may().destroy).not.toHaveBeenCalled();
    expect(tt()).toMatch(/^so-2026-09 - dung false$/);
  });

  it("roi trang dang nghe: thanh cua so nho voi thanh dieu khien, trang chua le duoi; trinh phat khong bi tao lai", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    await san();
    await bao(YT_STATE.PLAYING);
    rerender(<MayPhatChung><Trang chu={null} /></MayPhatChung>);
    await doi();
    expect(cacMay).toHaveLength(1);
    expect(may().destroy).not.toHaveBeenCalled();
    expect(khung().className).toBe("mph");
    expect(khung().getAttribute("aria-label")).toBe("Nhạc đang phát");
    expect(khung().style.top).toBe("");
    expect(document.body.classList.contains("co-mph")).toBe(true);
    const ten = khung().querySelector("a.mph__ten") as HTMLAnchorElement;
    expect(ten.getAttribute("href")).toBe("/dau-thoi-gian/thang/2026-09");
    expect(ten.textContent).toBe("Bài AKênh Bài A");

    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(may().pauseVideo).toHaveBeenCalledTimes(1);
    await bao(YT_STATE.PAUSED);
    fireEvent.click(screen.getByRole("button", { name: "Phát" }));
    expect(may().playVideo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Bài kế tiếp" }));
    expect(may().loadVideoById).toHaveBeenLastCalledWith(B.youtubeId);
    await doi();
    expect(khung().querySelector(".mph__ten b")?.textContent).toBe("Bài B");

    // Ve lai trang nguon: khung ve lai o giu cho, cua so nho mat.
    rerender(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    await doi();
    expect(khung().className).toBe("mph mph--lon");
    expect(document.body.classList.contains("co-mph")).toBe(false);
  });

  it("cua so nho: het hang doi hay bam Tat thi go han trinh phat va an khung", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    await san();
    await bao(YT_STATE.PLAYING);
    rerender(<MayPhatChung><Trang chu={null} /></MayPhatChung>);
    await doi();
    fireEvent.click(screen.getByRole("button", { name: "Tắt nhạc" }));
    await doi();
    expect(may().stopVideo).toHaveBeenCalled();
    expect(may().destroy).toHaveBeenCalled();
    expect(khung().hidden).toBe(true);
    expect(document.body.classList.contains("co-mph")).toBe(false);
  });

  it("chi nap san (chua phat) ma roi trang: go trinh phat, khong de trinh phat an", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Nạp sẵn" }));
    await doi();
    expect(cacMay).toHaveLength(1);
    expect(may().opts.videoId).toBe(A.youtubeId);
    await san();
    expect(may().loadVideoById).not.toHaveBeenCalled();
    rerender(<MayPhatChung><Trang chu={null} /></MayPhatChung>);
    await doi();
    expect(may().destroy).toHaveBeenCalled();
    expect(khung().hidden).toBe(true);
  });

  it("bam nut phat cua chinh khung YouTube khi moi nap san: hang bat dau tu bai dau, roi trang thi nhac di theo", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Nạp sẵn" }));
    await doi();
    await san();
    await bao(YT_STATE.PLAYING);
    expect(tt()).toBe("so-2026-09 0:0 phat true");
    rerender(<MayPhatChung><Trang chu={null} /></MayPhatChung>);
    await doi();
    expect(khung().className).toBe("mph");
  });

  it("dang nghe o trang khac: trang co o khac chu khong lay khung, khong nap san de len nhac dang nghe", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    await san();
    await bao(YT_STATE.PLAYING);
    const khac: HangDoi = { chu: "dtg-s1", nhan: "2026-09-15", href: "/dau-thoi-gian/s1", ds: [[C]] };
    rerender(<MayPhatChung><Trang chu="dtg-s1" hang={khac} /></MayPhatChung>);
    await doi();
    fireEvent.click(screen.getByRole("button", { name: "Nạp sẵn" }));
    await doi();
    expect(khung().className).toBe("mph");
    expect(tt()).toMatch(/^so-2026-09 0:0/);
    expect(screen.getByText("Chỗ trống")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    expect(may().loadVideoById).toHaveBeenLastCalledWith(C.youtubeId);
    expect(khung().className).toBe("mph mph--lon");
  });

  it("man doc sach gan: tat nhac chung", async () => {
    const { rerender } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
    fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
    await doi();
    await san();
    await bao(YT_STATE.PLAYING);
    rerender(<MayPhatChung><ManDoc /></MayPhatChung>);
    await doi();
    expect(may().stopVideo).toHaveBeenCalled();
    expect(may().destroy).toHaveBeenCalled();
    expect(khung().hidden).toBe(true);
  });

  it("thu thanh cua so nho la mot lan chuyen dong chi transform; giam chuyen dong thi doi thang", async () => {
    const hoatAnh = vi.fn();
    const goc = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = hoatAnh as unknown as HTMLElement["animate"];
    onTestFinished(() => {
      HTMLElement.prototype.animate = goc;
    });
    for (const giam of [false, true]) {
      hoatAnh.mockClear();
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: giam && q.includes("reduce"), media: q }));
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("o-gia")) return new DOMRect(40, 120, 640, 360);
        if (this.classList.contains("mph") && !this.classList.contains("mph--lon")) return new DOMRect(900, 500, 356, 248);
        if (this.classList.contains("mph")) return new DOMRect(40, 120, 640, 360);
        return new DOMRect(0, 0, 0, 0);
      });
      const { rerender, unmount } = render(<MayPhatChung><Trang chu="so-2026-09" /></MayPhatChung>);
      fireEvent.click(screen.getByRole("button", { name: "Phát sổ" }));
      await doi();
      await san();
      await bao(YT_STATE.PLAYING);
      rerender(<MayPhatChung><Trang chu={null} /></MayPhatChung>);
      await doi();
      if (giam) {
        expect(hoatAnh).not.toHaveBeenCalled();
      } else {
        expect(hoatAnh).toHaveBeenCalledTimes(1);
        const [khungHinh, tuyChon] = hoatAnh.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
        expect(khungHinh.flatMap((k) => Object.keys(k)).sort()).toEqual(["transform", "transform", "transformOrigin", "transformOrigin"]);
        expect(khungHinh[0].transform).toBe(`translate(${40 - 900}px, ${120 - 500}px) scale(${640 / 356})`);
        expect(tuyChon.duration).toBe(420);
      }
      unmount();
    }
  });
});

describe("nhac.css", () => {
  const CSS = readFileSync("src/styles/nhac.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const giam = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("khung video khong bao gio nho hon 200px, ca o lon lan cua so nho; nut cua so nho 44px", () => {
    expect(CSS).toMatch(/\.mph__may\{[^}]*height: 200px[^}]*min-width: 200px/);
    expect(CSS).toMatch(/\.mph--lon \.mph__may\{[^}]*min-height: 200px/);
    expect(CSS).toMatch(/\.sn__may\{[^}]*min-height: 200px/);
    expect(CSS).toMatch(/\.mph__i\{[^}]*width: 44px; height: 44px/);
    expect(CSS).toMatch(/max-width: 600px\)\{\s*\.mph\{[^}]*width: 200px/);
  });

  it("moi hoat anh va chuyen tiep deu co nhanh giam chuyen dong", () => {
    expect(giam.length).toBeGreaterThan(0);
    for (const chon of [".bai--chay .song i", ".mph__i", ".pl__phat", ".bai", ".so"]) expect(giam).toContain(chon);
  });

  it("mau va lop xep chong di qua token, khong ma mau viet tay", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/oklch\(/);
    for (const m of CSS.matchAll(/z-index:\s*([^;}]+)/g)) expect(m[1].trim()).toMatch(/^(var\(--z-[a-z-]+\)|calc\(var\(--z-[a-z-]+\) \+ [0-9]+\))$/);
  });
});
