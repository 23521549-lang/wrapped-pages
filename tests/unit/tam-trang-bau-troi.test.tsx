// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BauTroi } from "@/components/tam-trang/BauTroi";
import { doHinh, soHoatDangGiu } from "@/components/tam-trang/song";
import type { TroiHien } from "@/lib/tam-trang/lich";
import { netTroi } from "@/lib/tam-trang/net-troi";
import { CHU_MS, SONG_HET, SONG_MS } from "@/lib/tam-trang/song-nhip";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";

/*
 * jsdom khong co Web Animations API: thay bang mot ban ghi lai moi lan goi animate (de kiem nhip), va cho phep goi tay
 * onfinish nhu khi song lan xong. Moi bo cuc trong jsdom la 0 nen bai nay kiem cau truc, lop, thu tu va nhip, con hinh
 * that duoc kiem o trinh duyet that.
 */
type LanGoi = { el: Element; keyframes: unknown; ken: { duration?: number; delay?: number; easing?: string }; daHuy: boolean };
const daGoi: LanGoi[] = [];
const ketThuc: (() => void)[] = [];
/** Mo ta goc cua Element.prototype.animate (jsdom khong co: undefined), de tra lai nguyen trang sau moi bai. */
const ANIMATE_GOC = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

beforeEach(() => {
  daGoi.length = 0;
  ketThuc.length = 0;
  Element.prototype.animate = function (this: Element, keyframes: unknown, ken: { duration?: number; delay?: number; easing?: string } = {}) {
    const ghi: LanGoi = { el: this, keyframes, ken, daHuy: false };
    daGoi.push(ghi);
    const a = {
      addEventListener: (ten: string, f: () => void) => { if (ten === "finish") ketThuc.push(f); },
      cancel: () => { ghi.daHuy = true; },
    };
    return a as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  // Tra lai Element.prototype.animate: khong de ban va cho cac tep kiem thu khac chay sau trong cung moi truong.
  if (ANIMATE_GOC === undefined) delete (Element.prototype as Partial<Element>).animate;
  else Object.defineProperty(Element.prototype, "animate", ANIMATE_GOC);
});

const KIA: TroiHien = { weather: "mua-phun", note: "Nhớ cậu một chút thôi.", tha: "Thả lúc 21:40", gio: "21:40" };
const MINH: TroiHien = { weather: "nang-am", note: null, tha: "Thả lúc 08:15", gio: "08:15" };

const ve = (kia: TroiHien | null, minh: TroiHien | null) => render(<BauTroi tenKia="Linh" kia={kia} minh={minh} />);

/**
 * Phai khop KHOA_TINH_MS cua src/components/tam-trang/song.ts: o nhanh giam chuyen dong khong co vong song nao giu
 * khoa, nen khoa tay dung khoang nay de mot lan cham khong doi cho hai lan. Doi so trong song.ts thi bai duoi bao ngay.
 */
const KHOA_TINH_MS = 500;

/** So net moi bau troi, dem tu chinh bo ve cua ban mau da duyet. */
const SO_NET: Record<Weather, number> = {
  "nang-am": 12, "troi-trong": 4, "may-nhe": 5, "gio-thoang": 12, "mua-phun": 70, "mua-rao": 92, giong: 74, "suong-mu": 5, "cau-vong": 6,
};

describe("BauTroi: mot bau troi", () => {
  it("khong ai giu tam trang: khong ve gi", () => {
    const { container } = ve(null, null);
    expect(container.innerHTML).toBe("");
  });

  it("chi nguoi kia: tho moi cau mot khoi (khong ten nguoi), giai nghia, nguon, loi nhan, luc tha, loi vao lich hoa, khong o cua so", () => {
    const { container } = ve(KIA, null);
    const vung = screen.getByRole("region", { name: "Tâm trạng của Linh" });
    expect(vung.className).toBe("troi troi--mua-phun");
    const tho = container.querySelector(".troi__tho");
    expect([...(tho?.querySelectorAll(".troi__cau") ?? [])].map((c) => c.textContent)).toEqual(["Tùy phong tiềm nhập dạ", "Nhuận vật tế vô thanh"]);
    expect(tho?.classList.contains("d")).toBe(true);
    expect(tho?.textContent).not.toContain("Linh");
    expect(container.querySelector(".troi__giai")?.textContent).toBe(TROI["mua-phun"].giai);
    expect(container.querySelector(".troi__nguon")?.textContent).toBe("Đỗ Phủ, Xuân dạ hỉ vũ");
    expect(container.querySelector(".troi__nhan")?.textContent).toBe("Nhớ cậu một chút thôi.");
    expect(container.querySelector(".troi__gio")?.textContent).toBe("Thả lúc 21:40");
    expect(container.querySelector(".troi__noi .sr-only")?.textContent).toBe("Linh: Mưa phùn.");
    expect(container.querySelector(".troi__ai")).toBeNull();
    const lien = screen.getByRole("link", { name: "Xem lịch hoa" });
    expect(lien.getAttribute("href")).toBe("/tam-trang");
    expect(lien.querySelector("svg.hoa use")?.getAttribute("href")).toBe("#hoa-hue-mua");
    expect(container.querySelector(".cua-so")).toBeNull();
    expect(container.querySelector(".troi-cua-so")).toBeNull();
  });

  it("chi chinh minh: troi lon mang nhan Ban, khong loi vao lich hoa, khong o cua so; tho Nom khong co giai nghia", () => {
    const { container } = ve(null, MINH);
    const vung = screen.getByRole("region", { name: "Tâm trạng của bạn" });
    expect(vung.className).toBe("troi troi--nang-am");
    expect(container.querySelector(".troi__ai")?.textContent).toBe("Bạn");
    expect(container.querySelector(".troi__noi .sr-only")?.textContent).toBe("Bạn: Nắng ấm.");
    expect(container.querySelector(".troi__giai")).toBeNull();
    expect(container.querySelector(".troi__nhan")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector(".cua-so")).toBeNull();
  });

  it.each(WEATHERS)("%s: nen troi an voi trinh doc man hinh, dung so net cua ban mau, moi net mang lop m", (w) => {
    const { container } = ve({ ...KIA, weather: w }, null);
    const nen = container.querySelector(".troi__nen");
    expect(nen?.getAttribute("aria-hidden")).toBe("true");
    expect(nen?.children).toHaveLength(SO_NET[w]);
    expect([...(nen?.children ?? [])].every((el) => el.classList.contains("m"))).toBe(true);
  });

  it("net ve tat dinh, gia tri la chuoi, khong co mau viet thang; cau vong nam dai moi dai mot lop", () => {
    for (const w of WEATHERS) {
      const a = netTroi(w);
      expect(netTroi(w)).toEqual(a);
      for (const n of a) for (const v of Object.values(n.bien)) {
        expect(typeof v).toBe("string");
        expect(v).not.toMatch(/oklch|rgb|#/);
      }
    }
    const { container } = ve({ ...KIA, weather: "cau-vong" }, null);
    expect([...container.querySelectorAll(".troi__nen .m-cv path")].map((p) => p.getAttribute("class"))).toEqual(["m-cv__1", "m-cv__2", "m-cv__3", "m-cv__4", "m-cv__5"]);
  });
});

describe("BauTroi: o cua so khi ca hai cung giu tam trang", () => {
  it("ca hai bau troi ve san, xep chong trong mot o luoi; troi an bi cat va tro nang, troi hien binh thuong", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so");
    // Hai bau troi, vung bao cua lan doi cho, vung bao cua nut tam dung.
    expect(dai?.children).toHaveLength(4);
    const mat = [...(dai?.querySelectorAll(".troi[data-mat]") ?? [])];
    expect(mat.map((s) => s.getAttribute("data-mat"))).toEqual(["kia", "minh"]);
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so");
    expect(mat[0].hasAttribute("inert")).toBe(false);
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so troi--an");
    expect(mat[1].hasAttribute("inert")).toBe(true);
    expect(mat[1].getAttribute("aria-hidden")).toBe("true");
    expect(dai?.querySelector(".troi-cua-so__bao")?.getAttribute("aria-live")).toBe("polite");
    expect(mat.map((s) => s.getAttribute("data-bao"))).toEqual(["Đang xem trời của Linh.", "Đang xem trời của bạn."]);
  });

  it("o cua so cua troi dang xem mang troi thu nho cua minh, bong hoa va gio tha", () => {
    const { container } = ve(KIA, MINH);
    const nut = screen.getByRole("button", { name: "Xem trời của bạn" });
    expect(nut.className).toBe("cua-so");
    const kinh = nut.querySelector(".cua-so__kinh");
    expect(kinh?.getAttribute("class")).toBe("cua-so__kinh troi--nang-am");
    expect(kinh?.querySelector(".cua-so__nen")?.children).toHaveLength(SO_NET["nang-am"]);
    expect(kinh?.querySelector("svg.hoa use")?.getAttribute("href")).toBe("#hoa-cuc");
    expect(nut.querySelector(".cua-so__chu")?.textContent).toBe("Trời của bạn08:15");
    expect(container.querySelector(".troi__chu")?.firstElementChild).toBe(nut);
  });

  it("an xuong o cua so: khung hinh dau tien chi bat song, viec nang doi sang sau do", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });

    // Ngay trong khung hinh dau: troi moi da bat dau lo ra, lop song da co, troi cu chua bi danh dau inert.
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so troi--dang-song");
    expect(container.querySelectorAll(".song-vong .song-lup")).toHaveLength(1);
    expect(container.querySelectorAll(".song-vong .song-bong")).toHaveLength(1);
    expect(container.querySelectorAll(".song-vong .song-vong__o")).toHaveLength(4);
    expect(container.querySelectorAll(".song-vong .song-giot")).toHaveLength(3);
    expect(container.querySelector(".song-kinh-cu")).not.toBeNull();
    expect(container.querySelector(".song-kinh-vong")).not.toBeNull();
    expect(mat[0].hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".troi-cua-so__bao")?.textContent).toBe("");

    // Sau khung hinh dau: doi inert, aria-hidden, focus va loi bao.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(mat[0].getAttribute("aria-hidden")).toBe("true");
    expect(mat[0].hasAttribute("inert")).toBe(true);
    expect(mat[1].hasAttribute("inert")).toBe(false);
    const nutMoi = screen.getByRole("button", { name: "Xem trời của Linh" });
    expect(document.activeElement).toBe(nutMoi);
    // Bam chuot thi khong hien vong focus (lop cua-so--im); bam phim thi co.
    expect(nutMoi.classList.contains("cua-so--im")).toBe(true);
    expect(container.querySelector(".troi-cua-so__bao")?.textContent).toBe("Đang xem trời của bạn.");
    fireEvent.keyDown(document, { key: "Tab" });
    expect(nutMoi.classList.contains("cua-so--im")).toBe(false);

    // Song lan xong: troi cu bi cat, lop tam bi go.
    act(() => {
      for (const f of ketThuc) f();
      vi.advanceTimersByTime(SONG_HET);
    });
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--an");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");
    expect(container.querySelector(".song-vong")).toBeNull();
    expect(container.querySelector(".song-kinh-cu")).toBeNull();
  });

  it("nhip song dung ban mau: song chinh 2600ms, ba vong phu tre dan, chu hien 750ms theo khoang cach", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    const vao = container.querySelectorAll(".troi[data-mat]")[1];

    const songChinh = daGoi.find((g) => g.el === vao);
    expect(songChinh?.ken.duration).toBe(SONG_MS);
    expect(songChinh?.ken.easing).toBe("cubic-bezier(0.33, 0.02, 0.3, 1)");
    expect(String(JSON.stringify(songChinh?.keyframes))).toContain("circle(");

    const chu = daGoi.filter((g) => g.el.parentElement?.classList.contains("troi__noi"));
    expect(chu.length).toBeGreaterThan(3);
    // Moi hinh chu nhat trong jsdom deu la 0 nen ban kinh song do duoc cung bang 0: tre cua moi dong dung bang 0.
    // Nhip tre theo khoang cach that duoc kiem rieng o tests/unit/tam-trang-song.test.ts (ham thuan treChu).
    expect(chu.every((g) => g.ken.duration === CHU_MS && g.ken.delay === 0)).toBe(true);

    const vongPhu = daGoi.filter((g) => (g.el as Element).classList.contains("song-vong__o"));
    expect(vongPhu.map((g) => g.ken.delay)).toEqual([0, 0, 380, 380, 860, 860, 1400, 1400]);
    const toe = daGoi.filter((g) => (g.el as Element).classList.contains("song-giot"));
    expect(toe.map((g) => g.ken.duration)).toEqual([1500, 1500, 1500]);
    const nut = daGoi.find((g) => (g.el as Element).classList.contains("cua-so"));
    expect(nut?.ken.duration).toBe(1200);
  });

  it("bam lan hai trong luc song dang lan bi bo qua", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    const nut = screen.getByRole("button", { name: "Xem trời của bạn" });
    fireEvent.pointerDown(nut, { button: 0, isPrimary: true });
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    const soLop = container.querySelectorAll(".song-vong").length;
    const lopTruoc = mat.map((s) => s.className);
    fireEvent.pointerDown(container.querySelectorAll(".cua-so")[1], { button: 0, isPrimary: true });
    expect(container.querySelectorAll(".song-vong")).toHaveLength(soLop);
    // Khong chi khong co vong song thu hai: hai bau troi cung KHONG doi cho lan nua (lan bam bi bo qua han).
    expect(mat.map((s) => s.className)).toEqual(lopTruoc);
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so troi--dang-song");
    act(() => {
      vi.advanceTimersByTime(SONG_MS + 100);
    });
  });

  it("bam bang ban phim: doi cho va vong focus van hien", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    // Ban phim gui click voi detail = 0, khong co pointerdown truoc do.
    fireEvent.click(screen.getByRole("button", { name: "Xem trời của bạn" }), { detail: 0 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    const nutMoi = screen.getByRole("button", { name: "Xem trời của Linh" });
    expect(nutMoi.classList.contains("cua-so--im")).toBe(false);
    expect(container.querySelector(".troi-cua-so__bao")?.textContent).toBe("Đang xem trời của bạn.");
  });

  it("giam chuyen dong: doi ngay, khong lop song nao", () => {
    vi.useFakeTimers();
    const matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList);
    vi.stubGlobal("matchMedia", matchMedia);
    const { container } = ve(KIA, MINH);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--an");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");
    expect(container.querySelector(".song-vong")).toBeNull();
    expect(daGoi).toHaveLength(0);
    expect(container.querySelector(".troi-cua-so__bao")?.textContent).toBe("Đang xem trời của bạn.");
    vi.unstubAllGlobals();
  });

  it("do bo cuc luc ranh cung nhan ban san o kinh: lan bam khong phai nhan ban 100 phan tu", () => {
    const { container } = ve(KIA, MINH);
    const h = doHinh(container.querySelector(".troi-cua-so") as HTMLElement);
    expect(Object.keys(h.kinh)).toEqual(["kia", "minh"]);
    // O kinh cua mat "kia" mang troi thu nho cua nguoi xem, va nguoc lai; ban sao de roi, chua gan vao trang.
    expect(h.kinh.kia.className).toBe("cua-so__kinh troi--nang-am song-kinh-cu");
    expect(h.kinh.minh.className).toBe("cua-so__kinh troi--mua-phun song-kinh-cu");
    expect(h.kinh.kia.isConnected).toBe(false);
    expect(h.kinh.kia.querySelector(".cua-so__nen")?.children).toHaveLength(SO_NET["nang-am"]);
  });

  it("song lan xong thi nha khoa: bam tiep doi cho nguoc lai duoc", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    act(() => {
      for (const f of ketThuc) f();
      vi.advanceTimersByTime(SONG_HET);
    });
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");
    fireEvent.pointerDown(container.querySelectorAll(".cua-so")[1], { button: 0, isPrimary: true });
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--dang-song");
  });

  it("roi trang giua luc song dang lan: huy sach hoat hinh, hen gio va khung hinh dang cho", () => {
    vi.useFakeTimers();
    const { unmount } = ve(KIA, MINH);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(daGoi.length).toBeGreaterThan(10);
    expect(daGoi.some((g) => g.daHuy)).toBe(false);
    unmount();
    expect(daGoi.every((g) => g.daHuy)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("tu mot troi thanh hai troi ma khong dung lai thanh phan: nut o cua so van bam duoc", () => {
    vi.useFakeTimers();
    // Sau khi nguoi xem tha tam trang, trang song lai voi hai troi nhung thanh phan khong bi dung lai.
    const { container, rerender } = render(<BauTroi tenKia="Linh" kia={KIA} minh={null} />);
    expect(container.querySelector(".cua-so")).toBeNull();
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(container.querySelector(".song-vong")).not.toBeNull();
    expect(container.querySelectorAll(".troi[data-mat]")[1].className).toBe("troi troi--nang-am troi--cua-so troi--dang-song");
  });

  it("chi lam nong troi an khi con tro vao dung o cua so, roi o thi thoi", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    const nut = screen.getByRole("button", { name: "Xem trời của bạn" });
    // Quet chuot ngang qua dai troi khong duoc danh thuc gan hai tram hoat hinh cua troi dang an.
    fireEvent.pointerOver(dai);
    expect(dai.classList.contains("troi-cua-so--san")).toBe(false);
    fireEvent.pointerOver(nut);
    expect(dai.classList.contains("troi-cua-so--san")).toBe(true);
    fireEvent.pointerOut(nut, { relatedTarget: dai });
    expect(dai.classList.contains("troi-cua-so--san")).toBe(false);
  });

  it("giam chuyen dong: mot lan cham (pointerdown roi click detail 0) chi doi cho mot lan", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    const { container } = ve(KIA, MINH);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    // Tren man cam ung, click di sau pointerdown cung mang detail = 0 y nhu click cua ban phim.
    fireEvent.click(container.querySelectorAll(".cua-so")[1], { detail: 0 });
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--an");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");
    vi.unstubAllGlobals();
  });

  it("giam chuyen dong: nha khoa sau 500ms roi bam tiep thi doi cho nguoc lai duoc", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    const { container } = ve(KIA, MINH);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");

    // Van con trong khoang khoa tay (KHOA_TINH_MS = 500 cua song.ts): lan bam thu hai chua duoc doi cho.
    act(() => { vi.advanceTimersByTime(KHOA_TINH_MS - 1); });
    fireEvent.pointerDown(container.querySelectorAll(".cua-so")[1], { button: 0, isPrimary: true });
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--an");

    // Dung moc 500ms thi khoa nha: bam tiep doi cho nguoc lai, van khong co lop song nao.
    act(() => { vi.advanceTimersByTime(1); });
    fireEvent.pointerDown(container.querySelectorAll(".cua-so")[1], { button: 0, isPrimary: true });
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so troi--an");
    expect(container.querySelector(".song-vong")).toBeNull();
    expect(daGoi).toHaveLength(0);
    expect(container.querySelector(".troi-cua-so__bao")?.textContent).toBe("Đang xem trời của Linh.");
    vi.unstubAllGlobals();
  });

  it("khong co style noi tuyen nao trong JSX: chi net ve bau troi va lop song do ham tao ra moi co style", () => {
    const { container } = ve(KIA, MINH);
    const co = [...container.querySelectorAll("[style]")];
    // Co that su tim thay phan tu mang style (neu khong, khang dinh every() duoi day dat gia tren mang rong).
    expect(co.length).toBeGreaterThan(0);
    expect(co.every((el) => el.classList.contains("m"))).toBe(true);
  });
});

describe("BauTroi: khong ro ri hoat hinh khi doi cho nhieu lan", () => {
  const bamOHien = (container: HTMLElement) => fireEvent.pointerDown(
    container.querySelector(".troi[data-mat]:not(.troi--an) .cua-so") as Element,
    { button: 0, isPrimary: true },
  );

  it("bam qua lai nhieu lan: so hoat hinh dai troi giu khong lon dan, moi vong song don sach cua no", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    const choTan = () => act(() => {
      for (const f of ketThuc) f();
      vi.advanceTimersByTime(SONG_HET);
    });

    bamOHien(container);
    const lan1 = soHoatDangGiu(dai);
    // Mot vong song ghi khoang 27 Animation (song chinh, cac dong chu, hai lup bong, tam vong, ba toe, nut, kinh...).
    expect(lan1).toBeGreaterThan(20);
    choTan();
    expect(soHoatDangGiu(dai), "vong song tan ma hoat hinh van con trong so").toBe(0);

    bamOHien(container);
    choTan();
    expect(soHoatDangGiu(dai)).toBe(0);

    // Lan thu ba lap lai DUNG chieu cua lan mot: so phai bang het lan mot, khong phai ba lan lan mot.
    bamOHien(container);
    expect(soHoatDangGiu(dai)).toBe(lan1);
    choTan();
    expect(soHoatDangGiu(dai)).toBe(0);
  });

  it("vong song moi huy va bo han hoat hinh con sot cua vong truoc", () => {
    vi.useFakeTimers();
    // Ban gia nay bao moi hoat hinh van dang chay (trinh duyet khong bao finish, vd tab bi an dung luc song lan): chung
    // o lai trong so chung sau SONG_HET de con huy duoc, nhung khong duoc cong don qua tung lan bam.
    type Gia = { playState: string; daHuy: boolean; addEventListener: () => void; cancel: () => void };
    const gia: Gia[] = [];
    Element.prototype.animate = function () {
      const a: Gia = { playState: "running", daHuy: false, addEventListener: () => undefined, cancel: () => { a.daHuy = true; } };
      gia.push(a);
      return a as unknown as Animation;
    } as unknown as typeof Element.prototype.animate;

    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    bamOHien(container);
    const lan1 = soHoatDangGiu(dai);
    expect(lan1).toBeGreaterThan(20);

    act(() => {
      vi.advanceTimersByTime(SONG_HET);
    });
    expect(soHoatDangGiu(dai), "hoat hinh chua chay xong thi chua duoc bo (con phai huy duoc)").toBe(lan1);
    expect(gia.some((a) => a.daHuy)).toBe(false);

    bamOHien(container);
    expect(gia.slice(0, lan1).every((a) => a.daHuy), "vong song moi phai huy sach hoat hinh con sot").toBe(true);
    expect(soHoatDangGiu(dai)).toBe(gia.length - lan1);
    expect(soHoatDangGiu(dai)).toBeLessThan(lan1 * 2);
  });
});

/** Vung bao rieng cua nut tam dung: the sr-only tran nam ngay duoi dai troi (khong phai .troi-cua-so__bao). */
const baoDung = (dai: Element) => [...dai.children].find((el) => el.className === "sr-only")?.textContent;

describe("BauTroi: nut tam dung bau troi (WCAG SC 2.2.2)", () => {
  afterEach(() => {
    try {
      localStorage.clear();
    } catch {
      // Ban gia cua bai kiem co the khong co clear: khong sao, moi bai tu dat lai gia tri no can.
    }
  });

  it("bam tam dung: dai troi mang lop troi-dung, nhan doi o ca hai mat, co loi bao lich su", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    const nut = [...container.querySelectorAll<HTMLButtonElement>(".nut-dung")];
    expect(nut).toHaveLength(2);
    expect(nut.map((n) => n.textContent)).toEqual(["Tạm dừng bầu trời", "Tạm dừng bầu trời"]);
    expect(dai.classList.contains("troi-dung")).toBe(false);
    expect(baoDung(dai)).toBe("");

    fireEvent.click(nut[0]);
    expect(dai.classList.contains("troi-dung")).toBe(true);
    // Ca hai mat doi nhan cung luc: doi cho xong thi nhan tren mat vua hien van dung.
    expect(nut.map((n) => n.textContent)).toEqual(["Cho bầu trời chạy", "Cho bầu trời chạy"]);
    expect(baoDung(dai)).toBe("Bầu trời đã tạm dừng.");

    fireEvent.click(nut[0]);
    expect(dai.classList.contains("troi-dung")).toBe(false);
    expect(nut[0].textContent).toBe("Tạm dừng bầu trời");
    expect(baoDung(dai)).toBe("Bầu trời chạy lại rồi.");
  });

  it("nho lua chon: ghi vao localStorage, va lan ve sau dai troi dung san tu luc vao cay", () => {
    const { container, unmount } = ve(KIA, MINH);
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    expect(localStorage.getItem("troi-tam-dung")).toBe("dung");
    unmount();

    const lai = ve(KIA, MINH);
    expect((lai.container.querySelector(".troi-cua-so") as HTMLElement).classList.contains("troi-dung")).toBe(true);
    expect(lai.container.querySelector(".nut-dung")?.textContent).toBe("Cho bầu trời chạy");

    // Cho chay lai thi lan sau cung chay lai, khong phai chi xoa khoa di.
    fireEvent.click(lai.container.querySelector(".nut-dung") as Element);
    expect(localStorage.getItem("troi-tam-dung")).toBe("chay");
  });

  it("trinh duyet cam luu tru: ca doc lan ghi deu nem loi ma nut van doi duoc", () => {
    const nem = () => {
      throw new Error("khong cho luu tru");
    };
    vi.stubGlobal("localStorage", { getItem: nem, setItem: nem });
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    expect(dai.classList.contains("troi-dung")).toBe(false);
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    expect(dai.classList.contains("troi-dung")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("lop tam dung dat bang classList nen khong ghi de lop cua song.ts, va nguoc lai", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    fireEvent.pointerOver(screen.getByRole("button", { name: "Xem trời của bạn" }));
    expect(dai.classList.contains("troi-cua-so--san")).toBe(true);
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    expect(dai.className).toBe("troi-cua-so troi-cua-so--san troi-dung");
  });

  it("dang tam dung van doi cho duoc: vong song chay nhu thuong va lop tam dung o lai", () => {
    vi.useFakeTimers();
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(container.querySelectorAll(".song-vong")).toHaveLength(1);
    act(() => {
      for (const f of ketThuc) f();
      vi.advanceTimersByTime(SONG_HET);
    });
    expect(mat[0].className).toBe("troi troi--mua-phun troi--cua-so troi--an");
    expect(mat[1].className).toBe("troi troi--nang-am troi--cua-so");
    expect(dai.classList.contains("troi-dung")).toBe(true);
  });

  it("chi mot bau troi: nut va vung bao nam TRONG the troi, khong chen the nao giua dai troi va .shell", () => {
    const { container } = ve(KIA, null);
    // Quy tac ".troi + .shell .ke-dau" doi dai troi la anh em lien ke ngay truoc .shell: dai troi phai la con duy nhat.
    expect(container.children).toHaveLength(1);
    const troi = container.querySelector(".troi") as HTMLElement;
    expect(troi.querySelector(".nut-dung")?.textContent).toBe("Tạm dừng bầu trời");
    fireEvent.click(troi.querySelector(".nut-dung") as Element);
    expect(troi.classList.contains("troi-dung")).toBe(true);
    expect(troi.querySelector(".troi__noi > .sr-only[aria-live]")?.textContent).toBe("Bầu trời đã tạm dừng.");
  });
});
