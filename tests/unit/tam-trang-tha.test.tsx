// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChoKeSach from "@/app/ke-sach/loading";
import { ThaTamTrang, type DangGiu } from "@/components/tam-trang/ThaTamTrang";
import { CHUA_THA_DUOC } from "@/app/actions/messages";
import { CHON_TROI, NHAN_DAI, NOTE_MAX } from "@/lib/tam-trang/input";

const { actionSetMood, actionWithdrawMood } = vi.hoisted(() => ({
  actionSetMood: vi.fn(async (): Promise<{ error: string } | { ok: true }> => ({ ok: true })),
  actionWithdrawMood: vi.fn(async (): Promise<{ error: string } | { ok: true }> => ({ ok: true })),
}));
vi.mock("@/app/actions/mood", () => ({ actionSetMood, actionWithdrawMood }));

afterEach(() => {
  cleanup();
  actionSetMood.mockClear();
  actionWithdrawMood.mockClear();
});

const ve = (dangGiu: DangGiu | null = null) =>
  render(
    <ThaTamTrang
      dau={<div><h1>Kệ sách</h1></div>}
      nutPhu={<span className="btn btn--quiet">Sách mới</span>}
      dangGiu={dangGiu}
      tenKia="Linh"
    />,
  );

const nutMo = () => screen.getByRole("button", { name: "Thả tâm trạng" });
const oNhan = () => screen.getByLabelText("Lời nhắn") as HTMLInputElement;
const dem = (c: HTMLElement) => c.querySelector(".nhan__dem");

describe("ThaTamTrang: dong tieu de", () => {
  it("nut dung truoc Sach moi, dong san, tro toi hop chon; chua giu gi thi cham vien dut", () => {
    const { container } = ve();
    const nut = nutMo();
    expect(nut.getAttribute("aria-expanded")).toBe("false");
    expect(nut.getAttribute("aria-controls")).toBe("tha-tam-trang");
    expect(nut.nextElementSibling?.textContent).toBe("Sách mới");
    expect(nut.querySelector(".o-mau")?.getAttribute("class")).toBe("o-mau o-mau--trong");
    const hop = container.querySelector("#tha-tam-trang") as HTMLElement;
    expect(hop.hidden).toBe(true);
    expect(container.querySelector(".ke-dau h1")?.textContent).toBe("Kệ sách");
    expect(container.querySelector(".ke-dau__nut")?.children.length).toBe(2);
  });

  it("dang giu thi cham mang mau troi do, hop co dong Ban dang giu", () => {
    const { container } = ve({ weather: "nang-am", conLai: "còn 17 giờ" });
    expect(nutMo().querySelector(".o-mau")?.getAttribute("class")).toBe("o-mau troi--nang-am");
    expect(container.querySelector(".tha__giu")?.textContent).toBe("Bạn đang giữ Nắng ấm, còn 17 giờ.Thu lại");
  });
});

describe("ThaTamTrang: hop chon", () => {
  it("mo ra: cau hoi, chin kieu troi, o nhan co bo dem, loi vao lich hoa", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    expect(nutMo().getAttribute("aria-expanded")).toBe("true");
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(false);
    expect(screen.getByRole("heading", { level: 2, name: "Thả tâm trạng" })).toBeTruthy();
    expect(screen.getByText("Lòng bạn lúc này thế nào?")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "nang-am", "troi-trong", "may-nhe", "gio-thoang", "mua-phun", "mua-rao", "giong", "suong-mu", "cau-vong",
    ]);
    expect(screen.getByRole("radio", { name: "Mưa phùn" })).toBeTruthy();
    expect(dem(container)?.textContent).toBe("0/80");
    fireEvent.change(oNhan(), { target: { value: "Nhớ cậu" } });
    expect(dem(container)?.textContent).toBe("7/80");
    expect(screen.getByText("Không bắt buộc. Linh sẽ thấy dưới bầu trời.")).toBeTruthy();
    expect(screen.getByText("Giữ trong 24 giờ")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Xem lịch hoa" }).getAttribute("href")).toBe("/tam-trang");
  });

  // Bo dem theo code point, va o nhap khong bi chan cung: 80 bieu tuong cam xuc phai go duoc du moi cai chiem hai
  // don vi UTF-16 (maxLength cua trinh duyet dem theo don vi UTF-16 nen se cat con mot nua).
  it("dem theo code point, khong chan cung o nhap, qua 80 thi khong gui", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    expect(oNhan().hasAttribute("maxlength")).toBe(false);
    fireEvent.change(oNhan(), { target: { value: "🌸".repeat(NOTE_MAX) } });
    expect(oNhan().value.length).toBe(NOTE_MAX * 2);
    expect(dem(container)?.textContent).toBe("80/80");
    expect(dem(container)?.getAttribute("class")).toBe("nhan__dem nhan__dem--day");
    expect(oNhan().getAttribute("aria-invalid")).toBe(null);
    fireEvent.change(oNhan(), { target: { value: "a".repeat(NOTE_MAX + 1) } });
    expect(dem(container)?.textContent).toBe("81/80");
    expect(oNhan().getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Mây nhẹ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    expect(screen.getByRole("alert").textContent).toBe(NHAN_DAI);
    expect(actionSetMood).not.toHaveBeenCalled();
  });

  it("chua chon kieu troi ma bam Tha: bao loi, khong goi may chu", () => {
    ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    expect(screen.getByRole("alert").textContent).toBe(CHON_TROI);
    expect(actionSetMood).not.toHaveBeenCalled();
  });

  it("chon, viet, Tha: gui dung, dong hop, bao cho trinh doc man hinh, focus ve nut mo", async () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Mưa phùn" }));
    fireEvent.change(oNhan(), { target: { value: "Nhớ cậu" } });
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await waitFor(() => expect(container.querySelector("[aria-live]")?.textContent).toBe("Đã thả Mưa phùn. Giữ trong 24 giờ."));
    expect(actionSetMood).toHaveBeenCalledWith("mua-phun", "Nhớ cậu");
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(nutMo());
    fireEvent.click(nutMo());
    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect(oNhan().value).toBe("");
  });

  it("loi nhan chi toan dau cach thi gui null, khong gui chuoi rong", async () => {
    ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    fireEvent.change(oNhan(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await waitFor(() => expect(actionSetMood).toHaveBeenCalledWith("giong", null));
  });

  it("may chu bao loi hay action nem loi: giu hop va lua chon, hien cau bao", async () => {
    ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    actionSetMood.mockResolvedValueOnce({ error: "Bạn cần đăng nhập trước." });
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Bạn cần đăng nhập trước."));
    expect((screen.getByRole("radio", { name: "Giông" }) as HTMLInputElement).checked).toBe(true);
    // Doi transition xong han (nut Tha het bi tat) roi moi bam lan hai, khong thi cu bam roi vao nut dang tat.
    await waitFor(() => expect((screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement).disabled).toBe(false));
    actionSetMood.mockRejectedValueOnce(new Error("mat mang"));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(CHUA_THA_DUOC));
  });

  it("Thu lai goi may chu va bao cho trinh doc man hinh", async () => {
    const { container } = ve({ weather: "cau-vong", conLai: "còn 3 giờ" });
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("button", { name: "Thu lại" }));
    await waitFor(() => expect(container.querySelector("[aria-live]")?.textContent).toBe("Đã thu lại tâm trạng."));
    expect(actionWithdrawMood).toHaveBeenCalledTimes(1);
  });

  it("Thoi va phim Esc dong hop, bo lua chon, focus ve nut mo", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Mây nhẹ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thôi" }));
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(nutMo());
    fireEvent.click(nutMo());
    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
    fireEvent.keyDown(oNhan(), { key: "Escape" });
    expect(nutMo().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(nutMo());
  });
});

/*
 * Chon mot o troi phai la mot cai bat/tat trang thai thuan: chu du an da bac mot ban cu vi no nhap nhay. Neu React
 * dung lai cay DOM (thay the, doi khoa, hay dung mot the khac) thi hoat anh cua cac o khoi dong lai va man hinh chop
 * mot cai. Cach kiem chac chan nhat trong may: giu lai CHINH cac nut DOM truoc khi bam roi doi chieu la van dung nut
 * do sau khi bam - nut con nguyen thi khong co lan ve lai nao, khong co hoat anh nao chay lai, khong co xo dich nao.
 */
describe("ThaTamTrang: chon o troi khong dung lai cay DOM", () => {
  it("bam mot o: moi nut van la nut cu, focus o yen, khong goi may chu", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    const hop = container.querySelector("#tha-tam-trang") as HTMLElement;
    const oTroi = [...container.querySelectorAll(".o")];
    const nen = [...container.querySelectorAll(".o__troi")];
    const hoa = [...container.querySelectorAll(".o__troi use")];
    const radio = screen.getAllByRole("radio") as HTMLInputElement[];
    radio[4].focus();
    fireEvent.click(radio[4]);
    expect(radio[4].checked).toBe(true);
    expect(document.activeElement).toBe(radio[4]);
    expect(container.querySelector("#tha-tam-trang")).toBe(hop);
    expect([...container.querySelectorAll(".o")]).toEqual(oTroi);
    expect([...container.querySelectorAll(".o__troi")]).toEqual(nen);
    expect([...container.querySelectorAll(".o__troi use")]).toEqual(hoa);
    expect(screen.getAllByRole("radio")).toEqual(radio);
    expect(actionSetMood).not.toHaveBeenCalled();
  });

  it("doi o chon va go loi nhan: van la nhung nut DOM cu", () => {
    const { container } = ve({ weather: "may-nhe", conLai: "còn 2 giờ" });
    fireEvent.click(nutMo());
    const nen = [...container.querySelectorAll(".o__troi")];
    const o = oNhan();
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    fireEvent.click(screen.getByRole("radio", { name: "Sương mù" }));
    fireEvent.change(o, { target: { value: "Nhớ cậu" } });
    expect([...container.querySelectorAll(".o__troi")]).toEqual(nen);
    expect(oNhan()).toBe(o);
    expect((screen.getByRole("radio", { name: "Giông" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "Sương mù" }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("ke sach va khung giu cho", () => {
  // Dai troi phai dung NGAY TRUOC .shell chua .ke-dau: quy tac ".troi + .shell .ke-dau" cua tam-trang.css keo dong
  // tieu de len sat bau troi, va no chi cham toi phan tu nao khi hai the nay la anh em ke nhau.
  it("dai troi dung ngay truoc khoi .shell cua ke sach", () => {
    const src = readFileSync("src/app/ke-sach/page.tsx", "utf8");
    expect(src.includes("<HoaDefs />")).toBe(true);
    const dau = src.indexOf("<BauTroi");
    expect(dau).toBeGreaterThan(-1);
    const sau = src.slice(src.indexOf("/>", dau) + 2).trimStart();
    expect(sau.startsWith(`<div className="shell">`)).toBe(true);
  });

  // Hang tieu de ke sach tu mot nut thanh hai; khung giu cho phai co du hai cho, khong thi bo cuc nhay luc tai xong.
  it("khung giu cho ke sach co hai cho nut o dong tieu de", () => {
    const { container } = render(<ChoKeSach />);
    expect(container.querySelectorAll(".ke-dau .ke-dau__nut .vach-cho--nut").length).toBe(2);
  });
});
