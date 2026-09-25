// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { useEffect, useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BauTroi } from "@/components/tam-trang/BauTroi";
import { dongChu, soHoatDangGiu } from "@/components/tam-trang/hieu-ung-chung";
import { doHinh } from "@/components/tam-trang/song";
import { NOTE_MAX } from "@/lib/tam-trang/input";
import type { TroiHien } from "@/lib/tam-trang/lich";
import { netTroi } from "@/lib/tam-trang/net-troi";
import { LOANG_HET_MS, NEN_MS, NEN_TRE_MS } from "@/lib/tam-trang/loang-nhip";
import { CHU_MS, SONG_HET, SONG_MS } from "@/lib/tam-trang/song-nhip";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";
import { boComment, THU_MUC_CSS } from "../helpers/bang-token";
import { dungCoHop, lopLoang } from "../helpers/co-hop";

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

/*
 * Co hop gia cho ca tep: jsdom tra 0 cho moi clientWidth/clientHeight, ma loangTroi bo qua han lan loang khi khung do
 * duoc 0 - bai kiem nao quen se do y het nhau truoc va sau khi code duoc viet (phan quyet M3). Dung ham chung chu
 * khong chep mot ban vao day, va ham chung tu tra lai nguyen trang sau moi bai.
 */
dungCoHop(1000, 400);

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
    // Do TRONG the .troi that: khuon giu cho cung mang du nhung lop nay (chin ban tho an), nen do tren ca container
    // la do nham khuon ngay khi ai do doi thu tu hai thu trong dai troi.
    const tho = vung.querySelector(".troi__tho");
    expect([...(tho?.querySelectorAll(".troi__cau") ?? [])].map((c) => c.textContent)).toEqual(["Tùy phong tiềm nhập dạ", "Nhuận vật tế vô thanh"]);
    expect(tho?.classList.contains("d")).toBe(true);
    expect(tho?.textContent).not.toContain("Linh");
    expect(vung.querySelector(".troi__giai")?.textContent).toBe(TROI["mua-phun"].giai);
    expect(vung.querySelector(".troi__nguon")?.textContent).toBe("Đỗ Phủ, Xuân dạ hỉ vũ");
    expect(vung.querySelector(".troi__nhan")?.textContent).toBe("Nhớ cậu một chút thôi.");
    expect(vung.querySelector(".troi__gio")?.textContent).toBe("Thả lúc 21:40");
    expect(vung.querySelector(".troi__noi .sr-only")?.textContent).toBe("Linh: Mưa phùn.");
    // Troi cua nguoi kia khong mang nhan "Ban"; khuon thi luon mang, vi no phai giu cho cho ca hai mat (phat hien N6).
    expect(vung.querySelector(".troi__ai")).toBeNull();
    expect(container.querySelector(".troi-dai__khuon .troi__ai")?.textContent).toBe("Bạn");
    const lien = screen.getByRole("link", { name: "Xem lịch hoa" });
    expect(lien.getAttribute("href")).toBe("/tam-trang");
    expect(lien.querySelector("svg.hoa use")?.getAttribute("href")).toBe("#hoa-hue-mua");
    expect(container.querySelector(".cua-so")).toBeNull();
    expect(container.querySelector(".troi-cua-so")).toBeNull();
  });

  it("chi chinh minh: troi lon mang nhan Ban, CO loi vao lich hoa, khong o cua so; tho Nom khong co giai nghia", () => {
    const { container } = ve(null, MINH);
    const vung = screen.getByRole("region", { name: "Tâm trạng của bạn" });
    expect(vung.className).toBe("troi troi--nang-am");
    expect(vung.querySelector(".troi__ai")?.textContent).toBe("Bạn");
    expect(vung.querySelector(".troi__noi .sr-only")?.textContent).toBe("Bạn: Nắng ấm.");
    // Do TRONG the .troi that chu khong tren ca container: khuon giu cho co du ba dong giai nghia cua tho Han Viet va
    // ca chin loi nhan, nen do tren container la do nham khuon. Hai dong cuoi chung minh bo chon van tim thay that -
    // khong phai mot bo chon khong con ton tai, tra ve null vi ly do sai.
    expect(vung.querySelector(".troi__giai")).toBeNull();
    expect(vung.querySelector(".troi__nhan")).toBeNull();
    expect(container.querySelectorAll(".troi-dai__khuon .troi__giai")).toHaveLength(WEATHERS.filter((w) => TROI[w].giai !== null).length);
    expect(container.querySelectorAll(".troi-dai__khuon .troi__nhan")).toHaveLength(WEATHERS.length);
    // Spec muc 5 ("Bo dieu kien !m.laMinh ... de lien ket 'Xem lich hoa' hien ca khi nguoi xem dang nhin troi cua
    // chinh minh") va yeu cau diem 3: nhan khong doi theo chu troi, bong hoa mang mau troi dang hien. Lich hoa la cua
    // ca hai nguoi nen khong co ly do doi chu hay giau di. Bai nay truoc day khang dinh dieu nguoc lai.
    const lien = screen.getByRole("link", { name: "Xem lịch hoa" });
    expect(lien.getAttribute("href")).toBe("/tam-trang");
    expect(lien.querySelector("svg.hoa use")?.getAttribute("href")).toBe("#hoa-cuc");
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

  /*
   * Khuon giu cho, phan quyet M4: DUNG MOT ban cho ca dai troi, khong phai moi bau troi mot ban. Ve trong tung MotTroi
   * se thanh 18 ban tho an luc nghi va 27 luc loang, va no day khoang trong vao GIUA bai tho voi hang cuoi - dung cho
   * chu du an da bac hai lan. O muc dai troi thi phan cao them roi xuong day bau troi, bo cuc ben trong khong doi.
   */
  it("khuon giu cho: dung mot ban cho ca dai troi, chin ban tho chong nhau, an voi mat va voi trinh doc man hinh", () => {
    const { container } = ve(KIA, null);
    expect(container.querySelectorAll(".troi-dai__khuon")).toHaveLength(1);
    const khuon = container.querySelector(".troi-dai__khuon") as HTMLElement;
    expect(khuon.getAttribute("aria-hidden")).toBe("true");
    expect(khuon.hasAttribute("inert")).toBe(true);
    // Khong mot the bam duoc nao trong khuon: no ra khoi luot Tab ke ca khi mot trinh duyet chua hieu inert.
    expect(khuon.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();

    const chong = khuon.querySelector(".troi-dai__chong") as HTMLElement;
    expect(chong.children).toHaveLength(WEATHERS.length);
    const banMuaPhun = chong.children[WEATHERS.indexOf("mua-phun")];
    expect(banMuaPhun.querySelector(".troi__giai")?.textContent).toBe(TROI["mua-phun"].giai);
    expect(banMuaPhun.querySelectorAll(".troi__nhan")).toHaveLength(1);
    // Phan quyet M5: NOTE_MAX dem code point chu khong dem be rong, nen mot cau tieng Viet dai 80 chu khong chan duoc
    // chieu cao. Loi nhan cua khuon phai la NOTE_MAX glyph rong nhat (bong hoa mau, moi cai mot o chu) moi la can tren.
    const nhan = [...(banMuaPhun.querySelector(".troi__nhan")?.textContent ?? "")];
    expect(nhan).toHaveLength(NOTE_MAX);
    expect(new Set(nhan).size).toBe(1);
    expect(nhan[0].codePointAt(0)).toBeGreaterThan(0xffff);
  });

  /*
   * Phep chung minh cua ca task: dai troi la mot o luoi, nen no chi cao bang phan tu cao nhat trong o. Chieu cao do
   * khong doi khi thay tam trang DUNG KHI khuon co du moi dong ma mot bau troi co the ve ra, cho ca chin kieu troi.
   * Bau troi cao nhat cua mot kieu troi la troi cua chinh nguoi xem (co them hang "Ban") va co loi nhan.
   */
  it.each(WEATHERS)("%s: khuon co du moi dong cua bau troi cao nhat, dung thu tu tren duoi", (w) => {
    const { container } = ve(null, { ...MINH, weather: w, note: "Nhớ cậu." });
    const sec = container.querySelector("section.troi") as HTMLElement;
    const khuon = container.querySelector(".troi-dai__khuon") as HTMLElement;
    const ban = khuon.querySelector(".troi-dai__chong")?.children[WEATHERS.indexOf(w)];
    const dongKhuon = [...khuon.querySelectorAll<HTMLElement>(".troi__noi > *")].flatMap((el) => (
      el.classList.contains("troi-dai__chong") ? [...(ban?.children ?? [])].map((c) => c.className) : [el.className]
    ));
    // `sr-only` nam ngoai mach bo cuc (position: absolute) nen khuon khong phai giu cho cho no.
    expect(dongKhuon).toEqual(dongChu(sec).map((el) => el.className).filter((c) => c !== "sr-only"));
  });

  it("hang cuoi cua khuon dung nhung o y het hang cuoi that, chi khong bam duoc", () => {
    const { container } = ve(KIA, null);
    const that = container.querySelector("section.troi .troi__cuoi") as HTMLElement;
    const khuon = container.querySelector(".troi-dai__khuon .troi__cuoi") as HTMLElement;
    // O giu cho cua nut tam dung mang lop `nut-cho` thay cho `nut-dung`: bo dem nut that (bai kiem duoi day, song.ts,
    // e2e) khong duoc dem nham o giu cho, nhung nhanh giam chuyen dong van phai giau ca hai cung luc. Moi lop con lai
    // phai y het, neu khong hang cuoi cua khuon xuong dong khac hang cuoi that.
    expect([...khuon.children].map((el) => el.className))
      .toEqual([...that.children].map((el) => el.className.replace(" nut-dung", " nut-cho")));
    expect(khuon.querySelector("svg.hoa")).not.toBeNull();
  });

  it("dai troi luon la .troi-dai, ca khi chi mot nguoi giu tam trang", () => {
    const { container } = ve(KIA, null);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    expect(dai.className).toBe("troi-dai");
    expect(dai.querySelectorAll("section.troi")).toHaveLength(1);
    expect(container.children).toHaveLength(1);
  });
});

const CSS_TROI = boComment(readFileSync(`${THU_MUC_CSS}/tam-trang.css`, "utf8"));
/** Than cua mot quy tac CSS, doc tu tam-trang.css that chu khong tu mot danh sach viet tay. */
const luat = (bo: string) => new RegExp(`${bo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(CSS_TROI)?.[1] ?? "";

/*
 * Cong CSS cua khuon giu cho. jsdom khong tinh bo cuc nen cac bai tren chi chung minh duoc phan DOM; bon luat duoi day
 * la phan CSS quyet dinh chieu cao co that su bi khoa hay khong, va chung la cho de bi go nham nhat.
 */
describe("khuon giu cho: nhung luat CSS khong duoc mat", () => {
  it("dai troi la luoi mot o, va ca bau troi lan khuon deu nam trong dung o do", () => {
    expect(luat(".troi-dai")).toContain("display: grid");
    expect(luat(".troi-dai > .troi")).toContain("grid-area: 1 / 1");
    expect(luat(".troi-dai__chong > *")).toContain("grid-area: 1 / 1");
  });

  it("khuon an bang visibility chu khong bang display: none - display: none thi no khong do gi nua", () => {
    const khuon = luat(".troi-dai > .troi-dai__khuon");
    expect(khuon).toContain("visibility: hidden");
    expect(khuon).not.toContain("display: none");
  });
});

describe("BauTroi: o cua so khi ca hai cung giu tam trang", () => {
  it("ca hai bau troi ve san, xep chong trong mot o luoi; troi an bi cat va tro nang, troi hien binh thuong", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so");
    // The boc luon mang lop troi-dai, va them troi-cua-so khi ca hai cung giu tam trang.
    expect(dai?.className).toBe("troi-dai troi-cua-so");
    // Hai bau troi, khuon giu cho, vung bao cua lan doi cho, vung bao cua nut tam dung.
    expect(dai?.children).toHaveLength(5);
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

describe("BauTroi: nut tam dung hieu ung (WCAG SC 2.2.2)", () => {
  afterEach(() => {
    try {
      localStorage.clear();
    } catch {
      // Ban gia cua bai kiem co the khong co clear: khong sao, moi bai tu dat lai gia tri no can.
    }
  });

  // Phan quyet B4: mot nut dung chung cho ca bau troi lan bia tu doi cua khung sach lon (plan sau), nen nhan cu
  // "Tam dung bau troi" khong con dung nua. Yeu cau diem 21 chot dung hai chu "Tam dung hieu ung" / "Cho hieu ung chay".
  // Nhan van noi VIEC SAP LAM khi bam, nen doc len la biet duoc gi.
  it("bam tam dung: dai troi mang lop troi-dung, nhan doi o ca hai mat, co loi bao lich su", () => {
    const { container } = ve(KIA, MINH);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    const nut = [...container.querySelectorAll<HTMLButtonElement>(".nut-dung")];
    expect(nut).toHaveLength(2);
    expect(nut.map((n) => n.textContent)).toEqual(["Tạm dừng hiệu ứng", "Tạm dừng hiệu ứng"]);
    expect(dai.classList.contains("troi-dung")).toBe(false);
    expect(baoDung(dai)).toBe("");

    fireEvent.click(nut[0]);
    expect(dai.classList.contains("troi-dung")).toBe(true);
    // Ca hai mat doi nhan cung luc: doi cho xong thi nhan tren mat vua hien van dung.
    expect(nut.map((n) => n.textContent)).toEqual(["Cho hiệu ứng chạy", "Cho hiệu ứng chạy"]);
    expect(baoDung(dai)).toBe("Hiệu ứng đã tạm dừng.");

    fireEvent.click(nut[0]);
    expect(dai.classList.contains("troi-dung")).toBe(false);
    expect(nut[0].textContent).toBe("Tạm dừng hiệu ứng");
    expect(baoDung(dai)).toBe("Hiệu ứng chạy lại rồi.");
  });

  /*
   * Bai nay do THU TU chu khong do ket qua cuoi cung: ket qua cuoi giong nhau o ca hai cach viet, nen bai "nho lua chon"
   * ben duoi van xanh ke ca khi viec khoi phuc chay sau khi trinh duyet da ve.
   *
   * Cach do: mot thanh phan do dat NGAY SAU BauTroi trong cung mot cay. React chay HET layout effect cua ca cay (theo
   * thu tu cay) roi moi chay passive effect. Nen tai thoi diem layout effect cua thanh phan do:
   *  - BauTroi dung useLayoutEffect  -> lop troi-dung DA co (do duoc: true)
   *  - BauTroi dung useEffect        -> chua co gi chay ca (do duoc: false) - va do dung la mot khung hinh bau troi
   *    chay lai truoc mat nguoi da tat no. Doi mot trong hai useLayoutEffect cua BauTroi ve useEffect la dong
   *    khang dinh dau tien duoi day do ngay.
   * Nhan cua nut chi doi o vong ve lai sau do (React khong the doi HTML may chu da gui xuong), vi vay lop duoc dat
   * thang bang classList trong chinh layout effect: lop moi la thu quyet dinh bau troi co chay hay khong.
   */
  it("khoi phuc lua chon da luu chay TRUOC khi ve, khong phai sau (layout effect, khong phai passive effect)", () => {
    localStorage.setItem("troi-tam-dung", "dung");
    const daDung = () => document.querySelector(".troi-cua-so")?.classList.contains("troi-dung") ?? null;
    const moc: Record<string, boolean | null> = {};
    function ThanhPhanDo() {
      useLayoutEffect(() => {
        moc.layout = daDung();
      }, []);
      useEffect(() => {
        moc.passive = daDung();
      }, []);
      return null;
    }
    render(<><BauTroi tenKia="Linh" kia={KIA} minh={MINH} /><ThanhPhanDo /></>);

    expect(moc.layout, "lua chon tam dung duoc khoi phuc sau khi trinh duyet da ve mot khung hinh").toBe(true);
    expect(moc.passive).toBe(true);
    expect(daDung()).toBe(true);
    expect(document.querySelector(".nut-dung")?.textContent).toBe("Cho hiệu ứng chạy");
  });

  it("nho lua chon: ghi vao localStorage, va lan ve sau dai troi dung san tu luc vao cay", () => {
    const { container, unmount } = ve(KIA, MINH);
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    expect(localStorage.getItem("troi-tam-dung")).toBe("dung");
    unmount();

    const lai = ve(KIA, MINH);
    expect((lai.container.querySelector(".troi-cua-so") as HTMLElement).classList.contains("troi-dung")).toBe(true);
    expect(lai.container.querySelector(".nut-dung")?.textContent).toBe("Cho hiệu ứng chạy");

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
    expect(dai.className).toBe("troi-dai troi-cua-so troi-cua-so--san troi-dung");
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

  /*
   * Vung bao dai ngay duoi dai troi thay vi trong .troi__noi: tu khi dai troi luon co the boc (.troi-dai), che do mot
   * troi va che do hai troi dung chung dung mot duong, khong con mot duong rieng cho moi che do.
   */
  it("chi mot bau troi: nut va vung bao nam TRONG dai troi, khong chen the nao giua dai troi va .shell", () => {
    const { container } = ve(KIA, null);
    // Quy tac ".troi-dai + .shell .ke-dau" doi dai troi la anh em lien ke ngay truoc .shell: dai phai la con duy nhat.
    expect(container.children).toHaveLength(1);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    expect(dai.querySelector(".nut-dung")?.textContent).toBe("Tạm dừng hiệu ứng");
    fireEvent.click(dai.querySelector(".nut-dung") as Element);
    expect(dai.classList.contains("troi-dung")).toBe(true);
    expect(dai.querySelector(":scope > .sr-only[aria-live]")?.textContent).toBe("Hiệu ứng đã tạm dừng.");
  });

  /*
   * Tu mot bau troi sang hai bau troi (nguoi kia vua tha tam trang, trang song lai ma thanh phan khong bi dung lai),
   * the boc dai troi doi className tu "troi-dai" sang "troi-dai troi-cua-so", va React ghi de ca thuoc tinh class khi
   * lam vay. Lop `troi-dung` duoc dat bang classList nen no bi xoa mat, va neu khong dat lai thi nguoi da tam dung se
   * thay hieu ung chay lai ma ho khong bam gi.
   */
  it("doi tu mot troi sang hai troi: lua chon tam dung duoc dat lai tren the boc moi", () => {
    const { container, rerender } = render(<BauTroi tenKia="Linh" kia={KIA} minh={null} />);
    fireEvent.click(container.querySelector(".nut-dung") as Element);
    expect((container.querySelector(".troi-dai") as HTMLElement).classList.contains("troi-dung")).toBe(true);

    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH} />);
    const dai = container.querySelector(".troi-cua-so") as HTMLElement;
    expect(dai.classList.contains("troi-dung")).toBe(true);
    expect(container.querySelector(".nut-dung")?.textContent).toBe("Cho hiệu ứng chạy");
  });
});

/*
 * Phan quyet M2 (phat hien F11): "mat nao dang lon" phai co DUNG MOT nguon su that trong React. Thuoc tinh `class`
 * thuoc ve React - moi lan doi tam trang, React ghi lai ca chuoi class tu JSX, ma trong JSX mat "minh" luon nhan
 * `an` - nen doc `classList.contains("troi--an")` la doc dung cai gia tri vua bi ghi de. Hai he qua, bai duoi day do
 * ca hai: lan doi cho cua nguoi dung bi dat lai am tham (loi co san tu truoc), va nhanh "dai lon" cua lan loang khong
 * bao gio chay o che do hai troi.
 */
describe("BauTroi: mat nao dang lon", () => {
  it("doi cho roi thay tam trang: troi cua minh VAN la troi lon, khong bi dat lai am tham", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    for (const f of ketThuc) f();
    vi.advanceTimersByTime(SONG_HET);
    // Nguoi dung vua chon: troi cua minh la troi lon, troi cua nguoi kia lui ve o cua so.
    expect(mat[1].classList.contains("troi--an")).toBe(false);
    expect(mat[0].classList.contains("troi--an")).toBe(true);

    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={{ ...MINH, weather: "giong", gio: "09:00", tha: "Thả lúc 09:00" }} />);

    expect(mat[1].classList.contains("troi--giong"), "troi moi cua nguoi xem chua duoc ve").toBe(true);
    expect(mat[1].classList.contains("troi--an"), "thay tam trang xong thi lan doi cho bi dat lai am tham").toBe(false);
    expect(mat[0].classList.contains("troi--an")).toBe(true);
    // Khong chi lop: inert va aria-hidden cung phai theo, neu khong troi dang bi cat ve 0 van bam va doc duoc.
    expect(mat[1].hasAttribute("inert")).toBe(false);
    expect(mat[1].hasAttribute("aria-hidden")).toBe(false);
    expect(mat[0].hasAttribute("inert")).toBe(true);
    expect(mat[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("chua doi cho ma thay tam trang: troi cua nguoi kia van la troi lon", () => {
    const { container, rerender } = ve(KIA, MINH);
    const mat = [...container.querySelectorAll(".troi[data-mat]")];
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={{ ...MINH, weather: "giong", gio: "09:00", tha: "Thả lúc 09:00" }} />);
    expect(mat[0].classList.contains("troi--an")).toBe(false);
    expect(mat[1].classList.contains("troi--an")).toBe(true);
    expect(mat[1].hasAttribute("inert")).toBe(true);
  });
});

/** Troi cua nguoi xem sau khi ho tha mot tam trang khac: khac ca kieu troi lan moc gio that cua lan tha. */
const MINH_MOI: TroiHien = { weather: "giong", note: null, tha: "Thả lúc 09:00", gio: "09:00" };

/*
 * Spec muc 3.4: BauTroi giu bau troi dang hien trong state; khi props tu may chu doi (sau refresh() cua ThaTamTrang),
 * mot layout effect nhan ra tam trang cua chinh nguoi xem vua doi va chay lan loang tu troi cu sang troi moi. Troi cu
 * chi bi go o buoc don. Task nay lam nhanh DAI LON; nhanh o cua so tron trao thang cho toi khi co nhanh cua no.
 */
describe("BauTroi: thay tam trang bang hieu ung C", () => {
  it("troi cua minh doi: trai troi cu nam duoi, troi moi mang lop dang loang, co lop loang", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(null, MINH);
    rerender(<BauTroi tenKia="Linh" kia={null} minh={MINH_MOI} />);

    const dai = container.querySelector(".troi-dai") as HTMLElement;
    // Dem theo [data-k]: bau troi that mang no, khuon giu cho thi khong du cung mang lop `troi`.
    expect(dai.querySelectorAll(".troi[data-k]")).toHaveLength(2);
    const moi = dai.querySelector(".troi--dang-loang") as HTMLElement;
    expect(moi.classList.contains("troi--giong")).toBe(true);
    const cu = dai.querySelector(".troi--cu") as HTMLElement;
    expect(cu.classList.contains("troi--nang-am")).toBe(true);
    expect(cu.hasAttribute("inert")).toBe(true);
    expect(cu.getAttribute("aria-hidden")).toBe("true");
    // Trai troi cu khong mang data-mat: song.ts tim hai mat cua lan doi cho bang dung thuoc tinh do.
    expect(cu.hasAttribute("data-mat")).toBe(false);
    // Con truc tiep cua dai troi, tuc nam trong DUNG o luoi cua cac bau troi (.troi-dai > .troi{ grid-area: 1 / 1 }):
    // dai khong cao them roi thap di, tieu de "Ke sach" ngay duoi khong nhuc nhich.
    expect(cu.parentElement).toBe(dai);
    // Phan quyet M3: khang dinh lop loang CO that truoc da, roi moi dem vet nuoc.
    expect(lopLoang(dai).querySelectorAll(".giot").length).toBeGreaterThan(0);

    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    expect(dai.querySelectorAll(".troi[data-k]")).toHaveLength(1);
    expect(dai.querySelector(".loang")).toBeNull();
    expect(dai.querySelector(".troi--dang-loang")).toBeNull();
    expect(soHoatDangGiu(dai)).toBe(0);
  });

  /*
   * Phan quyet M2: day la bai ma nhanh "dai lon" chi chay duoc khi co MOT nguon su that. Neu doc lop `troi--an` ra de
   * suy "mat nao dang lon" thi o che do hai troi no luon tra ve "mat minh dang bi cat", va lan loang se chay nham vao
   * o cua so du nguoi xem dang nhin chinh troi cua ho to het dai.
   */
  it("da doi cho nen troi cua minh la troi lon: loang chay tren dai lon", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    for (const f of ketThuc) f();
    vi.advanceTimersByTime(SONG_HET);

    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    expect(dai.querySelector(".troi--dang-loang")?.getAttribute("data-mat")).toBe("minh");
    const cu = dai.querySelector(".troi--cu") as HTMLElement;
    expect(cu.classList.contains("troi--nang-am")).toBe(true);
    // Trai troi cu giu nguyen o cua so cua mat no: duoi 768px chu chay vong quanh o, bo o di la cac dong chu cu dung
    // khac cho nguoi dung vua nhin, va luc tan di se thay chu nhay.
    expect(cu.querySelector(".cua-so__kinh")?.getAttribute("class")).toBe("cua-so__kinh troi--mua-phun");
    expect(lopLoang(dai).parentElement).toBe(dai);

    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    expect(dai.querySelectorAll(".troi[data-k]")).toHaveLength(2);
    expect(dai.querySelector(".troi--cu")).toBeNull();
    expect(soHoatDangGiu(dai)).toBe(0);
  });

  it("troi cua minh dang o o cua so: khong trai troi cu lon nao, khong lop dang loang nao tren dai", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    expect(dai.querySelector(".troi--cu")).toBeNull();
    expect(dai.querySelector(".troi--dang-loang")).toBeNull();
    expect(dai.querySelector(".troi[data-mat=\"minh\"]")?.classList.contains("troi--giong")).toBe(true);
  });

  /*
   * Yeu cau diem 20 cua chu du an va spec muc 3.4: "loang chay tren dung mat dang mang troi cua nguoi vua tha - dai
   * lon neu troi cua ho dang la troi lon, o cua so tron neu no dang o o". Truoc task nay nhanh o cua so trao thang.
   */
  it("troi cua minh dang o o cua so: hai o kinh xep chong, loang chay trong o kinh moi", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);

    const dai = container.querySelector(".troi-dai") as HTMLElement;
    // O cua so cua mat "kia" la noi troi cua nguoi xem dang thu nho lai.
    const o = dai.querySelector(".troi[data-mat=\"kia\"] .cua-so__o") as HTMLElement;
    const kinh = [...o.querySelectorAll<HTMLElement>(".cua-so__kinh")];
    expect(kinh).toHaveLength(2);
    expect(kinh[0].getAttribute("class")).toBe("cua-so__kinh cua-so__kinh--cu troi--nang-am");
    expect(kinh[1].getAttribute("class")).toBe("cua-so__kinh troi--giong cua-so__kinh--loang");
    // Phan quyet M3: khang dinh lop loang CO that truoc da, roi moi dem vet nuoc.
    expect(lopLoang(kinh[1]).querySelectorAll(".giot").length).toBeGreaterThan(0);

    // Net ve thu nho va bong hoa ep cua troi moi deu hien lai theo nhip cua chung, khong cai nao bi bo lai cho buoc
    // don (phan quyet M1: mot cum bat ra cung mot luc la dung cai giat ma ca hieu ung muon tranh).
    const hienLai = (el: Element | null) => daGoi.some((g) => g.el === el && g.ken.duration === NEN_MS && g.ken.delay === NEN_TRE_MS);
    const net = [...kinh[1].querySelectorAll(".cua-so__nen .m")];
    expect(net).toHaveLength(SO_NET.giong);
    expect(net.every((el) => hienLai(el))).toBe(true);
    expect(hienLai(kinh[1].querySelector(".cua-so__hoa"))).toBe(true);

    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    expect(o.querySelectorAll(".cua-so__kinh")).toHaveLength(1);
    expect(dai.querySelector(".loang")).toBeNull();
    expect(dai.querySelector(".cua-so__kinh--loang")).toBeNull();
    expect(soHoatDangGiu(dai)).toBe(0);
  });

  /*
   * Phat hien N1: hai hieu ung bau troi ve len CUNG mot dai va ghi vao CUNG mot so hoat hinh, nen chung phai co mot
   * khoa dung chung. Khong co khoa thi mot cu cham giua lan loang bat mot vong song doc tren mot o kinh sap bi go, va
   * viec dau tien vong song lam la huy sach so hoat hinh - tuc dong bang may chuc vet nuoc dang loang do.
   */
  it("cham o cua so giua lan loang: khong vong song nao, hai bau troi giu nguyen cho; tan roi thi cham lai duoc", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    // Phan quyet M3: chung minh lan loang DANG chay that, neu khong ca bai chi la mot cu cham vao dai troi dung yen.
    expect(lopLoang(dai).querySelectorAll(".giot").length).toBeGreaterThan(0);
    const mat = [...dai.querySelectorAll(".troi[data-mat]")];
    const lopTruoc = mat.map((s) => s.className);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(dai.querySelector(".song-vong")).toBeNull();
    expect(mat.map((s) => s.className)).toEqual(lopTruoc);

    // Lan loang tan thi khoa duoc nha: cham tiep la doi cho binh thuong, khong ket lai.
    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Xem trời của bạn" }), { button: 0, isPrimary: true });
    expect(dai.querySelector(".song-vong")).not.toBeNull();
  });

  /*
   * So bau troi tren dai doi GIUA lan loang: nguoi kia vua tha tam trang cua ho (mot troi thanh hai troi), hay vua thu
   * no lai (hai troi thanh mot). Ham go cua effect theo so bau troi huy moi hen gio cua dai troi, ke ca cai hen don
   * dep cua lan loang, nen neu khong go tay thi hoat hinh dung het ma lop vet nuoc, dau "dang loang" va trai troi cu
   * con nam lai trong cay toi tan lan thay tam trang sau - mot bau troi khong nen, phu mot lop nuoc dong cung.
   */
  it("nguoi kia tha tam trang giua lan loang tren dai lon: go sach lop loang, dau dang loang va trai troi cu", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(null, MINH);
    rerender(<BauTroi tenKia="Linh" kia={null} minh={MINH_MOI} />);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    // Phan quyet M3: chung minh lan loang DANG chay that truoc khi kiem viec don no.
    expect(lopLoang(dai).querySelectorAll(".giot").length).toBeGreaterThan(0);

    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);
    expect(dai.querySelector(".loang")).toBeNull();
    expect(dai.querySelector(".troi--dang-loang")).toBeNull();
    expect(dai.querySelector(".troi--cu")).toBeNull();
    expect(soHoatDangGiu(dai)).toBe(0);

    // Cai hen don dep da bi huy, nen khong co gi bat ra muon sau do.
    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    expect(dai.querySelector(".loang")).toBeNull();
    expect(dai.querySelectorAll(".troi[data-k]")).toHaveLength(2);
  });

  /*
   * Cung mot lo hong, nhanh o cua so. O day React tu go o kinh dang loang khi mat "kia" bien mat, nen cai con lai la
   * trang thai ben React: `cu` khong bao gio duoc tra ve null, va ngay khi nguoi kia tha lai, o cua so moc ra mot o
   * kinh cu ma khong lan loang nao con chay de phu len no.
   */
  it("nguoi kia thu tam trang giua lan loang trong o cua so: khong de lai o kinh cu nao khi ho tha lai", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(KIA, MINH);
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);
    const dai = container.querySelector(".troi-dai") as HTMLElement;
    const oCu = dai.querySelector(".troi[data-mat=\"kia\"] .cua-so__o") as HTMLElement;
    expect(lopLoang(oCu).querySelectorAll(".giot").length).toBeGreaterThan(0);

    rerender(<BauTroi tenKia="Linh" kia={null} minh={MINH_MOI} />);
    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    rerender(<BauTroi tenKia="Linh" kia={KIA} minh={MINH_MOI} />);

    const o = dai.querySelector(".troi[data-mat=\"kia\"] .cua-so__o") as HTMLElement;
    expect(o.querySelectorAll(".cua-so__kinh")).toHaveLength(1);
    expect(dai.querySelector(".cua-so__kinh--loang")).toBeNull();
    expect(dai.querySelector(".loang")).toBeNull();
  });

  it("troi cua nguoi kia doi thi khong loang: chi tam trang cua chinh nguoi xem moi co lan loang", () => {
    const { container, rerender } = ve(KIA, null);
    rerender(<BauTroi tenKia="Linh" kia={{ ...KIA, weather: "giong", gio: "09:00", tha: "Thả lúc 09:00" }} minh={null} />);
    expect(container.querySelector(".loang")).toBeNull();
    expect(container.querySelector(".troi--cu")).toBeNull();
    expect(container.querySelectorAll(".troi[data-k]")).toHaveLength(1);
  });

  it("giam chuyen dong: trao thang, khong lop loang nao, khong trai troi cu nao", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
    const { container, rerender } = ve(null, MINH);
    rerender(<BauTroi tenKia="Linh" kia={null} minh={MINH_MOI} />);
    expect(container.querySelector(".loang")).toBeNull();
    expect(container.querySelector(".troi--cu")).toBeNull();
    expect(container.querySelector(".troi--giong")).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it("khung chua do duoc (be rong 0): trao thang ngay, khong ket lai trai troi cu, khong canh bao nao", () => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { value: 0, configurable: true });
    const loi = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container, rerender } = ve(null, MINH);
    rerender(<BauTroi tenKia="Linh" kia={null} minh={MINH_MOI} />);

    const dai = container.querySelector(".troi-dai") as HTMLElement;
    expect(dai.querySelector(".loang")).toBeNull();
    expect(dai.querySelectorAll(".troi[data-k]")).toHaveLength(1);
    expect(dai.querySelector(".troi--dang-loang")).toBeNull();
    // O nhanh nay loangTroi goi `xong` DONG BO ngay trong layout effect: goi flushSync tu trong mot lifecycle thi React
    // in canh bao, ma dau ra kiem thu phai sach (phat hien F10).
    expect(loi).not.toHaveBeenCalled();
    loi.mockRestore();
  });

  /*
   * Phat hien N12: `tha` la chuoi "Tha luc 08:15" hay "Tha luc 08:15 hom qua" tuy hom nay la ngay nao, nen no khong
   * phai moc dinh danh cua mot lan tha. `gio` moi la moc that (timeLabel cua setAt).
   */
  it("qua nua dem ma dong gio tha doi chu: khong loang; tha lai cung kieu troi o phut khac: co loang", () => {
    vi.useFakeTimers();
    const { container, rerender } = ve(null, MINH);
    rerender(<BauTroi tenKia="Linh" kia={null} minh={{ ...MINH, tha: "Thả lúc 08:15 hôm qua" }} />);
    expect(container.querySelector(".loang")).toBeNull();
    expect(container.querySelector(".troi--cu")).toBeNull();

    rerender(<BauTroi tenKia="Linh" kia={null} minh={{ ...MINH, tha: "Thả lúc 09:00", gio: "09:00" }} />);
    expect(lopLoang(container).querySelectorAll(".giot").length).toBeGreaterThan(0);
    vi.advanceTimersByTime(LOANG_HET_MS + 10);
    expect(container.querySelector(".troi--cu")).toBeNull();
  });

  /*
   * Phan con lai cua loi hua "khong xo dich" va cua chinh lan loang, ma jsdom khong tinh bo cuc nen chi doc duoc tu
   * CSS. Trai troi cu la con CUOI cua dai troi: neu khong co z-index day no xuong duoi, no ve DE LEN troi moi va ca
   * lan loang thanh vo hinh - mot lan hong im lang, khong bai DOM nao bat duoc.
   */
  it("trai troi cu nam trong dung o luoi cua cac bau troi va ve duoi troi moi", () => {
    expect(luat(".troi-dai > .troi")).toContain("grid-area: 1 / 1");
    expect(luat(".troi-dai > .troi--cu")).toContain("z-index: 0");
    expect(luat(".troi-dai > .troi--dang-loang")).toContain("z-index: 3");
  });

  /*
   * Phat hien N3. O nhanh dai lon, lop loang nam CANH bau troi moi va bau troi moi nam tren no, nen net ve hien lai
   * ngay tren nuoc. O nhanh o cua so thi lop loang nam BEN TRONG o kinh (z-index 2, trong mot o kinh dang
   * isolation: isolate), nen bong hoa ep (z-index auto) va khung net ve thu nho (z-index -1) deu nam DUOI may chuc
   * vet nuoc: hoat hinh hien lai cua chung khong ai thay duoc, roi toi buoc don ca cum bat ra cung mot luc - dung cai
   * giat ma phan quyet M1 cam. Hai o kinh cung phai xep dung thu tu tren duoi.
   */
  it("trong o kinh dang loang: bong hoa va net ve thu nho nam TREN lop vet nuoc, kinh cu nam duoi kinh moi", () => {
    expect(luat(".loang")).toContain("z-index: 2");
    expect(luat(".cua-so__kinh--loang > .cua-so__nen")).toContain("z-index: 3");
    expect(luat(".cua-so__kinh--loang > .cua-so__hoa")).toContain("z-index: 4");
    expect(luat(".cua-so__kinh--cu")).toContain("z-index: 0");
    expect(luat(".cua-so__kinh--loang")).toContain("z-index: 1");
    // Hai o kinh phai nam trong CUNG mot o luoi, neu khong o cua so cao gap doi trong ba giay va day ca dai troi.
    expect(luat(".cua-so__o > .cua-so__kinh")).toContain("grid-area: 1 / 1");
  });
});

describe("dongChu: cac dong chu cua mot bau troi", () => {
  /*
   * Do tren mat "kia" cua dai hai troi: mat nay khong mang nhan "Ban" nen day la chuoi dong chu day du cua mot bau
   * troi cua nguoi khac, dung thu tu tren duoi.
   */
  it("dung thu tu tren duoi", () => {
    const { container } = ve(KIA, MINH);
    const sec = container.querySelector(".troi[data-mat=\"kia\"]") as HTMLElement;
    const lop = dongChu(sec).map((el) => el.className);
    expect(lop).toEqual([
      "sr-only", "troi__dong troi__tho d", "troi__giai troi__phu", "troi__nguon troi__phu", "troi__nhan", "troi__cuoi",
    ]);
  });
});
