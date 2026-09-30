import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LinhVat } from "@/components/linh-vat/LinhVat";
import { dienHieuUng } from "@/components/linh-vat/hieu-ung";
import { CAM_XUC, CHIP, dongMangToi, LOAI_CAM_XUC } from "@/lib/cam-xuc";
import { CHO_CHIP_TRA_LOI, CHO_THA_TIEP, CHUA_THA_CAM_XUC } from "@/app/actions/messages";
import type { TrangThaiChip } from "@/server/chip/tro-chuyen";

/*
 * Chip, to tro chuyen va Kho cam xuc (5d, 5e): bam Chip mo to tro chuyen (Esc tra focus), kho trong to, chon mot cam xuc
 * thi cau xem truoc doi, Tha goi action, loi hien trong kho; hoi Chip thi tin hien, dang go, Chip ngu thi o nhap tat; ben
 * nhan dien lan luot hang cho (goi da xem, moi cam xuc mot lan tren trinh duyet), lop hieu ung xuyen chuot chi co luc dang
 * dien, giam chuyen dong thi khong co lop hieu ung; Chip tu chao, thu nho, tat.
 */

const { actionThaCamXuc, actionCamXucChoToi, actionDaXemCamXuc, actionChaoChip, actionDocChip, actionHoiChip } = vi.hoisted(() => ({
  actionThaCamXuc: vi.fn(),
  actionCamXucChoToi: vi.fn(),
  actionDaXemCamXuc: vi.fn(),
  actionChaoChip: vi.fn(),
  actionDocChip: vi.fn(),
  actionHoiChip: vi.fn(),
}));
vi.mock("@/app/actions/cam-xuc", () => ({ actionThaCamXuc, actionCamXucChoToi, actionDaXemCamXuc }));
vi.mock("@/app/actions/chip", () => ({ actionChaoChip, actionDocChip, actionHoiChip }));

const THUC: TrangThaiChip = { an: false, tuNoi: true, nguDen: null, coKhoa: true };

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
  actionChaoChip.mockResolvedValue(null);
  actionDocChip.mockResolvedValue({ tin: [], trangThai: THUC });
});

/** Mo to tro chuyen roi mo Kho cam xuc trong to. */
async function moKho() {
  fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
  await doi();
  fireEvent.click(screen.getByRole("button", { name: /^Thả cảm xúc cho / }));
}

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

describe("To tro chuyen va Kho cam xuc", () => {
  it("bam Chip mo to tro chuyen: focus o nhap; Esc dong va tra focus ve Chip", async () => {
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    const chip = screen.getByRole("button", { name: "Chíp, mở trò chuyện" });
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip);
    await doi();
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const to = screen.getByRole("region", { name: "Chíp" });
    expect(to.textContent).toContain("Đang thức");
    expect(to.textContent).toContain("Chào Mạnh! Chíp đây.");
    expect(document.activeElement).toBe(screen.getByLabelText("Nói với Chíp"));
    fireEvent.keyDown(screen.getByLabelText("Nói với Chíp"), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Chíp" })).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it("kho trong to: tam cam xuc, chua chon thi Tha tat; chon thi nut nhan, anh dong, cau xem truoc", async () => {
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await moKho();
    expect(screen.getByText("Mỗi cảm xúc có một bạn nhỏ mang tới Linh.")).toBeTruthy();
    const nut = LOAI_CAM_XUC.map((l) => screen.getByRole("button", { name: CAM_XUC[l].camXuc }));
    expect(nut).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement).disabled).toBe(true);
    const yeu = screen.getByRole("button", { name: "Yêu" });
    expect(yeu.querySelector("img")?.getAttribute("src")).toBe(CAM_XUC.yeu.anhTinh);
    fireEvent.click(yeu);
    expect(yeu.getAttribute("aria-pressed")).toBe("true");
    expect(yeu.querySelector("img")?.getAttribute("src")).toBe(CAM_XUC.yeu.anh);
    expect(yeu.querySelector("source")?.getAttribute("srcset")).toBe(CAM_XUC.yeu.anhTinh);
    expect(screen.getByText(/sẽ nói với Linh/).textContent).toBe("Gấu bông sẽ nói với Linh: Mạnh đang cảm thấy yêu bạn");
    expect((screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Tha: goi action, dong to, Chip hoa hinh va noi da mang di; khong co lop hieu ung ben nguoi tha", async () => {
    actionThaCamXuc.mockResolvedValue({ ok: true });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await moKho();
    fireEvent.click(screen.getByRole("button", { name: "Trêu" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(actionThaCamXuc).toHaveBeenCalledWith("treu");
    expect(screen.queryByRole("region", { name: "Chíp" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    expect(document.querySelector(".loi-lv__chu")?.textContent).toBe("Khỉ con đang mang Trêu tới Linh.Linh không mở web lúc này thì lần sau vào sẽ thấy.");
    expect(document.querySelector(".linh-vat__hinh img")?.getAttribute("src")).toBe(CAM_XUC.treu.anh);
    expect(document.querySelector(".hieu-ung")).toBeNull();
  });

  it("loi cua action va mat mang: hien trong kho, lua chon giu nguyen", async () => {
    actionThaCamXuc.mockResolvedValueOnce({ error: CHO_THA_TIEP }).mockRejectedValueOnce(new Error("mat mang"));
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await moKho();
    fireEvent.click(screen.getByRole("button", { name: "Nhớ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(screen.getByRole("alert").textContent).toContain(CHO_THA_TIEP);
    expect(screen.getByRole("button", { name: "Nhớ" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await doi();
    expect(screen.getByRole("alert").textContent).toContain(CHUA_THA_CAM_XUC);
  });

  it("hoi Chip: tin cua minh hien ngay, dang go, roi tin Chip (chu dam); gui kem ten trang va viec gan day", async () => {
    sessionStorage.setItem("mqce-chip-viec", JSON.stringify(["09:00 mở Kệ sách"]));
    let traLoi: (v: unknown) => void = () => {};
    actionHoiChip.mockReturnValue(new Promise((ok) => { traLoi = ok; }));
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    await doi();
    const o = screen.getByLabelText("Nói với Chíp");
    fireEvent.change(o, { target: { value: "Linh viết gì mới không?" } });
    fireEvent.keyDown(o, { key: "Enter" });
    await doi();
    expect(actionHoiChip).toHaveBeenCalledWith("Linh viết gì mới không?", expect.any(String), ["09:00 mở Kệ sách"]);
    expect(document.querySelector(".tin--minh")?.textContent).toContain("Linh viết gì mới không?");
    expect(screen.getByText("Chíp đang gõ")).toBeTruthy();
    const luc = new Date();
    await act(async () => traLoi({ tin: [
      { id: "a", vai: "nguoi", noiDung: "Linh viết gì mới không?", luc },
      { id: "b", vai: "chip", noiDung: "Linh vừa viết **Mưa phùn** đó.", luc },
    ], nguDen: null }));
    expect(screen.queryByText("Chíp đang gõ")).toBeNull();
    expect(document.querySelectorAll(".tin--minh")).toHaveLength(1);
    expect([...document.querySelectorAll(".tin--chip b")].map((b) => b.textContent)).toEqual(["Mưa phùn"]);
    expect((o as HTMLTextAreaElement).value).toBe("");
  });

  it("loi khi hoi: tin tra lai o nhap, cau loi hien", async () => {
    actionHoiChip.mockResolvedValue({ error: CHO_CHIP_TRA_LOI });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    await doi();
    const o = screen.getByLabelText("Nói với Chíp") as HTMLTextAreaElement;
    fireEvent.change(o, { target: { value: "Chíp ơi" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    await doi();
    expect(screen.getByRole("alert").textContent).toBe(CHO_CHIP_TRA_LOI);
    expect(o.value).toBe("Chíp ơi");
    expect(document.querySelectorAll(".tin--minh")).toHaveLength(0);
  });

  it("Chip ngu: khung tinh kem zzz, o nhap tat, kho van dung duoc; chua co khoa thi bao chua danh thuc", async () => {
    const mai = new Date(Date.now() + 3_600_000);
    actionDocChip.mockResolvedValue({ tin: [], trangThai: { ...THUC, nguDen: mai } });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={{ ...THUC, nguDen: mai }} />);
    expect(document.querySelector(".linh-vat__ngu")).toBeTruthy();
    expect(document.querySelector(".linh-vat__hinh img")?.getAttribute("src")).toBe(CHIP.anhTinh);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    await doi();
    expect((screen.getByLabelText("Nói với Chíp") as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText("Chíp đang ngủ nên chưa trả lời được. Thả cảm xúc vẫn được.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Thả cảm xúc cho / }));
    cleanup();
    actionDocChip.mockResolvedValue({ tin: [], trangThai: { ...THUC, coKhoa: false } });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={{ ...THUC, coKhoa: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    await doi();
    expect(screen.getByRole("region", { name: "Chíp" }).textContent).toContain("Chưa được đánh thức");
  });
});

describe("Chip tu chao, thu nho, tat", () => {
  it("chao khi vao: bong bong co chu dam, nut Xem ngay va Noi chuyen; lan tai trang sau trong 10 phut thi im", async () => {
    actionChaoChip.mockResolvedValue({ loai: "chao", cau: "Chào **Mạnh**! Linh viết lượt **Mưa phùn** đó.", nut: { nhan: "Xem ngay", href: "/sach/x" } });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await doi();
    expect(document.querySelector(".loi-lv--chao .loi-lv__chu")?.textContent).toBe("Chào Mạnh! Linh viết lượt Mưa phùn đó.");
    expect([...document.querySelectorAll(".loi-lv--chao b")].map((b) => b.textContent)).toEqual(["Mạnh", "Mưa phùn"]);
    expect(screen.getByRole("link", { name: "Xem ngay" }).getAttribute("href")).toBe("/sach/x");
    fireEvent.click(screen.getByRole("button", { name: "Nói chuyện với Chíp" }));
    await doi();
    expect(screen.getByRole("region", { name: "Chíp" })).toBeTruthy();
    cleanup();
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await doi();
    expect(document.querySelector(".loi-lv--chao")).toBeNull();
  });

  it("thu nho: nut trong to thu Chip lai, nho theo trinh duyet; bam la hien lai; thu nho thi khong tu chao", async () => {
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    fireEvent.click(screen.getByRole("button", { name: "Chíp, mở trò chuyện" }));
    await doi();
    fireEvent.click(screen.getByRole("button", { name: "Thu nhỏ Chíp" }));
    expect(document.querySelector(".linh-vat")?.classList.contains("linh-vat--thu-nho")).toBe(true);
    expect(localStorage.getItem("mqce-chip-thu-nho")).toBe("true");
    cleanup();
    actionChaoChip.mockResolvedValue({ loai: "chao", cau: "Chào **Mạnh**!", nut: null });
    render(<LinhVat tenMinh="Mạnh" tenKia="Linh" hangDau={[]} trangThai={THUC} />);
    await doi();
    expect(document.querySelector(".loi-lv--chao")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chíp đang thu nhỏ, bấm để hiện lại" }));
    expect(document.querySelector(".linh-vat")?.classList.contains("linh-vat--thu-nho")).toBe(false);
    expect(localStorage.getItem("mqce-chip-thu-nho")).toBe("false");
  });

  it("tat Chip: khong ngoi goc; cam xuc toi van duoc ban cam xuc mang toi", async () => {
    vi.useFakeTimers();
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[{ id: ID1, loai: "vui", luc: new Date() }]} trangThai={{ ...THUC, an: true }} />);
    expect(document.querySelector(".linh-vat__nut")).toBeNull();
    await act(async () => vi.advanceTimersByTime(700));
    expect(document.querySelector(".linh-vat__hinh img")?.getAttribute("src")).toBe(CAM_XUC.vui.anh);
    expect(document.querySelector(".loi-lv__chu")?.textContent).toMatch(/^Mạnh đang vui lắm/);
  });
});

describe("Ben nhan", () => {
  it("dien lan luot hang cho: danh da xem, Chip hoa hinh, cau cua nguoi tha, lop hieu ung xuyen chuot roi tu go", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T02:00:30.000Z") });
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[
      { id: ID1, loai: "yeu", luc: new Date("2026-10-01T02:00:00.000Z") },
      { id: ID2, loai: "gian", luc: new Date("2026-10-01T02:00:10.000Z") },
    ]} trangThai={THUC} />);
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
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[{ id: ID1, loai: "nho", luc: new Date() }]} trangThai={THUC} />);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(actionDaXemCamXuc).not.toHaveBeenCalled();
    expect(document.querySelector(".loi-lv")).toBeNull();
  });

  it("giam chuyen dong: bong bong va hinh moi van hien, khong co lop hieu ung", async () => {
    giamChuyenDong(true);
    vi.useFakeTimers();
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[{ id: ID1, loai: "buon", luc: new Date() }]} trangThai={THUC} />);
    await act(async () => vi.advanceTimersByTime(700));
    expect(document.querySelector(".loi-lv__chu")?.textContent).toMatch(/^Mạnh đang buồn/);
    expect(document.querySelector(".hieu-ung")).toBeNull();
  });

  it("hoi lai hang cho moi 15 giay khi tab dang xem", async () => {
    vi.useFakeTimers();
    actionCamXucChoToi.mockResolvedValue([{ id: ID2, loai: "vui", luc: new Date() }]);
    render(<LinhVat tenMinh="Linh" tenKia="Mạnh" hangDau={[]} trangThai={THUC} />);
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
