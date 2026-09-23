// @vitest-environment jsdom
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { actionSubmitRoundReply } from "@/app/actions/round-reply";
import { RoundReplyPanel, type RoundReplyPanelProps } from "@/components/reader/RoundReplyPanel";
import { ShownSheetsProvider, useShownSheets, type Shown } from "@/components/reader/ShownSheets";
import type { ReplyRound } from "@/lib/round-reply";

vi.mock("@/app/actions/round-reply", () => ({ actionSubmitRoundReply: vi.fn() }));

/** 08:00 ngay 22.09 gio Viet Nam. */
const NOW = new Date("2026-09-22T01:00:00.000Z");
/** 21:02 ngay 21.09 gio Viet Nam. */
const HOM_QUA = new Date("2026-09-21T14:02:00.000Z");
const LF = String.fromCharCode(10);

const L1: ReplyRound = { id: "l1", first: 1, last: 2, sealed: false, reply: null };
const L2: ReplyRound = { id: "l2", first: 3, last: 3, sealed: false, reply: null };

let dat: (s: Shown) => void = () => {};
/** Dieu khien gia cua cot sach: ghi to dang hien vao provider nhu Reader. */
function CotSach() {
  const { setShown } = useShownSheets(0);
  useEffect(() => {
    dat = setShown;
  }, [setShown]);
  return null;
}

function ve(p: Partial<RoundReplyPanelProps> = {}) {
  const props: RoundReplyPanelProps = { rounds: [L1, L2], mine: false, replierName: "Linh", now: NOW, ...p };
  const kq = render(<ShownSheetsProvider start={0}><CotSach /><RoundReplyPanel {...props} /></ShownSheetsProvider>);
  return {
    ...kq,
    veLai: (q: Partial<RoundReplyPanelProps>) =>
      kq.rerender(<ShownSheetsProvider start={0}><CotSach /><RoundReplyPanel {...props} {...q} /></ShownSheetsProvider>),
  };
}

const khung = () => screen.getByRole("region", { name: "Lời hồi đáp" });
const o = () => within(khung()).getByLabelText("Viết lời hồi đáp") as HTMLTextAreaElement;
const nut = (ten: string) => within(khung()).getByRole("button", { name: ten });
const hoi = () => within(khung()).queryByRole("group", { name: "Xác nhận gửi lời hồi đáp" });
const go = (chu: string) => fireEvent.change(o(), { target: { value: chu } });
const baoChu = () => khung().querySelector(".hoi-dap__bao")?.textContent;

beforeEach(() => {
  vi.mocked(actionSubmitRoundReply).mockReset();
});

afterEach(cleanup);

describe("RoundReplyPanel: nguoi doc", () => {
  it("luot chua co loi: tieu de, khoang trang cua luot, o chu co nhan, bo dem dem chu da chuan hoa", () => {
    ve();
    expect(within(khung()).getByRole("heading", { level: 2, name: "Lời hồi đáp" })).toBeTruthy();
    expect(within(khung()).getByText("Dành cho trang 1 tới 2")).toBeTruthy();
    expect(within(khung()).getByText("0/1000")).toBeTruthy();
    go(`  thuong ghe  ${LF}${LF}${LF}${LF}`);
    expect(within(khung()).getByText("10/1000")).toBeTruthy();
    expect(o().getAttribute("aria-describedby")).toBe(within(khung()).getByText("10/1000").id);
  });

  it("gui khi trong: nhac nhe, khong hoi lai, khong goi action, focus ve o chu", () => {
    ve();
    go(`   ${LF}  `);
    fireEvent.click(nut("Gửi"));
    expect(within(khung()).getByRole("alert").textContent).toBe("Viết vài chữ rồi hãy gửi nhé.");
    expect(hoi()).toBeNull();
    expect(document.activeElement).toBe(o());
    expect(actionSubmitRoundReply).not.toHaveBeenCalled();
  });

  it("vuot 1000 ky tu: bo dem dam, gui thi nhac bot, khong hoi lai", () => {
    ve();
    go("a".repeat(1001));
    expect(within(khung()).getByText("1001/1000").className).toContain("hoi-dap__dem--tran");
    fireEvent.click(nut("Gửi"));
    expect(within(khung()).getByRole("alert").textContent).toBe("Dài quá 1000 ký tự rồi, bớt một chút nhé.");
    expect(hoi()).toBeNull();
  });

  it("gui thi hoi lai ngay trong khung, focus o Xem lai, o chu chi doc; Esc hay Xem lai tra focus ve o chu", () => {
    ve();
    go("Thương ghê.");
    fireEvent.click(nut("Gửi"));
    expect(within(hoi()!).getByText("Gửi rồi sẽ không sửa được.")).toBeTruthy();
    expect(document.activeElement).toBe(within(hoi()!).getByRole("button", { name: "Xem lại" }));
    expect(o().readOnly).toBe(true);
    fireEvent.keyDown(within(hoi()!).getByRole("button", { name: "Xem lại" }), { key: "Escape" });
    expect(hoi()).toBeNull();
    expect(document.activeElement).toBe(o());
    expect(o().readOnly).toBe(false);
    fireEvent.click(nut("Gửi"));
    fireEvent.click(within(hoi()!).getByRole("button", { name: "Xem lại" }));
    expect(hoi()).toBeNull();
    expect(document.activeElement).toBe(o());
    expect(actionSubmitRoundReply).not.toHaveBeenCalled();
  });

  it("gui duoc: goi action voi dung luot va chu, lam moi xong thi hien loi cua minh, focus toi do, bao cho trinh doc", async () => {
    vi.mocked(actionSubmitRoundReply).mockResolvedValue({ ok: true });
    const { veLai } = ve();
    go(`Thương ghê.${LF}${LF}Cảm ơn nhé.`);
    fireEvent.click(nut("Gửi"));
    await act(async () => {
      fireEvent.click(within(hoi()!).getByRole("button", { name: "Gửi" }));
    });
    expect(actionSubmitRoundReply).toHaveBeenCalledWith("l1", `Thương ghê.${LF}${LF}Cảm ơn nhé.`);
    veLai({ rounds: [{ ...L1, reply: { body: `Thương ghê.${LF}${LF}Cảm ơn nhé.`, at: NOW } }, L2] });
    expect(within(khung()).queryByLabelText("Viết lời hồi đáp")).toBeNull();
    const loi = khung().querySelector(".hoi-dap__loi");
    expect(loi?.querySelector(".hoi-dap__chu")?.textContent).toBe(`Thương ghê.${LF}${LF}Cảm ơn nhé.`);
    expect(loi?.querySelector("figcaption")?.textContent).toBe("Bạn gửi hôm nay, 08:00");
    expect(document.activeElement).toBe(loi);
    expect(baoChu()).toBe("Đã gửi lời hồi đáp.");
    // Lat sang luot khac: cau bao cua luot truoc phai tat, khong thi trinh doc man hinh doc lai no o luot moi.
    act(() => dat({ first: 3, last: 3 }));
    expect(baoChu()).toBe("");
    // Lat quay lai luot vua gui: cau bao da bi bo han, khong doc lai lan nua.
    act(() => dat({ first: 1, last: 2 }));
    expect(baoChu()).toBe("");
  });

  it("bam doi hay Enter hai lan tren nut Gui cua hop hoi lai: chi mot lan gui", async () => {
    vi.mocked(actionSubmitRoundReply).mockResolvedValue({ ok: true });
    ve();
    go("Thương ghê.");
    fireEvent.click(nut("Gửi"));
    const guiThat = within(hoi()!).getByRole("button", { name: "Gửi" });
    // Hai lan bam lien nhau, truoc khi lan ve voi pending kip hien len: nut chua kip mo ma van khong duoc gui hai lan.
    await act(async () => {
      fireEvent.click(guiThat);
      fireEvent.click(guiThat);
    });
    expect(actionSubmitRoundReply).toHaveBeenCalledTimes(1);
  });

  it("may chu tu choi hay mat mang: bao loi, dong hop hoi, giu nguyen chu", async () => {
    vi.mocked(actionSubmitRoundReply).mockResolvedValueOnce({ error: "Lượt này đã có lời hồi đáp rồi." });
    ve();
    go("Thương ghê.");
    fireEvent.click(nut("Gửi"));
    await act(async () => {
      fireEvent.click(within(hoi()!).getByRole("button", { name: "Gửi" }));
    });
    expect(within(khung()).getByRole("alert").textContent).toBe("Lượt này đã có lời hồi đáp rồi.");
    expect(hoi()).toBeNull();
    expect(o().value).toBe("Thương ghê.");
    vi.mocked(actionSubmitRoundReply).mockRejectedValueOnce(new Error("mat mang"));
    fireEvent.click(nut("Gửi"));
    await act(async () => {
      fireEvent.click(within(hoi()!).getByRole("button", { name: "Gửi" }));
    });
    expect(within(khung()).getByRole("alert").textContent).toBe("Chưa gửi được, thử lại nhé.");
    expect(o().value).toBe("Thương ghê.");
    // Lat di roi lat ve: loi cu khong con, chu dang go thi con. role="alert" doc lai la lan bao thu hai cho mot lan hong.
    act(() => dat({ first: 3, last: 3 }));
    act(() => dat({ first: 1, last: 2 }));
    expect(within(khung()).queryByRole("alert")).toBeNull();
    expect(o().value).toBe("Thương ghê.");
  });

  it("luot con niem phong: chi mot dong nhac, khong o chu", () => {
    ve({ rounds: [{ ...L1, sealed: true }, L2] });
    expect(within(khung()).getByText("Mở niêm phong để hồi đáp.")).toBeTruthy();
    expect(within(khung()).queryByLabelText("Viết lời hồi đáp")).toBeNull();
  });

  it("theo luot cua to dang hien: doi luot thi o chu cua luot do, chu dang go cua luot cu duoc giu; hai trang thi theo trang phai", () => {
    ve();
    go("Nháp lượt một");
    act(() => dat({ first: 3, last: 3 }));
    expect(within(khung()).getByText("Dành cho trang 3")).toBeTruthy();
    expect(o().value).toBe("");
    act(() => dat({ first: 1, last: 2 }));
    expect(o().value).toBe("Nháp lượt một");
    act(() => dat({ first: 2, last: 3 }));
    expect(within(khung()).getByText("Dành cho trang 3")).toBeTruthy();
  });

  it("to dang hien khong thuoc luot nao: khong ve gi", () => {
    const { container } = ve({ rounds: [] });
    expect(container.querySelector(".hoi-dap")).toBeNull();
  });
});

describe("RoundReplyPanel: nguoi viet", () => {
  it("chua co loi: mot dong chu, khong o chu", () => {
    ve({ mine: true });
    expect(within(khung()).getByText("Chưa có lời hồi đáp.")).toBeTruthy();
    expect(within(khung()).queryByLabelText("Viết lời hồi đáp")).toBeNull();
    expect(within(khung()).queryByRole("button")).toBeNull();
  });

  it("co loi: loi cua nguoi doc kem ten va gio gui", () => {
    ve({ mine: true, rounds: [{ ...L1, reply: { body: "Thương ghê.", at: HOM_QUA } }, L2] });
    const loi = khung().querySelector(".hoi-dap__loi");
    expect(loi?.querySelector(".hoi-dap__chu")?.textContent).toBe("Thương ghê.");
    expect(loi?.querySelector("figcaption")?.textContent).toBe("Linh gửi hôm qua, 21:02");
    expect(loi?.querySelector("time")?.getAttribute("dateTime")).toBe(HOM_QUA.toISOString());
  });
});
