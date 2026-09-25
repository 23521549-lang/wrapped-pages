// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ghi, soHoatDangGiu } from "@/components/tam-trang/hieu-ung-chung";
import { dangLoang, loangTroi, type MatLoang } from "@/components/tam-trang/loang";
import {
  CHU_MS, CHU_TRE_MS, CU_MS, CUA_MS, LOANG_HET_MS, MAT_DO, NEN_MS, NEN_TRE_MS,
} from "@/lib/tam-trang/loang-nhip";
import { boComment, THU_MUC_CSS } from "../helpers/bang-token";
import { dungCoHop, lopLoang } from "../helpers/co-hop";

/*
 * jsdom khong co Web Animations API: thay bang mot ban ghi lai moi lan goi animate. Moi hop trong jsdom la 0 nen bai
 * nay kiem cau truc, so luong, nhip va viec don sach; hinh that duoc kiem o trinh duyet that (Task 10, 11). Co hop
 * gia do ../helpers/co-hop dat, khong phai moi tep tu va mot ban.
 */
type Ken = { duration?: number; delay?: number; easing?: string; fill?: string };
type LanGoi = { el: Element; khung: Keyframe[]; ken: Ken; daHuy: boolean };
let daGoi: LanGoi[] = [];
/** Mo ta goc cua Element.prototype.animate (jsdom khong co: undefined), de tra lai nguyen trang sau moi bai. */
const ANIMATE_GOC = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

const W_DAI = 1000;
const H_DAI = 400;

dungCoHop(W_DAI, H_DAI);

beforeEach(() => {
  daGoi = [];
  vi.useFakeTimers();
  Element.prototype.animate = function (this: Element, khung: Keyframe[], ken: Ken = {}) {
    const g: LanGoi = { el: this, khung, ken, daHuy: false };
    daGoi.push(g);
    return { cancel: () => { g.daHuy = true; } } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  // Tra lai Element.prototype.animate: khong de ban va cho cac tep kiem thu khac chay sau trong cung moi truong.
  if (ANIMATE_GOC === undefined) delete (Element.prototype as Partial<Element>).animate;
  else Object.defineProperty(Element.prototype, "animate", ANIMATE_GOC);
});

/**
 * Mot dai troi toi gian, dung theo cay DOM THAT cua BauTroi.tsx: net ve (.m) nam BEN TRONG .troi__nen, chu khong phai
 * la anh em cua no nhu o ban mau ky thuat. Dung cho khac ay la ly do bai "net ve hien that" duoi day co nghia.
 */
function dungDai() {
  const w = document.createElement("div");
  w.className = "troi-dai";
  w.innerHTML = '<section class="troi troi--mua-phun troi--dang-loang">'
    + '<div class="troi__nen"><span class="m m-hao"></span><span class="m m-nang"></span></div>'
    + '<div class="shell troi__chu"><div class="troi__noi"><p class="moi"></p><p class="moi"></p></div></div>'
    + "</section>"
    + '<section class="troi troi--nang-am troi--cu">'
    + '<div class="shell troi__chu"><div class="troi__noi"><p class="cu"></p><p class="cu"></p></div></div>'
    + "</section>";
  document.body.append(w);
  const moi = w.querySelector(".troi--dang-loang") as HTMLElement;
  const m: MatLoang = {
    khung: w,
    kieu: "mua-phun",
    net: [...moi.querySelectorAll<HTMLElement>(".troi__nen .m")],
    chuMoi: [...w.querySelectorAll<HTMLElement>(".moi")],
    chuCu: [...w.querySelectorAll<HTMLElement>(".cu")],
    nho: false,
  };
  return { w, m };
}

const theo = (lop: string) => daGoi.filter((g) => (g.el as Element).classList.contains(lop));

/**
 * Do trong suot THAT SU nhin thay cua mot the o khung hinh cuoi cua hoat hinh no: nhan gia tri cuoi cua chinh hoat
 * hinh do voi do trong suot noi tuyen cua the va cua moi to tien toi dai troi.
 *
 * Phai do kieu nay chu khong doc `style.opacity` cua mot the le: tat mot the CHA (vi du .troi__nen) thi hoat hinh cua
 * tung net van chay du nhip ma khong mot diem anh nao hien ra, roi toi buoc don ca tram net bat ra cung mot luc - dung
 * cai giat ma spec cam. Phep nhan nay do dung cai nguoi dung nhin thay (phan quyet M1).
 */
function roCuoi(el: HTMLElement, goc: HTMLElement): number {
  const hoat = daGoi.find((g) => g.el === el);
  const cuoi = hoat?.khung.at(-1)?.opacity;
  let ro = cuoi === undefined || cuoi === null ? 1 : Number(cuoi);
  for (let n: HTMLElement | null = el; n !== null && n !== goc.parentElement; n = n.parentElement) {
    if (n.style.opacity !== "") ro *= Number(n.style.opacity);
  }
  return ro;
}

describe("loangTroi", () => {
  it("dung mot lop loang day vet nuoc, moi vet mot khuon va mot manh nen ben trong", () => {
    const { w, m } = dungDai();
    loangTroi(w, m, () => undefined);

    const lop = lopLoang(w);
    expect(lop.className).toBe("loang troi--mua-phun");
    expect(lop.getAttribute("aria-hidden")).toBe("true");
    const giot = [...lop.querySelectorAll<HTMLElement>(".giot")];
    expect(giot).toHaveLength((Math.ceil(W_DAI / MAT_DO) + 2) * (Math.ceil(H_DAI / MAT_DO) + 2));

    // Manh nen to dung o toa do cua vet: background-size bang ca dai, background-position am bang goc vet, nen may
    // chuc manh roi ghep lai thanh dung mot nen troi lien.
    const nen = giot[0].querySelector<HTMLElement>(".giot__nen") as HTMLElement;
    expect(nen.style.backgroundSize).toBe(`${W_DAI}px ${H_DAI}px`);
    const [px, py] = nen.style.backgroundPosition.split(" ").map((s) => Number.parseFloat(s));
    expect(px).toBeCloseTo(-Number.parseFloat(giot[0].style.left), 1);
    expect(py).toBeCloseTo(-Number.parseFloat(giot[0].style.top), 1);

    // Moi vet co hai hoat hinh: khuon no ra, va manh nen bu nguoc lai.
    expect(theo("giot")).toHaveLength(giot.length);
    expect(theo("giot__nen")).toHaveLength(giot.length);
    expect(dangLoang(w)).toBe(true);
  });

  it("net ve cua troi moi hien that: khong mot to tien nao bi tat, moi net mot hoat hinh rieng dung nhip", () => {
    const { w, m } = dungDai();
    loangTroi(w, m, () => undefined);
    lopLoang(w);

    const net = theo("m");
    expect(net).toHaveLength(2);
    expect(net.every((g) => g.ken.duration === NEN_MS && g.ken.delay === NEN_TRE_MS)).toBe(true);
    // fill "backwards" giu net trong suot suot do tre, nen khong can dat opacity noi tuyen roi xoa di.
    expect(net.every((g) => g.ken.fill === "backwards" && Number(g.khung[0].opacity) === 0)).toBe(true);
    // Va day la dong quan trong nhat cua ca tep: het hoat hinh thi net phai HIEN, khong bi mot the cha nao tat.
    for (const el of m.net) expect(roCuoi(el, w)).toBe(1);
  });

  it("chu cu tan di, chu moi hien lai, moi dong mot hoat hinh rieng", () => {
    const { w, m } = dungDai();
    loangTroi(w, m, () => undefined);
    lopLoang(w);

    const cu = theo("cu");
    const moi = theo("moi");
    expect(cu).toHaveLength(2);
    expect(moi).toHaveLength(2);
    expect(cu.every((g) => g.ken.duration === CU_MS && g.ken.fill === "forwards")).toBe(true);
    expect(moi.every((g) => g.ken.duration === CHU_MS && g.ken.fill === "backwards")).toBe(true);
    // Chu moi hien SAU khi mep loang di qua dong do: tre it nhat bang CHU_TRE_MS va khong bao gio qua cua so rai vet.
    expect(moi.every((g) => (g.ken.delay ?? -1) >= CHU_TRE_MS && (g.ken.delay ?? -1) <= CUA_MS + CHU_TRE_MS)).toBe(true);
    expect(cu.every((g) => (g.ken.delay ?? -1) >= 0 && (g.ken.delay ?? -1) <= CUA_MS)).toBe(true);
    for (const el of m.chuMoi) expect(roCuoi(el, w)).toBe(1);
  });

  it("don trong dung mot luot: goi xong, go lop loang, huy sach hoat hinh", () => {
    const { w, m } = dungDai();
    const thuTu: string[] = [];
    loangTroi(w, m, () => {
      thuTu.push("xong");
      // Luc xong() chay, lop loang VAN con: nguoi goi trao trang thai trong cung mot luot nen khong khung hinh nao lot vao.
      expect(w.querySelector(".loang")).not.toBeNull();
    });
    lopLoang(w);
    expect(soHoatDangGiu(w)).toBeGreaterThan(0);

    vi.advanceTimersByTime(LOANG_HET_MS);
    expect(thuTu).toEqual(["xong"]);
    expect(w.querySelector(".loang")).toBeNull();
    expect(daGoi.every((g) => g.daHuy)).toBe(true);
    expect(soHoatDangGiu(w)).toBe(0);
    expect(dangLoang(w)).toBe(false);
  });

  it("thay tam trang lan nua giua chung: chi con MOT lop loang, va vong song dang chay khong bi dung toi", () => {
    const { w, m } = dungDai();
    // Mot hoat hinh cua hieu ung khac (vong song cua viec doi cho) dang nam trong so chung cua dai troi.
    const song = document.createElement("div");
    w.append(song);
    const cuaSong = new Set<Animation>();
    ghi(w, cuaSong, song.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }));

    loangTroi(w, m, () => undefined);
    const lanDau = theo("giot");
    loangTroi(w, m, () => undefined);

    expect(w.querySelectorAll(".loang")).toHaveLength(1);
    expect(lanDau.every((g) => g.daHuy)).toBe(true);
    // Vong song don minh bang su kien "finish": huy no giua chung la bo lai lop song tren trang mai mai.
    expect(daGoi.find((g) => g.el === song)?.daHuy).toBe(false);
    expect(cuaSong.size).toBe(1);
  });

  it("giam chuyen dong: trao thang, khong mot lop loang nao, khong mot hoat hinh nao", () => {
    const { w, m } = dungDai();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    let goi = 0;
    loangTroi(w, m, () => { goi++; });
    expect(goi).toBe(1);
    expect(w.querySelector(".loang")).toBeNull();
    expect(daGoi).toHaveLength(0);
    expect(dangLoang(w)).toBe(false);
  });

  it("khung chua do duoc (be rong 0): trao thang ngay, khong dung mot vet nao", () => {
    const { w, m } = dungDai();
    Object.defineProperty(w, "clientWidth", { value: 0, configurable: true });
    let goi = 0;
    loangTroi(w, m, () => { goi++; });
    expect(goi).toBe(1);
    expect(w.querySelector(".loang")).toBeNull();
    expect(daGoi).toHaveLength(0);
  });
});

/*
 * Cong CSS di kem: net ve chi hien duoc neu nen chuyen sac bi tat bang `background`, khong phai bang `opacity` hay
 * `visibility` cua ca the .troi__nen (phan quyet M1). Bai tren do phia DOM, bai nay do phia CSS - hai nua cua cung
 * mot loi hua.
 */
describe("tam-trang.css: tat nen troi moi ma khong tat net ve", () => {
  const css = boComment(readFileSync(`${THU_MUC_CSS}/tam-trang.css`, "utf8"));

  it("nen chuyen sac cua troi dang loang tat bang background: none", () => {
    // Doc dung khoi cua quy tac chu khong toContain ca tep: bai do thi loi in ra ca nghin dong CSS.
    const khoi = /\.troi--dang-loang > \.troi__nen\{([^}]*)\}/.exec(css);
    expect(khoi?.[1].trim()).toBe("background: none;");
  });

  it("khong quy tac nao cua .troi__nen dung opacity, visibility hay display", () => {
    const sai: string[] = [];
    for (const khoi of css.matchAll(/\.troi__nen\{([^}]*)\}/g)) {
      if (/(?:^|[;\s])(?:opacity|visibility|display)\s*:/.test(khoi[1])) sai.push(khoi[0].trim());
    }
    expect(sai).toEqual([]);
  });
});
