import {
  CHU_MS, CHU_TRE_MS, CU_MS, CUA_MS, hatTu, KHUNG_NGOAI, KHUNG_TRONG, khuonO, lanF, LOANG_HET_MS, luoiGiot, NEN_MS,
  NEN_TRE_MS, RV_HE, tien,
} from "@/lib/tam-trang/loang-nhip";
import { ghi, giamChuyenDong, hen, viec } from "./hieu-ung-chung";

/*
 * Hieu ung C - "giay tham nuoc": THAY mot tam trang. Troi moi no ra thanh may chuc vet nuoc tron mep mem, bung dan tu
 * giua ra toi khi phu kin troi cu, khong mot mep cung nao.
 *
 * Khac han vong song cua viec DOI CHO hai bau troi (song.ts): song la doi cho, loang la thay. Hai hieu ung khong tron
 * vao nhau; chung chi dung chung so viec (hieu-ung-chung.ts).
 *
 * Moi vet la MOT the deo san mot mat na radial-gradient TINH, chi chay transform va opacity. Khong mat na SVG (Safari
 * khong cat hinh khi mat na SVG gan len the HTML), khong bo loc nhoe, khong canvas, khong @property. Ben trong moi
 * vet, .giot__nen bi phong NGUOC dung 1/s tai tung moc, nen tich hai phep bien hinh luon bang 1 va manh nen troi moi
 * khong bi keo gian. Co y khong viet will-change: mot hoat hinh transform dang chay thi trinh duyet tu tach lop ghep
 * hinh, khai them chi bat may dung san ca tram lop ngay khung hinh dau - dung khung phai nhanh nhat.
 *
 * Nen chuyen sac cua troi moi duoc tat bang CSS (.troi--dang-loang > .troi__nen{ background: none }), KHONG bang
 * opacity cua ca the: net ve (.m) nam ben trong .troi__nen, nen tat the cha la bien hoat hinh cua tung net thanh hoat
 * hinh rong va toi buoc don ca tram net bat ra cung mot luc (phan quyet M1). Nguoi goi bat lop `troi--dang-loang`
 * truoc khi goi va go no trong `xong`, tuc trong cung mot luot voi luc go lop loang.
 */

/** Mot lan loang dang chay tren mot dai troi: lop vet nuoc cua no, va so hoat hinh cua rieng no. */
type Lan = { lop: HTMLElement; cua: Set<Animation> };

const lanCua = new WeakMap<HTMLElement, Lan>();

export function dangLoang(w: HTMLElement): boolean {
  return lanCua.has(w);
}

/** Mot mat dang doi troi: khung se phu day vet nuoc, va nhung the ma lan loang can dong toi. */
export type MatLoang = {
  /** Noi vet nuoc phu kin: dai troi (loang lon) hay o kinh cua o cua so (loang nho). */
  khung: HTMLElement;
  /** Kieu troi moi, de lop loang to dung MOT cong thuc mau voi nen that. */
  kieu: string;
  /** Net ve cua troi moi: hien lai o cuoi lan loang. */
  net: HTMLElement[];
  /** Tung dong chu cua troi moi, va cua troi cu. */
  chuMoi: HTMLElement[];
  chuCu: HTMLElement[];
  /** Loang trong o kinh: khuon co lai, va khong co cai nhat dan o day. */
  nho: boolean;
};

/**
 * Go han mot lan loang: gan lop vet nuoc ra khoi cay, huy hoat hinh CUA RIENG lan do roi tra chung khoi so chung cua
 * dai troi.
 *
 * Chi huy hoat hinh cua chinh lan loang chu khong quet ca so chung: so ay dung chung voi vong song cua viec doi cho
 * (song.ts), ma vong song don minh bang su kien "finish" - huy no giua chung la de lai may lop song tren trang mai
 * mai.
 */
function donLan(w: HTMLElement): void {
  const lan = lanCua.get(w);
  if (lan === undefined) return;
  lanCua.delete(w);
  lan.lop.remove();
  const v = viec(w);
  for (const a of lan.cua) a.cancel();
  v.hoat = v.hoat.filter((a) => !lan.cua.has(a));
  lan.cua.clear();
}

/**
 * Chay mot lan loang. `xong` duoc goi trong buoc don, TRUOC khi lop loang bi go, de nguoi goi trao trang thai (go
 * troi cu, go lop `troi--dang-loang`) trong dung mot luot - giua troi cu bien mat va lop loang bien mat khong co khung
 * hinh nao lot vao. Vet nuoc va nen that dung chung dung mot cong thuc mau nen luc trao khong loe.
 */
export function loangTroi(w: HTMLElement, m: MatLoang, xong: () => void): void {
  if (giamChuyenDong()) {
    xong();
    return;
  }
  const { khung } = m;
  const W = khung.clientWidth;
  const H = khung.clientHeight;
  if (W === 0 || H === 0) {
    xong();
    return;
  }

  const b = khuonO(W, H, m.nho);
  const rv = b * RV_HE;
  const X = W / 2;
  const Y = H / 2;

  // DOC bo cuc truoc, GHI sau: doc hop cua tung dong chu roi moi dung the va gan vao cay, de khong bat trinh duyet
  // tinh lai bo cuc giua chung (mot lan tinh lai o day la mot khung hinh tre ngay dau hieu ung).
  const kr = khung.getBoundingClientRect();
  const treCua = (el: HTMLElement): number => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - kr.left - X, 0, X - (r.right - kr.left));
    const dy = Math.max(r.top - kr.top - Y, 0, Y - (r.bottom - kr.top));
    return Math.round(lanF(tien(Math.hypot(dx, dy), W, H, rv)) * CUA_MS);
  };
  const treMoi = m.chuMoi.map(treCua);
  const treCu = m.chuCu.map(treCua);

  // Lan loang truoc cua chinh dai troi nay chua tan (nguoi dung thay tam trang hai lan lien, hay tab bi an dung luc no
  // lan): go han no truoc khi dung lan moi, khong de hai lop loang chong len nhau.
  donLan(w);

  const cua = new Set<Animation>();
  const lop = document.createElement("div");
  lop.className = m.nho ? `loang loang--nho troi--${m.kieu}` : `loang troi--${m.kieu}`;
  lop.setAttribute("aria-hidden", "true");
  for (const g of luoiGiot(W, H, b, hatTu(m.kieu, b))) {
    const o = document.createElement("div");
    o.className = "giot";
    const d = (g.r * 2).toFixed(1);
    o.style.cssText = `left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px;width:${d}px;height:${d}px`;
    const n = document.createElement("div");
    n.className = "giot__nen";
    n.style.cssText = `background-size:${W}px ${H}px;background-position:${(-g.x).toFixed(1)}px ${(-g.y).toFixed(1)}px`;
    o.append(n);
    lop.append(o);
    ghi(w, cua, o.animate(KHUNG_NGOAI, { duration: g.dai, delay: g.tre, fill: "both" }));
    ghi(w, cua, n.animate(KHUNG_TRONG, { duration: g.dai, delay: g.tre, fill: "both" }));
  }
  khung.append(lop);
  const lan: Lan = { lop, cua };
  lanCua.set(w, lan);

  // Chu cua troi cu tan di dung luc mep loang di qua dong do; chu cua troi moi hien ngay sau mep, nen dai troi khong
  // bao gio trong chu lau (phan quyet 23).
  m.chuCu.forEach((el, i) => {
    ghi(w, cua, el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: CU_MS, delay: treCu[i], easing: "ease-in", fill: "forwards",
    }));
  });
  m.chuMoi.forEach((el, i) => {
    ghi(w, cua, el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: CHU_MS, delay: treMoi[i] + CHU_TRE_MS, easing: "ease-out", fill: "backwards",
    }));
  });
  // Net ve cua troi moi hien lai o cuoi. fill "backwards" giu chung trong suot suot do tre, nen khong can dat opacity
  // noi tuyen roi xoa di nhu ban mau ky thuat - va tuyet doi khong duoc tat the .troi__nen bao ngoai chung (M1).
  for (const el of m.net) {
    ghi(w, cua, el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: NEN_MS, delay: NEN_TRE_MS, easing: "ease-out", fill: "backwards",
    }));
  }

  hen(w, () => {
    // Mot lan loang moi da go han lan nay tu truoc: khong dung toi trang thai cua lan dang chay.
    if (lanCua.get(w) !== lan) return;
    // Don trong CUNG mot luot: trao trang thai (nguoi goi go troi cu va lop troi--dang-loang), roi go lop loang.
    xong();
    donLan(w);
  }, LOANG_HET_MS);
}
