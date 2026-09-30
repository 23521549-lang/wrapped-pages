import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoThu, SU_KIEN_THU_DA_MO } from "@/components/thu/ChoThu";
import { LaThuBay } from "@/components/thu/LaThuBay";
import { TongKetThang, type ThangTongKetHien } from "@/components/tam-trang/TongKetThang";
import { tongKetThang } from "@/lib/tam-trang/tong-ket";

/*
 * Giao dien thu thang (5b, spec D, E, F): o tong ket tha xuong, cho thu chi mot thu (thu cua minh khong bao gio co), to
 * giay viet thu hoi lai truoc khi gui, la thu troi hoi moi 20 giay khi tab dang xem, cua so doc thu.
 */

const { actionGuiThu, actionMoThu, actionThuChuaMo, refresh } = vi.hoisted(() => ({
  actionGuiThu: vi.fn(),
  actionMoThu: vi.fn(),
  actionThuChuaMo: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/thu", () => ({ actionGuiThu, actionMoThu, actionThuChuaMo }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const doi = () => act(async () => {});
const TK = tongKetThang({ 3: { kia: { weather: "mua-phun", gio: "08:00", note: null, xoay: 0 }, minh: { weather: "mua-phun", gio: "09:00", note: null, xoay: 0 } } }, "Linh");

function thang(khoa: string, thu: ThangTongKetHien["thu"]): ThangTongKetHien {
  return { khoa, ten: "Tháng Chín, 2026", tenThangChu: "tháng Chín", tk: TK, thu };
}

beforeAll(() => {
  // jsdom chua co hop thoai modal day du.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.history.replaceState(null, "", "/tam-trang");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    // khong co luu tru
  }
});

describe("TongKetThang", () => {
  const nay = { ten: "Tháng Mười", mo: "1.11", noiBat: null };

  it("moi thang mot o thu gon: dong tom tat, phan tha xuong inert; bam thi mo, bam lai thi dong", async () => {
    render(<TongKetThang thang={[thang("2026-09", { tt: { minhGui: false, kiaGui: false }, kia: null, chuaMo: false })]} nay={nay} tenKia="Linh" tenMinh="Mạnh" />);
    expect(document.querySelector(".tk__nay")?.textContent).toBe("Tháng Mười đang diễn ra, tổng kết mở vào ngày 1.11.");
    const nut = screen.getByRole("button", { name: /Tháng Chín, 2026/ });
    expect(nut.textContent).toContain("Cả hai ít thả");
    expect(nut.textContent).toContain("Chưa ai viết thư");
    expect(nut.getAttribute("aria-expanded")).toBe("false");
    const vung = document.getElementById(nut.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(vung.hasAttribute("inert")).toBe(true);
    fireEvent.click(nut);
    expect(nut.getAttribute("aria-expanded")).toBe("true");
    expect(vung.hasAttribute("inert")).toBe(false);
    expect(vung.textContent).toContain("1 ngày hai người cùng một trời");
    fireEvent.click(nut);
    expect(nut.getAttribute("aria-expanded")).toBe("false");
  });

  it("neo #thu-YYYY-MM: mo dung thang roi cuon toi cho thu", async () => {
    vi.useFakeTimers();
    const cuon = vi.fn();
    Element.prototype.scrollIntoView = cuon;
    window.history.replaceState(null, "", "/tam-trang#thu-2026-08");
    render(
      <TongKetThang
        thang={[
          thang("2026-09", { tt: { minhGui: false, kiaGui: false }, kia: null, chuaMo: false }),
          { ...thang("2026-08", { tt: { minhGui: false, kiaGui: true }, kia: null, chuaMo: false }), ten: "Tháng Tám, 2026" },
        ]}
        nay={nay}
        tenKia="Linh"
        tenMinh="Mạnh"
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByRole("button", { name: /Tháng Tám, 2026/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /Tháng Chín, 2026/ }).getAttribute("aria-expanded")).toBe("false");
    expect(cuon).toHaveBeenCalledTimes(1);
    expect((cuon.mock.contexts[0] as HTMLElement).dataset.choThu).toBe("2026-08");
  });

  it("nguoi kia da viet ma minh chua gui: nhan mang dau Moi, cho thu chi co to giay de viet", async () => {
    render(<TongKetThang thang={[thang("2026-09", { tt: { minhGui: false, kiaGui: true }, kia: null, chuaMo: true })]} nay={nay} tenKia="Linh" tenMinh="Mạnh" />);
    expect(document.querySelector(".thg__tt .dh--moi")?.textContent).toBe("Linh đã viết cho bạn");
    expect(screen.getByRole("textbox", { name: "Thư của bạn gửi Linh" })).toBeTruthy();
    expect(document.querySelector(".thu__mot article")).toBeNull();
  });
});

describe("ChoThu", () => {
  const chung = { thang: "2026-09", tenThangChu: "tháng Chín", tenKia: "Linh", tenMinh: "Mạnh" };

  it("da gui, nguoi kia chua: dong cho, khong o chu", () => {
    render(<ChoThu {...chung} tt={{ minhGui: true, kiaGui: false }} kia={null} chuaMo={false} mo />);
    expect(document.querySelector(".thu-la--dong")?.textContent).toBe("Thư của bạn đã tới tay Linh. Khi Linh viết, thư sẽ bay tới góc trên màn hình của bạn.");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("ca hai da gui: thu nguoi kia; chua mo ma o dang mo thi ghi da mo mot lan va bao cho la thu troi", async () => {
    actionMoThu.mockResolvedValue({ thu: { thang: "2026-09", noiDung: "Chào", gio: "hôm nay, 09:00", minhGui: true } });
    const nghe = vi.fn();
    addEventListener(SU_KIEN_THU_DA_MO, nghe);
    const { rerender } = render(<ChoThu {...chung} tt={{ minhGui: true, kiaGui: true }} kia={{ noiDung: "Tháng này em nấu cháo.", gio: "hôm nay, 09:00" }} chuaMo mo={false} />);
    expect(screen.getByRole("article", { name: "Thư tháng Chín của Linh" }).textContent).toBe("Gửi Mạnh,Tháng này em nấu cháo.LinhLinh gửi hôm nay, 09:00");
    expect(actionMoThu).not.toHaveBeenCalled();
    rerender(<ChoThu {...chung} tt={{ minhGui: true, kiaGui: true }} kia={{ noiDung: "Tháng này em nấu cháo.", gio: "hôm nay, 09:00" }} chuaMo mo />);
    await doi();
    rerender(<ChoThu {...chung} tt={{ minhGui: true, kiaGui: true }} kia={{ noiDung: "Tháng này em nấu cháo.", gio: "hôm nay, 09:00" }} chuaMo mo />);
    await doi();
    expect(actionMoThu).toHaveBeenCalledTimes(1);
    expect(actionMoThu).toHaveBeenCalledWith("2026-09");
    expect(nghe).toHaveBeenCalledTimes(1);
    removeEventListener(SU_KIEN_THU_DA_MO, nghe);
  });

  it("to giay: dem ky tu; rong thi nhac; hoi lai truoc khi gui; Xem lai hay Esc la quay lai o chu", async () => {
    render(<ChoThu {...chung} tt={{ minhGui: false, kiaGui: false }} kia={null} chuaMo={false} mo />);
    fireEvent.click(screen.getByRole("button", { name: "Gửi thư" }));
    expect(screen.getByRole("alert").textContent).toBe("Viết vài dòng rồi hãy gửi nhé.");
    const o = screen.getByRole("textbox", { name: "Thư của bạn gửi Linh" });
    fireEvent.change(o, { target: { value: "  Tháng này anh nắng nhiều.  " } });
    expect(document.querySelector(".thu-la__dem")?.textContent).toBe("25/1000");
    fireEvent.click(screen.getByRole("button", { name: "Gửi thư" }));
    const hoi = screen.getByRole("group", { name: "Xác nhận gửi thư" });
    expect(hoi.textContent).toContain("Gửi rồi sẽ không sửa được, và bạn cũng không xem lại được thư của mình.");
    expect(document.activeElement?.textContent).toBe("Xem lại");
    expect((o as HTMLTextAreaElement).readOnly).toBe(true);
    fireEvent.keyDown(hoi, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Xác nhận gửi thư" })).toBeNull();
    expect(document.activeElement).toBe(o);
  });

  it("gui: goi action voi thang va chu; loi thi hien cau loi va mo lai o chu; duoc thi lam moi trang", async () => {
    render(<ChoThu {...chung} tt={{ minhGui: false, kiaGui: false }} kia={null} chuaMo={false} mo />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thư" } });
    actionGuiThu.mockResolvedValueOnce({ error: "Bạn đã gửi thư tháng này rồi." });
    fireEvent.click(screen.getByRole("button", { name: "Gửi thư" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    await doi();
    expect(actionGuiThu).toHaveBeenCalledWith("2026-09", "Thư");
    expect(screen.getByRole("alert").textContent).toBe("Bạn đã gửi thư tháng này rồi.");
    expect(refresh).not.toHaveBeenCalled();
    actionGuiThu.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Gửi thư" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    await doi();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("LaThuBay", () => {
  it("co thu chua mo: nut phong bi o moi trang; khong co thi khong co nut", () => {
    const { unmount } = render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
    expect(screen.getByRole("button", { name: "Linh gửi bạn thư tháng Chín. Bấm để đọc" })).toBeTruthy();
  });

  it("la moi an tu lan ve dau (ke ca tu may chu) toi khi chim tha xuong, bao mot lan; la da toi thi hien ngay, khong bao lai", async () => {
    const khungHinh = () => act(async () => {
      await new Promise<void>((xong) => {
        requestAnimationFrame(() => xong());
      });
    });
    const { unmount } = render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
    const nut = () => document.querySelector(".thu-bay") as HTMLElement;
    expect(nut().className).toBe("thu-bay thu-bay--cho");
    await khungHinh();
    expect(nut().className).toBe("thu-bay");
    expect(document.querySelector("[aria-live]")?.textContent).toBe("Linh vừa gửi thư tháng Chín cho bạn.");
    unmount();
    render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
    expect(nut().className).toBe("thu-bay thu-bay--cho");
    await khungHinh();
    expect(nut().className).toBe("thu-bay");
    expect(document.querySelector("[aria-live]")?.textContent).toBe("");
  });

  it("la thu nam duoi thanh dieu huong that: do chieu cao thanh (hai, ba hang o man hep) thay vi doan", async () => {
    vi.stubGlobal("ResizeObserver", class {
      constructor(private readonly goi: () => void) {}
      observe() {
        this.goi();
      }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "NAV" ? 141 : 0;
    });
    render(
      <>
        <nav className="nav" aria-label="Điều hướng chính" />
        <LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />
      </>,
    );
    await doi();
    expect((document.querySelector(".thu-bay") as HTMLElement).style.getPropertyValue("--nav-that")).toBe("141px");
  });

  it("hoi lai moi 20 giay khi tab dang duoc xem; tab an thi khong hoi; thu vua mo o noi khac thi an ngay", async () => {
    vi.useFakeTimers();
    actionThuChuaMo.mockResolvedValue({ id: "t2", thang: "2026-08" });
    render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={null} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(actionThuChuaMo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /thư tháng Tám/ })).toBeTruthy();
    const an = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(actionThuChuaMo).toHaveBeenCalledTimes(1);
    an.mockRestore();
    act(() => {
      dispatchEvent(new CustomEvent(SU_KIEN_THU_DA_MO, { detail: "2026-08" }));
    });
    expect(screen.queryByRole("button", { name: /thư tháng Tám/ })).toBeNull();
  });

  it("mo cua so: hoat canh chay tu luc mo, khong cho may chu: phong bi bay vao, nap mo, to thu an toi 720ms roi troi len", async () => {
    const goc = HTMLElement.prototype.animate;
    const goi: { lop: string; tuyChon: KeyframeAnimationOptions }[] = [];
    HTMLElement.prototype.animate = function (this: HTMLElement, _k: Keyframe[], t: KeyframeAnimationOptions) {
      goi.push({ lop: this.getAttribute("class") ?? "", tuyChon: t });
      return { finished: Promise.resolve() } as unknown as Animation;
    } as unknown as HTMLElement["animate"];
    SVGElement.prototype.animate = HTMLElement.prototype.animate as unknown as SVGElement["animate"];
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    // La nay da toi tren trinh duyet nay: khong co chim bay (hoat canh cua chim khong phai viec cua bai nay).
    localStorage.setItem("mqce-thu-da-toi", JSON.stringify(["t1"]));
    try {
      actionMoThu.mockReturnValue(new Promise(() => {}));
      render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Bấm để đọc/ }));
      await doi();
      expect(document.querySelector(".thu-hop__cho")?.textContent).toBe("Đang mở thư");
      expect(goi.filter((g) => g.lop === "thu-hop__phong")).toHaveLength(2);
      expect(goi.filter((g) => g.lop === "phong__nap").map((g) => g.tuyChon.delay)).toEqual([480]);
      expect(goi.filter((g) => g.lop === "thu-hop__to").map((g) => [g.tuyChon.delay, g.tuyChon.fill])).toEqual([[720, "backwards"]]);
    } finally {
      HTMLElement.prototype.animate = goc;
      delete (SVGElement.prototype as { animate?: unknown }).animate;
    }
  });

  it("bam: cua so doc thu mo, ghi da mo va hien thu; minh chua gui thi co to giay tra loi va nut De sau", async () => {
    actionMoThu.mockResolvedValue({ thu: { thang: "2026-09", noiDung: "Tháng Chín của em hơi ướt.", gio: "hôm nay, 22:40", minhGui: false } });
    render(<LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Bấm để đọc/ }));
    await doi();
    const hop = document.querySelector("dialog.thu-hop") as HTMLDialogElement;
    expect(hop.open).toBe(true);
    expect(hop.getAttribute("aria-label")).toBe("Thư tháng Chín của Linh");
    expect(actionMoThu).toHaveBeenCalledWith("2026-09");
    expect(hop.querySelector(".thu-la__than")?.textContent).toBe("Tháng Chín của em hơi ướt.");
    expect(hop.querySelector(".thu-la__gio")?.textContent).toBe("Thư tháng Chín, Linh gửi hôm nay, 22:40");
    expect(hop.querySelector(".thu-hop__tl-t")?.textContent).toBe("Viết thư trả lời Linh");
    expect(screen.queryByRole("button", { name: /Bấm để đọc/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(document.querySelector("dialog.thu-hop")).toBeNull();
  });

  it("dong cua so thu khi la thu troi da di (thu da doc): focus ve vung noi dung chinh, khong roi ve body", async () => {
    actionMoThu.mockResolvedValue({ thu: { thang: "2026-09", noiDung: "Chào", gio: "hôm nay, 22:40", minhGui: true } });
    render(<main><LaThuBay tenKia="Linh" tenMinh="Mạnh" dau={{ id: "t1", thang: "2026-09" }} /></main>);
    fireEvent.click(screen.getByRole("button", { name: /Bấm để đọc/ }));
    await doi();
    expect(screen.queryByRole("button", { name: /Bấm để đọc/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(document.activeElement?.tagName).toBe("MAIN");
  });
});

describe("thu.css", () => {
  const CSS = readFileSync("src/styles/thu.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const giam = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("moi hoat anh va chuyen tiep deu co nhanh giam chuyen dong", () => {
    for (const chon of [".thg__mo", ".thg__tom", ".thg__mui svg", ".thu-bay__troi", ".thu-bay__lac", ".thu-bay__lat", ".thu-bay__bong", ".chim__canh", ".chim-bay__thu"]) {
      expect(giam).toContain(chon);
    }
  });

  it("la thu troi re chuot hay focus thi dung; vung bam cua nut toi thieu 44px", () => {
    expect(CSS).toMatch(/\.thu-bay:focus-visible \.thu-bay__troi[^{]*\{ animation-play-state: paused; \}/);
    expect(CSS).toMatch(/\.thu-bay\{[^}]*min-height: 44px/);
    expect(CSS).toMatch(/\.thg__tom\{[^}]*min-height: 64px/);
    expect(CSS).toMatch(/\.ke-thu\{[^}]*min-height: 44px/);
  });

  it("dong nhac thu o Ke sach xuong dong duoc, khong giu nowrap cua .dh (font Linux rong hon, tran o 320px)", () => {
    expect(CSS).toMatch(/\.ke-thu\{[^}]*white-space: normal/);
    expect(CSS).toMatch(/\.ke-thu\{[^}]*max-width: 100%/);
    expect(CSS).toMatch(/\.ke-thu\{[^}]*overflow-wrap: anywhere/);
  });

  it("mau va lop xep chong di qua token, khong ma mau viet tay", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/oklch\(/);
    for (const m of CSS.matchAll(/z-index:\s*([^;}]+)/g)) expect(m[1].trim()).toMatch(/^calc\(var\(--z-[a-z-]+\) \+ [0-9]+\)$/);
  });
});
