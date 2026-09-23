import {
  CHU_MS, KINH_MS, KINH_TRE_MS, NUT_KHUNG, NUT_MS, SONG_EASE, SONG_HET, SONG_MS, TOE, TOE_MS, treChu, VONG,
} from "@/lib/tam-trang/song-nhip";

/*
 * Doi cho hai bau troi cua dai "O cua so" bang mot vong song nuoc lan tu tam o cua so.
 *
 * Vi sao lam thang tren DOM chu khong qua trang thai React: khung hinh dau tien phai co ngay khi ngon tay an xuong.
 * Ca hai bau troi da ve san va xep chong trong CUNG mot o luoi, nen doi cho chi la bat/tat lop va chay hoat hinh:
 * khong dung lai cay DOM, khong doc bo cuc trong lan bam (bo cuc do san luc ranh, do lai khi doi kich thuoc hay khi
 * font tai xong), khong doi chieu cao dai troi (khong xo dich gi ben duoi).
 *
 * Troi dang an duoc cat ve 0 bang clip-path chu khong phai visibility: bo an chi con la hoat hinh clip-path cua dung
 * mot phan tu, khong phai tinh lai style ke thua cho hang tram net ve ben trong. Cac viec nang khac (inert, aria-hidden,
 * doi focus, loi bao) doi qua khung hinh dau tien roi moi lam.
 *
 * Khong dung backdrop-filter hay feDisplacementMap cho gon song: tren Chromium ca hai ve ra chu lat nguoc va gay tac
 * nghen dai; gon song o day la mot dai sang toi ve bang mix-blend-mode: soft-light (xem .song-lup trong tam-trang.css).
 */

/** Hinh hoc do san cua mot mat troi: tam song, ban kinh phu kin dai, o cua so, khoang cach toi tung dong chu. */
export type MatHinh = {
  X: number; Y: number; R: number; rk: number;
  kl: number; kt: number; kw: number; kh: number;
  chu: number[];
};
export type HinhDai = { W: number; H: number; mat: Record<string, MatHinh> };

const hinhCua = new WeakMap<HTMLElement, HinhDai>();
const dangSong = new WeakSet<HTMLElement>();

/** Do bo cuc cua mot dai troi va nho lai. Goi luc ranh, khong bao gio goi trong lan bam. */
export function doHinh(w: HTMLElement): HinhDai {
  const wr = w.getBoundingClientRect();
  const W = w.offsetWidth;
  const H = w.offsetHeight;
  const cacMat: Record<string, MatHinh> = {};
  for (const sec of w.querySelectorAll<HTMLElement>(".troi[data-mat]")) {
    const kinh = sec.querySelector<HTMLElement>(".cua-so__kinh");
    const ten = sec.dataset.mat;
    if (kinh === null || ten === undefined) continue;
    const kr = kinh.getBoundingClientRect();
    const X = Math.round(kr.left + kr.width / 2 - wr.left);
    const Y = Math.round(kr.top + kr.height / 2 - wr.top);
    const R = Math.ceil(Math.max(Math.hypot(X, Y), Math.hypot(W - X, Y), Math.hypot(X, H - Y), Math.hypot(W - X, H - Y))) + 4;
    const chu = [...sec.querySelectorAll<HTMLElement>(".troi__noi > *")].map((el) => {
      const r = el.getBoundingClientRect();
      return Math.hypot(
        Math.max(r.left - wr.left - X, 0, X - (r.right - wr.left)),
        Math.max(r.top - wr.top - Y, 0, Y - (r.bottom - wr.top)),
      );
    });
    cacMat[ten] = { X, Y, R, rk: kr.width / 2, kl: kinh.offsetLeft, kt: kinh.offsetTop, kw: kinh.offsetWidth, kh: kinh.offsetHeight, chu };
  }
  const h = { W, H, mat: cacMat };
  hinhCua.set(w, h);
  return h;
}

function hinhSan(w: HTMLElement): HinhDai {
  return hinhCua.get(w) ?? doHinh(w);
}

/** Mot lop tam cua song: chi hinh, an voi trinh doc man hinh. Kich thuoc dat thang tren phan tu (tao bang tay, khong phai JSX). */
function lop(cls: string, x: number, y: number, w: number, h: number): HTMLElement {
  const d = document.createElement("div");
  d.className = cls;
  d.setAttribute("aria-hidden", "true");
  d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  return d;
}

function mat(sec: Element | null): string {
  return sec instanceof HTMLElement ? sec.dataset.mat ?? "" : "";
}

/** Mot vong song lan tu o cua so cua mat troi sap hien, phu kin dai troi. */
function songLan(w: HTMLElement, vao: HTMLElement, ra: HTMLElement, g: MatHinh, W: number, H: number): void {
  const nut = vao.querySelector<HTMLElement>(".cua-so");
  const kinhCu = ra.querySelector<HTMLElement>(".cua-so__kinh");
  if (nut === null || kinhCu === null) return;
  const kinh = nut.querySelector<HTMLElement>(".cua-so__kinh");
  if (kinh === null) return;
  const { X, Y, R, rk } = g;
  const r0 = Math.round(rk + 6);
  const s0 = (r0 / R).toFixed(4);
  const tam = ` at ${X}px ${Y}px)`;
  const don: HTMLElement[] = [];

  // Troi moi lo ra theo mep song, bat dau ngay tu vien o cua so: khung hinh dau tien da thay doi.
  vao.classList.add("troi--dang-song");
  const song = vao.animate(
    [{ clipPath: `circle(${r0}px${tam}` }, { clipPath: `circle(${R}px${tam}` }],
    { duration: SONG_MS, easing: SONG_EASE },
  );

  // Chu cua troi moi hien dan dung luc mep song di qua tung dong (khoang cach da do san).
  [...vao.querySelectorAll<HTMLElement>(".troi__noi > *")].forEach((el, i) => {
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: CHU_MS, delay: treChu(g.chu[i] ?? 0, r0, R), easing: "ease-out", fill: "backwards",
    });
  });

  const vong = lop(`song-vong troi--${vao.dataset.k ?? ""}`, 0, 0, W, H);
  const tron = (cls: string, r: number) => {
    const o = lop(cls, X - r, Y - r, 2 * r, 2 * r);
    vong.append(o);
    return o;
  };
  const lan = [{ transform: `scale(${s0})` }, { transform: "scale(1)" }];

  // 1. Gon song khuc xa chay cung mep song: lung tram, dinh sang, diu dan rat cham.
  const lup = tron("song-lup", R);
  lup.animate(lan, { duration: SONG_MS, easing: SONG_EASE, fill: "both" });
  lup.animate([{ opacity: 0 }, { opacity: 1, offset: 0.04 }, { opacity: 0.8, offset: 0.5 }, { opacity: 0 }], { duration: SONG_MS, easing: "linear", fill: "both" });
  // 2. Anh sang mong tren dinh song.
  const bong = tron("song-bong", R);
  bong.animate(lan, { duration: SONG_MS, easing: SONG_EASE, fill: "both" });
  bong.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.05 }, { opacity: 0.6, offset: 0.42 }, { opacity: 0 }], { duration: SONG_MS, easing: "linear", fill: "both" });
  // 3. Vong chinh o mep song va ba vong phu cham hon, tat dan nhu giot nuoc roi xuong ao.
  for (const [tre, dai, cuoi, dam] of VONG) {
    const o = tron("song-vong__o", R);
    o.animate([{ transform: `scale(${s0})` }, { transform: `scale(${cuoi})` }], { duration: dai, delay: tre, easing: SONG_EASE, fill: "both" });
    o.animate([{ opacity: 0 }, { opacity: dam, offset: 0.06 }, { opacity: dam * 0.55, offset: 0.5 }, { opacity: 0 }], { duration: dai, delay: tre, easing: "linear", fill: "both" });
  }
  // 4. Toe o tam: vai vong nho bat ra tu o cua so roi lang.
  const S2 = rk * 3;
  TOE.forEach(([tre, dam], i) => {
    const o = tron("song-giot", S2);
    o.animate(
      [{ transform: `scale(${((rk + 5) / S2).toFixed(3)})`, opacity: 0 }, { opacity: dam, offset: 0.14 }, { transform: `scale(${(1 - i * 0.15).toFixed(2)})`, opacity: 0 }],
      { duration: TOE_MS, delay: tre, easing: "cubic-bezier(0.25, 0.6, 0.3, 1)", fill: "both" },
    );
  });
  w.append(vong);
  don.push(vong);

  // O cua so nay nhe nhu mat nuoc vua bi cham (chi transform, khong doi bo cuc).
  nut.style.transformOrigin = `50% ${g.kt + g.kh / 2}px`;
  nut.animate([...NUT_KHUNG], { duration: NUT_MS, easing: "ease-in-out" });

  // Trong o cua so: kinh cu nam duoi, troi moi lan ra tu tam kem mot vong nuoc nho.
  const kc = kinhCu.cloneNode(true) as HTMLElement;
  kc.classList.add("song-kinh-cu");
  kc.style.left = `${g.kl}px`;
  kc.style.top = `${g.kt}px`;
  nut.insertBefore(kc, nut.firstChild);
  kinh.animate([{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }], { duration: KINH_MS, delay: KINH_TRE_MS, easing: "cubic-bezier(0.3, 0.2, 0.25, 1)", fill: "backwards" });
  // Vong nuoc nho trong o cua so mang mau troi vua lui ve o (dung troi trong kinh moi).
  const kv = lop(`song-kinh-vong troi--${ra.dataset.k ?? ""}`, g.kl, g.kt, g.kw, g.kh);
  nut.append(kv);
  don.push(kv);
  kv.animate([{ transform: "scale(.25)", opacity: 0 }, { transform: "scale(.8)", opacity: 0.7, offset: 0.3 }, { transform: "scale(1.45)", opacity: 0 }], { duration: KINH_MS, delay: KINH_TRE_MS, easing: "cubic-bezier(0.3, 0.6, 0.35, 1)", fill: "both" });
  nut.querySelector(".cua-so__chu")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 200, easing: "ease-out", fill: "backwards" });

  // Song phu kin dai troi: an troi cu, bo lop tam; cac vong tre hon tan het roi moi go.
  const xong = () => {
    vao.classList.remove("troi--an", "troi--dang-song");
    ra.classList.add("troi--an");
    kc.remove();
    w.classList.remove("troi-cua-so--san");
  };
  song.addEventListener("finish", xong);
  song.addEventListener("cancel", xong);
  setTimeout(() => {
    for (const e of don) e.remove();
    nut.style.transformOrigin = "";
  }, SONG_HET);
}

/** Troi dang hien va troi dang an cua mot dai. */
function haiMat(w: HTMLElement): { hien: HTMLElement; an: HTMLElement } | null {
  const hien = w.querySelector<HTMLElement>(".troi[data-mat]:not(.troi--an)");
  const an = w.querySelector<HTMLElement>(".troi[data-mat].troi--an");
  return hien !== null && an !== null ? { hien, an } : null;
}

const giamChuyenDong = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Doi cho hai bau troi. banPhim = true khi nguoi dung bam bang Enter hay dau cach: chi khi do vong focus moi hien
 * (bam chuot thi khong, dung luat :focus-visible cua ca web).
 */
export function doiTroi(w: HTMLElement, banPhim: boolean): void {
  if (dangSong.has(w)) return;
  const cap = haiMat(w);
  if (cap === null) return;
  const { hien, an } = cap;
  const tinh = giamChuyenDong();

  // Viec nang (inert, aria-hidden, focus, loi bao) doi qua khung hinh dau tien; khung dau chi co viec bat song.
  const tiep = () => {
    hien.setAttribute("inert", "");
    hien.setAttribute("aria-hidden", "true");
    an.removeAttribute("inert");
    an.removeAttribute("aria-hidden");
    const nut = an.querySelector<HTMLElement>(".cua-so");
    if (nut !== null) {
      nut.classList.toggle("cua-so--im", !banPhim);
      nut.focus({ preventScroll: true });
    }
    const bao = w.querySelector<HTMLElement>(".troi-cua-so__bao");
    if (bao !== null) bao.textContent = an.dataset.bao ?? "";
  };

  if (tinh) {
    an.classList.remove("troi--an");
    hien.classList.add("troi--an");
    tiep();
    return;
  }

  const h = hinhSan(w);
  const g = h.mat[mat(an)];
  if (g === undefined) return;
  an.classList.remove("troi--an");
  songLan(w, an, hien, g, h.W, h.H);
  requestAnimationFrame(() => setTimeout(tiep, 0));
  dangSong.add(w);
  // Nha khoa dung luc cac lop tam cua vong song nay bi go (SONG_HET), khong phai luc song chinh vua xong: neu nha som
  // hon, mot vong song moi kip bat dau roi bi cai hen don dep cua vong cu xoa transformOrigin ngay giua chung.
  setTimeout(() => dangSong.delete(w), SONG_HET);
}

/**
 * Gan cac tay nghe cua mot dai troi co o cua so. Tra ve ham go, de thanh phan React don sach khi roi trang.
 * Bam bang chuot hay cham: bat song ngay tu pointerdown, khong doi nha tay. Ban phim: su kien click (detail = 0).
 */
export function ganSong(w: HTMLElement): () => void {
  const doLaiKhiRanh = () => {
    const chay = () => {
      if (w.isConnected && w.offsetWidth > 0) doHinh(w);
    };
    if (typeof globalThis.requestIdleCallback === "function") globalThis.requestIdleCallback(chay, { timeout: 400 });
    else setTimeout(chay, 120);
  };

  const anXuong = (ev: PointerEvent) => {
    if (ev.button !== 0 || !ev.isPrimary) return;
    if (!(ev.target instanceof Element) || ev.target.closest(".cua-so") === null) return;
    // Khong de trinh duyet tu doi focus theo lan bam: doiTroi se dat focus vao o cua so cua troi vua hien.
    ev.preventDefault();
    doiTroi(w, false);
  };
  const bamPhim = (ev: MouseEvent) => {
    // Chuot va cham da doi cho o pointerdown; click con lai la cua ban phim (Enter, dau cach).
    if (ev.detail !== 0) return;
    if (!(ev.target instanceof Element) || ev.target.closest(".cua-so") === null) return;
    doiTroi(w, true);
  };
  // Troi dang an tam dung net ve cho may do thong; con tro hay focus toi gan o cua so thi cho chay lai truoc.
  const lamNong = () => w.classList.add("troi-cua-so--san");
  // Trong luc song lan, Chromium do trung nham va bo focus khoi nut; chan mousedown trong dai de focus o yen.
  const giuFocus = (ev: MouseEvent) => {
    if (dangSong.has(w) && ev.target instanceof Element && ev.target.closest(".troi-cua-so") === w) ev.preventDefault();
  };
  // Dung ban phim tro lai thi vong focus xuat hien nhu thuong.
  const phim = () => {
    for (const n of w.querySelectorAll(".cua-so--im")) n.classList.remove("cua-so--im");
  };
  const doiKhung = () => {
    hinhCua.delete(w);
    doLaiKhiRanh();
  };

  w.addEventListener("pointerdown", anXuong);
  w.addEventListener("click", bamPhim);
  w.addEventListener("pointerover", lamNong);
  w.addEventListener("focusin", lamNong);
  document.addEventListener("mousedown", giuFocus);
  document.addEventListener("keydown", phim);
  globalThis.addEventListener("resize", doiKhung);
  doLaiKhiRanh();
  document.fonts?.ready.then(doLaiKhiRanh, () => undefined);

  return () => {
    w.removeEventListener("pointerdown", anXuong);
    w.removeEventListener("click", bamPhim);
    w.removeEventListener("pointerover", lamNong);
    w.removeEventListener("focusin", lamNong);
    document.removeEventListener("mousedown", giuFocus);
    document.removeEventListener("keydown", phim);
    globalThis.removeEventListener("resize", doiKhung);
  };
}
