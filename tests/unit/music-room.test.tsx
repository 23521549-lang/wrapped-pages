// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { actionSetMusicMuted } from "@/app/actions/music";
import { BookCover } from "@/components/music/BookCover";
import { CHUA_LUU_NHAC } from "@/app/actions/messages";
import { MusicRoom } from "@/components/music/MusicRoom";
import { YT_HOST, YT_STATE, type YTNamespace, type YTPlayerOptions } from "@/components/music/youtubeApi";
import { Flipbook, MAN_RONG } from "@/components/reader/Flipbook";
import type { DocJson } from "@/lib/doc/types";
import type { KhungChuNhat } from "@/lib/viewport";

vi.mock("@/app/actions/music", () => ({ actionSetMusicMuted: vi.fn() }));

const ID = "dQw4w9WgXcQ";

/** Thu tu cac viec co hieu ung trong mot cu bam: cuon trang va phat. */
const nhatKy: string[] = [];

/** YT.Player gia: thay the moc bang mot iframe that, ghi lai tham so; su kien do test tu ban qua opts.events. */
class PlayerGia {
  readonly el: HTMLElement;
  readonly opts: YTPlayerOptions;
  readonly khung = document.createElement("iframe");
  readonly playVideo = vi.fn(() => {
    nhatKy.push("phat");
    khiPhat();
  });
  readonly pauseVideo = vi.fn();
  /** Khong tu go iframe: go khoi host la viec cua hook (host.replaceChildren), test "go ra" phai bat duoc khi thieu. */
  readonly destroy = vi.fn();

  constructor(el: HTMLElement, opts: YTPlayerOptions) {
    this.el = el;
    this.opts = opts;
    el.replaceWith(this.khung);
    cacMay.push(this);
  }

  getIframe() {
    return this.khung;
  }
}

const cacMay: PlayerGia[] = [];
let khiPhat: () => void = () => {};
const may = () => cacMay[cacMay.length - 1];

function san() {
  act(() => may().opts.events.onReady({ target: may() }));
}

function bao(data: number) {
  act(() => may().opts.events.onStateChange({ target: may(), data }));
}

class ResizeObserverGia {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function to(text: string): DocJson {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

/** Khung nhin gia cua jsdom (innerWidth, innerHeight). */
const KHUNG_NHIN = { rong: 1280, cao: 900 };
/** Trinh phat nam tron trong khung nhin: cot phai cua man rong. */
const HIEN: KhungChuNhat = { top: 120, bottom: 300, left: 920, right: 1240, width: 320, height: 180 };
/** Trinh phat gan het duoi mep man hinh (chi 60 trong 180px con hien): man hep, the nhac nam sau bia hay sau sach. */
const DUOI_MEP: KhungChuNhat = { top: 840, bottom: 1020, left: 380, right: 900, width: 520, height: 180 };

/**
 * Dat khung cua .nhac-the__may cho getBoundingClientRect (jsdom khong do bo cuc). scrollIntoView gia dua khung ve
 * sauCuon (mac dinh HIEN) va ghi vao nhat ky; tra ve ham gia do.
 */
function datKhung(container: HTMLElement, khung: KhungChuNhat, sauCuon: KhungChuNhat = HIEN) {
  const the = container.querySelector<HTMLElement>(".nhac-the__may");
  if (!the) throw new Error("khong co .nhac-the__may");
  let hienTai = khung;
  the.getBoundingClientRect = () => ({ ...hienTai, x: hienTai.left, y: hienTai.top, toJSON: () => hienTai });
  const cuon = vi.fn(() => {
    nhatKy.push("cuon");
    hienTai = sauCuon;
  });
  the.scrollIntoView = cuon;
  return cuon;
}

type Phong = { gate?: boolean; initialMuted?: boolean; videoId?: string; children?: ReactNode };

/** MusicRoom voi tam bia gia; noi dung sach mac dinh la mot vung sach gia. */
function phong({ gate = true, initialMuted = false, videoId = ID, children }: Phong = {}) {
  return (
    <MusicRoom videoId={videoId} initialMuted={initialMuted} gate={gate} cover={<p>Tranh bìa</p>}>
      {children ?? <button type="button" className="doc__khung">Trang sách</button>}
    </MusicRoom>
  );
}

/** Gan MusicRoom roi cho promise nap API (window.YT da san) tao trinh phat. Trinh phat mac dinh nam tron trong khung nhin. */
async function ve(opts: Phong = {}) {
  const kq = render(phong(opts));
  await act(async () => {});
  datKhung(kq.container, HIEN);
  return kq;
}

const nutNhac = () => screen.getByRole("complementary", { name: "Nhạc nền" }).querySelector<HTMLButtonElement>(".nhac-the__dk .btn");

beforeAll(() => {
  window.YT = { Player: PlayerGia } as unknown as YTNamespace;
});

beforeEach(() => {
  cacMay.length = 0;
  nhatKy.length = 0;
  khiPhat = () => {};
  vi.mocked(actionSetMusicMuted).mockReset();
  vi.mocked(actionSetMusicMuted).mockResolvedValue({ ok: true });
  window.ResizeObserver = ResizeObserverGia as unknown as typeof ResizeObserver;
  vi.stubGlobal("innerWidth", KHUNG_NHIN.rong);
  vi.stubGlobal("innerHeight", KHUNG_NHIN.cao);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MusicRoom", () => {
  it("tao mot trinh phat nocookie khong tu phat; iframe co ten va tabindex -1; nut khoa toi khi san sang", async () => {
    const { container } = await ve();
    expect(cacMay).toHaveLength(1);
    expect(may().opts).toMatchObject({
      host: YT_HOST,
      videoId: ID,
      playerVars: { controls: 0, autoplay: 0, loop: 1, playlist: ID, rel: 0, playsinline: 1 },
    });
    const khung = container.querySelector(".nhac-the__may iframe");
    expect(khung?.getAttribute("title")).toBe("Nhạc nền");
    expect(khung?.getAttribute("tabindex")).toBe("-1");
    expect(nutNhac()?.getAttribute("aria-disabled")).toBe("true");
    san();
    expect(nutNhac()?.getAttribute("aria-disabled")).toBe("false");
    expect(may().playVideo).not.toHaveBeenCalled();
  });

  it("con cong: chi co tam bia va nut Mo sach, noi dung sach chua gan; the nhac noi nhac phat khi mo sach", async () => {
    await ve();
    san();
    expect(screen.getByText("Tranh bìa")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mở sách" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Trang sách" })).toBeNull();
    expect(screen.getByText("Nhạc phát khi mở sách")).toBeTruthy();
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
  });

  it("bam Mo sach: sach gan va focus truoc (dong bo), do kich thuoc trinh phat SAU do; con hien qua nua thi phat", async () => {
    const { container } = await ve();
    san();
    // Ghi lai .doc__khung va phan tu dang focus tai chinh luc do kich thuoc trinh phat, de khang dinh thu tu: sach da
    // gan va focus da xay ra truoc khi mayHienQuaNua() duoc goi, vi playVideo() chi la mot postMessage toi iframe.
    const lucDo: { vungSach: Element | null; focus: Element | null }[] = [];
    const the = container.querySelector<HTMLElement>(".nhac-the__may");
    if (!the) throw new Error("khong co .nhac-the__may");
    the.getBoundingClientRect = () => {
      lucDo.push({ vungSach: container.querySelector(".doc__khung"), focus: document.activeElement });
      return { ...HIEN, x: HIEN.left, y: HIEN.top, toJSON: () => HIEN };
    };
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    const vungSach = container.querySelector(".doc__khung");
    expect(vungSach).not.toBeNull();
    expect(lucDo).toEqual([{ vungSach, focus: vungSach }]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Trang sách" }));
    expect(screen.queryByRole("button", { name: "Mở sách" })).toBeNull();
    expect(container.querySelector(".doc-luoi__chinh--mo")).not.toBeNull();
    expect(container.querySelectorAll(".nhac-the__may iframe")).toHaveLength(1);
    expect(cacMay).toHaveLength(1);
    expect(may().playVideo).toHaveBeenCalledTimes(1);
  });

  it("sach chua co trang (khong co vung sach): Mo sach dua focus ve cot chinh, khong roi ve body", async () => {
    const { container } = await ve({ children: <p>Chưa có trang nào.</p> });
    san();
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    const chinh = container.querySelector<HTMLElement>(".doc-luoi__chinh");
    expect(chinh).not.toBeNull();
    expect(document.activeElement).toBe(chinh);
    expect(chinh?.tabIndex).toBe(-1);
  });

  it("bam Mo sach khi trinh phat khong hien qua nua sau khi mo (RMF): sach van mo va focus, khong phat, nut la Bat nhac", async () => {
    const { container } = await ve();
    const cuon = datKhung(container, DUOI_MEP);
    san();
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    expect(may().playVideo).not.toHaveBeenCalled();
    expect(cuon).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Trang sách" }));
    expect(screen.getByText("Nhạc chưa phát")).toBeTruthy();
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
  });

  it("bam Bat nhac khi trinh phat chua hien qua nua: cuon khung vao tam nhin, dong bo, roi moi phat", async () => {
    const { container } = await ve({ gate: false });
    const cuon = datKhung(container, DUOI_MEP);
    san();
    fireEvent.click(nutNhac() as HTMLButtonElement);
    expect(cuon).toHaveBeenCalledWith({ block: "nearest" });
    expect(nhatKy).toEqual(["cuon", "phat"]);
    expect(actionSetMusicMuted).toHaveBeenLastCalledWith(false);
    await act(async () => {});
  });

  it("bam Bat nhac ma cuon xong trinh phat van chua hien qua nua: do lai, khong phat, khong luu; dong trang thai giu nguyen", async () => {
    const { container } = await ve({ gate: false });
    const cuon = datKhung(container, DUOI_MEP, DUOI_MEP);
    san();
    fireEvent.click(nutNhac() as HTMLButtonElement);
    expect(cuon).toHaveBeenCalledWith({ block: "nearest" });
    expect(may().playVideo).not.toHaveBeenCalled();
    expect(actionSetMusicMuted).not.toHaveBeenCalled();
    expect(screen.getByText("Nhạc chưa phát")).toBeTruthy();
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
  });

  it("gate false: sach hien ngay, khong co bia, khong phat; nut la Bat nhac", async () => {
    await ve({ gate: false });
    san();
    expect(screen.getByRole("button", { name: "Trang sách" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mở sách" })).toBeNull();
    expect(screen.getByText("Nhạc chưa phát")).toBeTruthy();
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
    expect(may().playVideo).not.toHaveBeenCalled();
  });

  it("nguoi da tat nhac: dong trang thai Da tat nhac", async () => {
    await ve({ gate: false, initialMuted: true });
    san();
    expect(screen.getByText("Đã tắt nhạc")).toBeTruthy();
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
  });

  it("nhan theo trang thai phat that, khong theo y muon; luu dung gia tri tat nhac; trinh phat da hien thi khong cuon", async () => {
    const { container } = await ve({ gate: false });
    const cuon = datKhung(container, HIEN);
    san();
    fireEvent.click(nutNhac() as HTMLButtonElement);
    expect(may().playVideo).toHaveBeenCalledTimes(1);
    expect(cuon).not.toHaveBeenCalled();
    expect(actionSetMusicMuted).toHaveBeenLastCalledWith(false);
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
    bao(YT_STATE.BUFFERING);
    expect(nutNhac()?.textContent).toBe("Tắt nhạc");
    bao(YT_STATE.PLAYING);
    expect(screen.getByText("Nhạc đang phát")).toBeTruthy();

    fireEvent.click(nutNhac() as HTMLButtonElement);
    expect(may().pauseVideo).toHaveBeenCalledTimes(1);
    expect(actionSetMusicMuted).toHaveBeenLastCalledWith(true);
    expect(nutNhac()?.textContent).toBe("Tắt nhạc");
    bao(YT_STATE.PAUSED);
    expect(nutNhac()?.textContent).toBe("Bật nhạc");
    expect(screen.getByText("Đã tắt nhạc")).toBeTruthy();
    await act(async () => {});
    expect(actionSetMusicMuted).toHaveBeenCalledTimes(2);
  });

  it("tat nhac tren the luc con bia thi Mo sach khong phat", async () => {
    await ve();
    san();
    fireEvent.click(nutNhac() as HTMLButtonElement);
    bao(YT_STATE.PLAYING);
    fireEvent.click(nutNhac() as HTMLButtonElement);
    bao(YT_STATE.PAUSED);
    expect(may().playVideo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    expect(may().playVideo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Trang sách" })).toBeTruthy();
    await act(async () => {});
  });

  it("ve lai sau refresh voi gate va initialMuted moi: khong hien lai hay go tam bia, khong tao lai trinh phat", async () => {
    const { rerender } = await ve();
    san();
    // Tat nhac luc con bia: may chu ve lai voi gate false, nhung tam bia van o cho nguoi dung dang dung.
    rerender(phong({ gate: false, initialMuted: true }));
    expect(screen.getByRole("button", { name: "Mở sách" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Trang sách" })).toBeNull();

    // Da mo sach: mot lan ve lai voi gate true khong dung lai tam bia.
    fireEvent.click(screen.getByRole("button", { name: "Mở sách" }));
    rerender(phong({ gate: true }));
    expect(screen.queryByRole("button", { name: "Mở sách" })).toBeNull();
    expect(screen.getByRole("button", { name: "Trang sách" })).toBeTruthy();
    expect(cacMay).toHaveLength(1);
    expect(may().destroy).not.toHaveBeenCalled();
  });

  it("luu hong: giu viec phat hay dung, hien dong loi nhe; lan luu sau thanh cong thi dong loi mat", async () => {
    vi.mocked(actionSetMusicMuted)
      .mockResolvedValueOnce({ error: "Bạn cần đăng nhập trước." })
      .mockRejectedValueOnce(new Error("mat mang"));
    await ve({ gate: false });
    san();
    fireEvent.click(nutNhac() as HTMLButtonElement);
    await act(async () => {});
    expect(screen.getByText("Bạn cần đăng nhập trước.")).toBeTruthy();
    bao(YT_STATE.PLAYING);
    expect(nutNhac()?.textContent).toBe("Tắt nhạc");

    fireEvent.click(nutNhac() as HTMLButtonElement);
    await act(async () => {});
    expect(screen.getByText(CHUA_LUU_NHAC)).toBeTruthy();
    expect(may().pauseVideo).toHaveBeenCalledTimes(1);
    bao(YT_STATE.PAUSED);
    expect(screen.getByText("Đã tắt nhạc")).toBeTruthy();

    fireEvent.click(nutNhac() as HTMLButtonElement);
    await act(async () => {});
    expect(screen.queryByText(CHUA_LUU_NHAC)).toBeNull();
  });

  it("loi video: dong loi thay cho nut, su kien sau do khong doi lai", async () => {
    await ve({ gate: false });
    san();
    act(() => may().opts.events.onError({ target: may(), data: 150 }));
    expect(screen.getByText("Không phát được nhạc này.")).toBeTruthy();
    expect(nutNhac()).toBeNull();
    bao(YT_STATE.PLAYING);
    expect(screen.getByText("Không phát được nhạc này.")).toBeTruthy();
    expect(nutNhac()).toBeNull();
  });

  it.each([
    ["tao trinh phat nem loi", class { constructor() { throw new Error("hong"); } destroy() {} }],
    ["getIframe nem loi", class { getIframe(): never { throw new Error("hong"); } destroy() {} }],
  ])("%s: ra trang thai loi, dong loi thay cho nut, khong con promise bi tu choi ma khong ai bat", async (_ten, Hong) => {
    const yt = window.YT as YTNamespace;
    const that = yt.Player;
    yt.Player = Hong as unknown as YTNamespace["Player"];
    try {
      await ve({ gate: false });
      await act(async () => {});
      expect(screen.getByText("Không phát được nhạc này.")).toBeTruthy();
      expect(nutNhac()).toBeNull();
    } finally {
      yt.Player = that;
    }
  });

  it("doi videoId ma khong doi key: huy trinh phat cu, tao trinh phat moi, trang thai ve tai ke ca sau loi", async () => {
    const khac = "abcdefghijk";
    const { rerender } = await ve({ gate: false });
    san();
    act(() => may().opts.events.onError({ target: may(), data: 150 }));
    expect(nutNhac()).toBeNull();
    const cu = may();

    rerender(phong({ gate: false, videoId: khac }));
    expect(screen.queryByText("Không phát được nhạc này.")).toBeNull();
    expect(nutNhac()?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => {});
    expect(cu.destroy).toHaveBeenCalledTimes(1);
    expect(cacMay).toHaveLength(2);
    expect(may().opts.videoId).toBe(khac);
    // Su kien muon cua trinh phat cu khong mo khoa nut.
    act(() => cu.opts.events.onReady({ target: cu }));
    expect(nutNhac()?.getAttribute("aria-disabled")).toBe("true");
    san();
    expect(nutNhac()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("go ra thi huy trinh phat va go iframe", async () => {
    const { container, unmount } = await ve();
    const the = container.querySelector(".nhac-the__may");
    unmount();
    expect(may().destroy).toHaveBeenCalledTimes(1);
    expect(the?.childElementCount).toBe(0);
  });

  it("sach lat trong luoi do cot chinh chu khong do cua so: --k theo be rong cot", async () => {
    const theoDoi: { el: Element; goi: ResizeObserverCallback }[] = [];
    window.ResizeObserver = class {
      readonly goi: ResizeObserverCallback;
      constructor(goi: ResizeObserverCallback) {
        this.goi = goi;
      }
      observe(el: Element) {
        theoDoi.push({ el, goi: this.goi });
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia = ((query: string) => ({
      matches: query === MAN_RONG, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { container } = await ve({ gate: false, children: <Flipbook title="Thu" author="Linh" sheets={[to("Mot"), to("Hai")]} start={0} /> });
    const doc = container.querySelector("section.doc");
    expect(theoDoi.map((x) => x.el)).toEqual([doc]);
    expect(doc?.parentElement?.classList.contains("doc-luoi__chinh")).toBe(true);
    act(() => theoDoi[0].goi([{ contentRect: { width: 632 } } as unknown as ResizeObserverEntry], {} as ResizeObserver));
    const k = Number(container.querySelector<HTMLElement>(".doc__khung")?.style.getPropertyValue("--k"));
    expect(k).toBeCloseTo(632 / 720, 5);
  });
});

describe("BookCover", () => {
  it("chi co tranh bia, chu sach va ten sach; khong so trang, khong dong nao noi ve nhac", () => {
    const { container } = render(<BookCover title="Chuyện chưa kể" cover="nui-xa" owner="Linh" />);
    expect(container.querySelector(".bia.bia-mo__hinh.bia--nui-xa svg")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Chuyện chưa kể" })).toBeTruthy();
    expect(container.querySelector(".bia-mo__ai")?.textContent).toBe("LLinh viết");
    expect(container.textContent).toBe("LLinh viếtChuyện chưa kể");
  });
});

describe("CSS mo sach", () => {
  it("chuyen dong mo sach chi dung opacity va transform", () => {
    const dong = readFileSync("src/styles/giay.css", "utf8")
      .split(String.fromCharCode(10))
      .find((l) => l.startsWith("@keyframes mo-sach"));
    expect(dong?.match(/[a-z-]+(?=:)/g)).toEqual(["opacity", "transform"]);
  });
});
