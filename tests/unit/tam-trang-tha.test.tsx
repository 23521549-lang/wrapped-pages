// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChoKeSach from "@/app/ke-sach/loading";
import { ThaTamTrang, type DangGiu } from "@/components/tam-trang/ThaTamTrang";
import { CUON_TOI_DA_MS, NHIP_SAU_CUON_MS } from "@/components/tam-trang/cuon-len";
import { TroiTam, useTroiTam } from "@/components/tam-trang/troi-tam";
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
const nutTha = () => screen.getByRole("button", { name: "Thả" }) as HTMLButtonElement;
const oNhan = () => screen.getByLabelText("Lời nhắn") as HTMLInputElement;
const dem = (c: HTMLElement) => c.querySelector(".nhan__dem");

/**
 * Doi chieu DANH TINH (Object.is) cua tung nut DOM, khong phai hinh dang: toEqual cua Vitest so sanh nut DOM bang
 * isEqualNode, tuc mot lan dung lai ca cay voi ma giong het van "bang nhau" - dung no thi bai kiem khong con chung
 * minh duoc dieu can chung minh.
 */
function cungNut(truoc: readonly Element[], sau: readonly Element[], ten: string) {
  expect(sau.length, `${ten}: so nut`).toBe(truoc.length);
  expect(truoc.length, `${ten}: khong tim thay nut nao`).toBeGreaterThan(0);
  truoc.forEach((n, i) => expect(Object.is(n, sau[i]), `${ten} thu ${i} bi thay bang nut khac`).toBe(true));
}

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
    expect(container.querySelector(".ke-dau__nut")?.tagName).toBe("DIV");
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
  it("dung 80 bieu tuong cam xuc: khong bi chan cung, bo dem day, van gui duoc", async () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    expect(oNhan().hasAttribute("maxlength")).toBe(false);
    const hoa = "🌸".repeat(NOTE_MAX);
    fireEvent.change(oNhan(), { target: { value: hoa } });
    expect(oNhan().value.length).toBe(NOTE_MAX * 2);
    expect(dem(container)?.textContent).toBe("80/80");
    expect(dem(container)?.getAttribute("class")).toBe("nhan__dem nhan__dem--day");
    expect(oNhan().getAttribute("aria-invalid")).toBe(null);
    expect(container.querySelector(".nhan__qua")).toBeNull();
    expect(nutTha().disabled).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "Mây nhẹ" }));
    fireEvent.click(nutTha());
    await waitFor(() => expect(actionSetMood).toHaveBeenCalledWith("may-nhe", hoa));
  });

  // Vuot gioi han phai thay duoc NGAY trong luc go, khong doi toi luc bam "Tha": bo dem doi kieu, o nhap thanh
  // aria-invalid, mot dong ly do hien ra, va nut "Tha" bi tat chung nao con vuot.
  it("81 code point: bo dem bao loi, co dong ly do, nut Tha bi tat; xoa bot thi bat lai", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Mây nhẹ" }));
    fireEvent.change(oNhan(), { target: { value: "a".repeat(NOTE_MAX + 1) } });
    expect(dem(container)?.textContent).toBe("81/80");
    expect(dem(container)?.getAttribute("class")).toBe("nhan__dem nhan__dem--day nhan__dem--qua");
    expect(oNhan().getAttribute("aria-invalid")).toBe("true");
    const ly = container.querySelector(".nhan__qua") as HTMLElement;
    expect(ly.textContent).toBe(NHAN_DAI);
    // Ca o nhap va nut "Tha" deu tro toi dong ly do, nen trinh doc man hinh nghe duoc vi sao chua tha duoc.
    expect(oNhan().getAttribute("aria-describedby")?.includes(ly.id)).toBe(true);
    expect(nutTha().getAttribute("aria-describedby")).toBe(ly.id);
    expect(nutTha().disabled).toBe(true);
    fireEvent.click(nutTha());
    expect(actionSetMood).not.toHaveBeenCalled();
    fireEvent.change(oNhan(), { target: { value: "a".repeat(NOTE_MAX) } });
    expect(nutTha().disabled).toBe(false);
    expect(container.querySelector(".nhan__qua")).toBeNull();
    expect(oNhan().getAttribute("aria-invalid")).toBe(null);
  });

  // Nguong tu choi som cua parseMoodInput (320 don vi UTF-16 truoc khi chuan hoa): o giao dien, nguoi dung gap no
  // duoi dang cung mot trang thai vuot gioi han, khong bao gio go xong roi moi bi may chu tu choi.
  it("chuoi rat dai (tren nguong 320 ky tu) cung bi chan ngay o hop chon", () => {
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    fireEvent.change(oNhan(), { target: { value: "a".repeat(NOTE_MAX * 5) } });
    expect(dem(container)?.textContent).toBe("400/80");
    expect(container.querySelector(".nhan__qua")?.textContent).toBe(NHAN_DAI);
    expect(nutTha().disabled).toBe(true);
    fireEvent.click(nutTha());
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
    const o = oNhan();
    const radio = screen.getAllByRole("radio") as HTMLInputElement[];
    radio[4].focus();
    fireEvent.click(radio[4]);
    expect(radio[4].checked).toBe(true);
    expect(document.activeElement).toBe(radio[4]);
    expect(container.querySelector("#tha-tam-trang")).toBe(hop);
    expect(oNhan()).toBe(o);
    cungNut(oTroi, [...container.querySelectorAll(".o")], "nhan o troi");
    cungNut(nen, [...container.querySelectorAll(".o__troi")], "nen o troi");
    cungNut(hoa, [...container.querySelectorAll(".o__troi use")], "bong hoa trong o");
    cungNut(radio, screen.getAllByRole("radio"), "radio");
    expect(actionSetMood).not.toHaveBeenCalled();
  });

  it("doi o chon va go loi nhan: van la nhung nut DOM cu", () => {
    const { container } = ve({ weather: "may-nhe", conLai: "còn 2 giờ" });
    fireEvent.click(nutMo());
    const nen = [...container.querySelectorAll(".o__troi")];
    const hoa = [...container.querySelectorAll(".o__troi use")];
    const giu = container.querySelector(".tha__giu") as HTMLElement;
    const o = oNhan();
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    fireEvent.click(screen.getByRole("radio", { name: "Sương mù" }));
    fireEvent.change(o, { target: { value: "Nhớ cậu" } });
    cungNut(nen, [...container.querySelectorAll(".o__troi")], "nen o troi");
    cungNut(hoa, [...container.querySelectorAll(".o__troi use")], "bong hoa trong o");
    expect(container.querySelector(".tha__giu")).toBe(giu);
    expect(oNhan()).toBe(o);
    expect((screen.getByRole("radio", { name: "Giông" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "Sương mù" }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("ke sach va khung giu cho", () => {
  // Dai troi phai dung NGAY TRUOC .shell chua .ke-dau: quy tac ".troi-dai + .shell .ke-dau" cua tam-trang.css keo dong
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
  it("khung giu cho ke sach co hai cho nut o dong tieu de, cung the voi markup that", () => {
    const { container } = render(<ChoKeSach />);
    const nhom = container.querySelector(".ke-dau .ke-dau__nut") as HTMLElement;
    // Cung the voi nhom nut that cua ThaTamTrang (div), khong thi bo cuc flex ben trong khong giong nhau.
    expect(nhom.tagName).toBe("DIV");
    expect(nhom.querySelectorAll(".vach-cho--nut").length).toBe(2);
  });

  /*
   * Hop Tha tam trang nam giua dau ke va ke sach. Dong no SAU khi may chu tra loi (thuong qua nua giay) la mot lan xo
   * dich ma trinh duyet khong tinh la do nguoi dung bam - CLS do duoc 0,216 toi 0,707 tren dau ke sach, ke ca khi da tat
   * hieu ung. Dong ngay trong luot bam thi lan xo dich do nam trong cua so cu bam va khong bi tinh.
   */
  it("bam Tha thi hop dong NGAY trong luot bam, khong doi may chu tra loi", async () => {
    // May chu chua tra loi trong luc khang dinh. Phai TRA LOI no truoc khi bai ket thuc: React 19 gop moi action bat
    // dong bo dang cho vao mot pham vi chung, nen mot action treo mai se giu transition cua moi bai sau o trang thai
    // dang cho, va cac bai do hong theo mot cach khong lien quan gi toi chung.
    let traLoi!: (r: { ok: true }) => void;
    actionSetMood.mockImplementationOnce(() => new Promise((r) => { traLoi = r; }));
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Mưa phùn" }));
    fireEvent.click(screen.getByRole("button", { name: "Thả" }));
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(nutMo());
    await act(async () => traLoi({ ok: true }));
  });

  it("may chu tu choi sau khi hop da dong: hop mo lai, giu lua chon, bao loi va dua focus toi nut Tha", async () => {
    actionSetMood.mockResolvedValueOnce({ error: "Bạn cần đăng nhập trước." });
    const { container } = ve();
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("radio", { name: "Giông" }));
    fireEvent.change(oNhan(), { target: { value: "Nhớ cậu" } });
    const nutGui = screen.getByRole("button", { name: "Thả" });
    fireEvent.click(nutGui);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Bạn cần đăng nhập trước."));
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(false);
    expect((screen.getByRole("radio", { name: "Giông" }) as HTMLInputElement).checked).toBe(true);
    expect(oNhan().value).toBe("Nhớ cậu");
    // Focus chi toi duoc nut Tha sau khi lan gui xong han: trong luc do nut van bi tat.
    await waitFor(() => expect(document.activeElement).toBe(nutGui));
  });

  it("bam Thu lai thi hop cung dong ngay trong luot bam", async () => {
    let traLoi!: (r: { ok: true }) => void;
    actionWithdrawMood.mockImplementationOnce(() => new Promise((r) => { traLoi = r; }));
    const { container } = ve({ weather: "cau-vong", conLai: "còn 3 giờ" });
    fireEvent.click(nutMo());
    fireEvent.click(screen.getByRole("button", { name: "Thu lại" }));
    expect((container.querySelector("#tha-tam-trang") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(nutMo());
    await act(async () => traLoi({ ok: true }));
  });
});

/** Doc troi tam trong ngu canh, nhu dai troi doc. */
function DoTam() {
  const { tam } = useTroiTam();
  return <output data-testid="tam">{tam === null ? "" : `${tam.weather}|${tam.note ?? ""}|${tam.tha}`}</output>;
}

const veTam = () =>
  render(
    <TroiTam>
      <ThaTamTrang dau={<div><h1>Kệ sách</h1></div>} nutPhu={null} dangGiu={null} tenKia="Linh" />
      <DoTam />
    </TroiTam>,
  );
const tam = () => screen.getByTestId("tam").textContent;

/** Chon mot troi, go loi nhan (neu co) roi bam Tha. */
function thaQuaHop(troi: string, nhan = "") {
  fireEvent.click(nutMo());
  fireEvent.click(screen.getByRole("radio", { name: troi }));
  if (nhan !== "") fireEvent.change(oNhan(), { target: { value: nhan } });
  fireEvent.click(screen.getByRole("button", { name: "Thả" }));
}

/*
 * Spec bo sung B5: bam "Thả" thi trang cuon muot len dai troi, toi noi thi dai troi nhan troi TAM cua lan tha, khong
 * cho may chu. May chu tu choi thi troi tam bi go (chi khi no van la cua lan tha nay), hop mo lai kem cau bao.
 */
describe("ThaTamTrang: troi tam va cuon len dai troi", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("dang o dinh trang: sau mot nhip dai troi nhan troi tam, trong luc may chu chua tra loi", async () => {
    vi.useFakeTimers();
    let traLoi!: (r: { ok: true }) => void;
    actionSetMood.mockImplementationOnce(() => new Promise((r) => { traLoi = r; }));
    veTam();
    thaQuaHop("Giông", "Mưa cả buổi chiều.");
    expect(tam()).toBe("");
    act(() => { vi.advanceTimersByTime(NHIP_SAU_CUON_MS); });
    expect(tam()).toMatch(/^giong\|Mưa cả buổi chiều\.\|Thả lúc [0-9]{2}:[0-9]{2}$/);
    expect(actionSetMood).toHaveBeenCalledWith("giong", "Mưa cả buổi chiều.");
    await act(async () => traLoi({ ok: true }));
  });

  it("dang o duoi trang: cuon muot len dinh truoc, troi tam chi den khi cuon xong", async () => {
    vi.useFakeTimers();
    const cuon = vi.fn();
    vi.stubGlobal("scrollTo", cuon);
    vi.stubGlobal("scrollY", 900);
    let traLoi!: (r: { ok: true }) => void;
    actionSetMood.mockImplementationOnce(() => new Promise((r) => { traLoi = r; }));
    veTam();
    thaQuaHop("Mưa phùn");
    expect(cuon).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    // Focus ve nut mo khong duoc keo trang xuong lai.
    expect(document.activeElement).toBe(nutMo());
    act(() => { vi.advanceTimersByTime(CUON_TOI_DA_MS - 1); });
    expect(tam()).toBe("");
    act(() => {
      globalThis.dispatchEvent(new Event("scrollend"));
      vi.advanceTimersByTime(NHIP_SAU_CUON_MS);
    });
    expect(tam()).toMatch(/^mua-phun\|\|/);
    await act(async () => traLoi({ ok: true }));
  });

  it("may chu tu choi sau khi troi tam da dat: troi tam bi go, hop mo lai kem cau bao", async () => {
    vi.useFakeTimers();
    let traLoi!: (r: { error: string }) => void;
    actionSetMood.mockImplementationOnce(() => new Promise((r) => { traLoi = r; }));
    veTam();
    thaQuaHop("Giông");
    act(() => { vi.advanceTimersByTime(NHIP_SAU_CUON_MS); });
    expect(tam()).toMatch(/^giong/);
    await act(async () => traLoi({ error: "Bạn cần đăng nhập trước." }));
    expect(tam()).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("Bạn cần đăng nhập trước.");
  });

  it("may chu tu choi truoc khi toi dai troi: troi tam khong bao gio duoc dat", async () => {
    vi.useFakeTimers();
    actionSetMood.mockResolvedValueOnce({ error: "Bạn cần đăng nhập trước." });
    veTam();
    thaQuaHop("Giông");
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(NHIP_SAU_CUON_MS * 2); });
    expect(tam()).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("Bạn cần đăng nhập trước.");
  });
});
