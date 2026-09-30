import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LinhVat } from "@/components/linh-vat/LinhVat";
import { dienHieuUng } from "@/components/linh-vat/hieu-ung";
import { CAM_XUC, CHIP, dongMangToi, LOAI_CAM_XUC } from "@/lib/cam-xuc";
import { CHO_THA_TIEP, CHUA_THA_CAM_XUC } from "@/app/actions/messages";

/*
 * Chip va Kho cam xuc (5d, spec C, D): mo va dong kho (Esc tra focus), chon mot cam xuc thi cau xem truoc doi, Tha goi
 * action, loi hien trong kho; ben nhan dien lan luot hang cho (goi da xem, moi cam xuc mot lan tren trinh duyet), lop hieu
 * ung xuyen chuot chi co luc dang dien, giam chuyen dong thi khong co lop hieu ung.
 */

const { actionThaCamXuc, actionCamXucChoToi, actionDaXemCamXuc } = vi.hoisted(() => ({
  actionThaCamXuc: vi.fn(),
  actionCamXucChoToi: vi.fn(),
  actionDaXemCamXuc: vi.fn(),
}));
vi.mock("@/app/actions/cam-xuc", () => ({ actionThaCamXuc, actionCamXucChoToi, actionDaXemCamXuc }));

const doi = () => act(async () => {});
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function giamChuyenDong(bat: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: bat && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  giamChuyenDong(false);
  actionCamXucChoToi.mockResolvedValue([]);
  actionDaXemCamXuc.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    // khong co luu tru
  }
});

describe("Kho cam xuc", () => {
  it("bam Chip mo kho: tam cam xuc, chua chon thi Tha tat; Esc dong va tra focus ve Chip", async () => {
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} />);
    const chip = screen.getByRole("button", { name: "Chíp, mở Kho cảm xúc" });
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const kho = screen.getByRole("region", { name: "Kho cảm xúc" });
    expect(kho.textContent).toContain("Mỗi cảm xúc có một bạn nhỏ mang tới Linh.");
    const nut = LOAI_CAM_XUC.map((l) => screen.getByRole("button", { name: CAM_XUC[l].camXuc }));
    expect(nut).toHaveLength(8);
    expect(document.activeElement).toBe(nut[0]);
    expect((screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(nut[3], { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Kho cảm xúc" })).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it("chon mot cam xuc: nut nhan, anh dong, cau xem truoc la cau nguoi kia se thay", async () => {
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở Kho cảm xúc" }));
    const yeu = screen.getByRole("button", { name: "Yêu" });
    expect(yeu.querySelector("img")?.getAttribute("src")).toBe(CAM_XUC.yeu.anhTinh);
    fireEvent.click(yeu);
    expect(yeu.getAttribute("aria-pressed")).toBe("true");
    expect(yeu.querySelector("img")?.getAttribute("src")).toBe(CAM_XUC.yeu.anh);
    expect(yeu.querySelector("source")?.getAttribute("srcset")).toBe(CAM_XUC.yeu.anhTinh);
    expect(screen.getByText(/sẽ nói với Linh/).textContent).toBe("Gấu bông sẽ nói với Linh: Mạnh đang cảm thấy yêu bạn");
    expect((screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Tha: goi action voi loai da chon, dong kho, Chip hoa hinh va noi da mang di; khong co lop hieu ung ben nguoi tha", async () => {
    actionThaCamXuc.mockResolvedValue({ ok: true });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở Kho cảm xúc" }));
    fireEvent.click(screen.getByRole("button", { name: "Trêu" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(actionThaCamXuc).toHaveBeenCalledWith("treu");
    expect(screen.queryByRole("region", { name: "Kho cảm xúc" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chíp, mở Kho cảm xúc" }));
    expect(document.querySelector(".loi-lv__chu")?.textContent).toBe("Khỉ con đang mang Trêu tới Linh.Linh không mở web lúc này thì lần sau vào sẽ thấy.");
    expect(document.querySelector(".linh-vat__hinh img")?.getAttribute("src")).toBe(CAM_XUC.treu.anh);
    expect(document.querySelector(".hieu-ung")).toBeNull();
  });

  it("loi cua action va mat mang: hien trong kho, kho van mo, lua chon giu nguyen", async () => {
    actionThaCamXuc.mockResolvedValueOnce({ error: CHO_THA_TIEP }).mockRejectedValueOnce(new Error("mat mang"));
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở Kho cảm xúc" }));
    fireEvent.click(screen.getByRole("button", { name: "Nhớ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(screen.getByRole("alert").textContent).toContain(CHO_THA_TIEP);
    expect(screen.getByRole("button", { name: "Nhớ" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(screen.getByRole("alert").textContent).toContain(CHUA_THA_CAM_XUC);
  });
});

describe("Ben nhan", () => {
  it("dien lan luot hang cho: danh da xem, Chip hoa hinh, cau cua nguoi tha, lop hieu ung xuyen chuot roi tu go", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T02:00:30.000Z") });
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[
      { id: ID1, loai: "yeu", luc: new Date("2026-10-01T02:00:00.000Z") },
      { id: ID2, loai: "gian", luc: new Date("2026-10-01T02:00:10.000Z") },
    ]} />);
    await act(async () => vi.advanceTimersByTime(700));
    expect(actionDaXemCamXuc).toHaveBeenCalledWith(ID1);
    expect(document.querySelector(".linh-vat")?.classList.contains("linh-vat--mang")).toBe(true);
    expect(document.querySelector(".linh-vat__hinh img")?.getAttribute("src")).toBe(CAM_XUC.yeu.anh);
    expect(document.querySelector(".loi-lv__chu")?.textContent).toBe("Mạnh đang cảm thấy yêu bạnGấu bông mang tới, vừa xong");
    const lop = document.querySelector(".hieu-ung");
    expect(lop?.getAttribute("aria-hidden")).toBe("true");
    await act(async () => vi.advanceTimersByTime(500));
    expect(lop?.querySelectorAll(".hv-tim").length).toBeGreaterThan(0);
    await act(async () => vi.advanceTimersByTime(3200));
    expect(document.querySelector(".hieu-ung")).toBeNull();
    // Dong bong bong: cam xuc sau dien tiep.
    fireEvent.click(screen.getByRole("button", { name: "Đóng lời Gấu bông" }));
    await act(async () => vi.advanceTimersByTime(700));
    expect(actionDaXemCamXuc).toHaveBeenLastCalledWith(ID2);
    expect(document.querySelector(".loi-lv__chu")?.textContent).toMatch(/^Mạnh đang giận bạn đó/);
    expect(document.querySelector(".linh-vat")?.classList.contains("linh-vat--vang-gian")).toBe(true);
  });

  it("cam xuc da dien tren trinh duyet nay thi khong dien lai (tai lai trang)", async () => {
    vi.useFakeTimers();
    localStorage.setItem("mqce-cam-xuc-da-dien", JSON.stringify([ID1]));
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[{ id: ID1, loai: "nho", luc: new Date() }]} />);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(actionDaXemCamXuc).not.toHaveBeenCalled();
    expect(document.querySelector(".loi-lv")).toBeNull();
  });

  it("giam chuyen dong: bong bong va hinh moi van hien, khong co lop hieu ung", async () => {
    giamChuyenDong(true);
    vi.useFakeTimers();
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[{ id: ID1, loai: "buon", luc: new Date() }]} />);
    await act(async () => vi.advanceTimersByTime(700));
    expect(document.querySelector(".loi-lv__chu")?.textContent).toMatch(/^Mạnh đang buồn/);
    expect(document.querySelector(".hieu-ung")).toBeNull();
  });

  it("hoi lai hang cho moi 15 giay khi tab dang xem", async () => {
    vi.useFakeTimers();
    actionCamXucChoToi.mockResolvedValue([{ id: ID2, loai: "vui", luc: new Date() }]);
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[]} />);
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(actionCamXucChoToi).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(700));
    expect(actionDaXemCamXuc).toHaveBeenCalledWith(ID2);
  });
});

describe("hieu ung va chu", () => {
  it("moi cam xuc tao hat trong lop; ham don go het va huy hen gio", () => {
    vi.useFakeTimers();
    for (const loai of LOAI_CAM_XUC) {
      const lop = document.createElement("div");
      const don = dienHieuUng(loai, lop, { x: 50, y: 500 }, () => 0.5);
      vi.advanceTimersByTime(1200);
      expect(lop.childElementCount, loai).toBeGreaterThan(0);
      don();
      expect(lop.childElementCount, loai).toBe(0);
      vi.advanceTimersByTime(5000);
      expect(lop.childElementCount, loai).toBe(0);
    }
  });

  it("dong mang toi: vua xong, so phut, roi gio Viet Nam", () => {
    const luc = new Date("2026-10-01T02:00:00.000Z");
    expect(dongMangToi("Cú mèo", luc, new Date("2026-10-01T02:00:59.000Z"))).toBe("Cú mèo mang tới, vừa xong");
    expect(dongMangToi("Cú mèo", luc, new Date("2026-10-01T02:20:00.000Z"))).toBe("Cú mèo mang tới, 20 phút trước");
    expect(dongMangToi("Cú mèo", luc, new Date("2026-10-01T05:00:00.000Z"))).toBe("Cú mèo mang tới lúc hôm nay, 09:00");
  });

  it("anh linh vat co that trong public/, du chin con va tam hat", () => {
    for (const lv of [CHIP, ...LOAI_CAM_XUC.map((l) => CAM_XUC[l])]) {
      expect(readFileSync(`public${lv.anh}`).length, lv.anh).toBeGreaterThan(1000);
      expect(readFileSync(`public${lv.anhTinh}`).length, lv.anhTinh).toBeGreaterThan(500);
    }
    expect(readFileSync("public/linh-vat/LICENSE.txt", "utf8")).toContain("MIT License");
  });

  it("CSS: lop hieu ung xuyen chuot, giam chuyen dong an lop hieu ung, khong tat outline", () => {
    const css = readFileSync("src/styles/linh-vat.css", "utf8");
    expect(css).toMatch(/\.hieu-ung\{[^}]*pointer-events: none/);
    const giam = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(giam).toMatch(/\.hieu-ung\{ display: none; \}/);
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });
});
