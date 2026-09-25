import {
  CHU_MS, KINH_MS, KINH_TRE_MS, NUT_KHUNG, NUT_MS, SONG_EASE, SONG_HET, SONG_MS, TOE, TOE_MS, treChu, VONG,
} from "@/lib/tam-trang/song-nhip";
import { chuDai, dongChu, ghi, giamChuyenDong, giuDai, goViec, hen, nhaDai, SONG, viec } from "./hieu-ung-chung";

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

/**
 * Cham tay gui ca pointerdown lan click, va click cua cham cung mang detail = 0 y nhu click cua ban phim. Khi nguoi
 * dung xin giam chuyen dong thi doi cho xong ngay, khong co vong song nao giu khoa, nen phai khoa tay trong khoang nay
 * de mot lan cham khong doi cho hai lan.
 */
const KHOA_TINH_MS = 500;

/** Hinh hoc do san cua mot mat troi: tam song, ban kinh phu kin dai, o cua so, khoang cach toi tung dong chu. */
export type MatHinh = {
  X: number; Y: number; R: number; rk: number;
  kl: number; kt: number; kw: number; kh: number;
  chu: number[];
};
export type HinhDai = {
  W: number; H: number;
  mat: Record<string, MatHinh>;
  /**
   * Ban sao roi cua o kinh tung mat, nhan ban san luc ranh. O kinh nang nhat (mua rao) la 100 phan tu, nhan ban no ton
   * 4.46ms ngay trong jsdom (do 2000 lan, xem bao cao Task 7): qua dat de lam trong lan bam, ma lan bam phai ra khung
   * hinh dau tien ngay. Noi dung o kinh chi phu thuoc kieu troi, nen ban sao dung duoc mai cho toi khi kieu troi doi;
   * songLan doi chieu lop CSS truoc khi dung, khong khop thi moi nhan ban tai cho.
   */
  kinh: Record<string, HTMLElement>;
};

const hinhCua = new WeakMap<HTMLElement, HinhDai>();

/**
 * Bao nguoc len React: mat nao (data-mat) vua thanh troi lon.
 *
 * "Mat nao dang lon" la trang thai chay cua lan doi cho, nhung thuoc tinh `class` lai thuoc ve React: moi lan doi tam
 * trang, React ghi lai ca chuoi class tu JSX, ma trong JSX mat "minh" luon nhan `an`. Neu ai do doc lop `troi--an` ra
 * de suy trang thai thi ho doc dung gia tri vua bi ghi de. Nen chi co MOT nguon su that, va no nam ben React
 * (BauTroi.tsx); day la duong bao len do (phan quyet M2).
 */
const baoMat = new WeakMap<HTMLElement, (ten: string) => void>();

/** Do bo cuc cua mot dai troi va nho lai. Goi luc ranh, khong bao gio goi trong lan bam. */
export function doHinh(w: HTMLElement): HinhDai {
  const wr = w.getBoundingClientRect();
  const W = w.offsetWidth;
  const H = w.offsetHeight;
  const cacMat: Record<string, MatHinh> = {};
  const cacKinh: Record<string, HTMLElement> = {};
  for (const sec of w.querySelectorAll<HTMLElement>(".troi[data-mat]")) {
    // Trong mot lan loang o cua so co hai o kinh xep chong: bo qua o kinh cu, do o kinh dang song (phat hien N1).
    const kinh = sec.querySelector<HTMLElement>(".cua-so__kinh:not(.cua-so__kinh--cu)");
    const ten = sec.dataset.mat;
    if (kinh === null || ten === undefined) continue;
    const kr = kinh.getBoundingClientRect();
    const X = Math.round(kr.left + kr.width / 2 - wr.left);
    const Y = Math.round(kr.top + kr.height / 2 - wr.top);
    const R = Math.ceil(Math.max(Math.hypot(X, Y), Math.hypot(W - X, Y), Math.hypot(X, H - Y), Math.hypot(W - X, H - Y))) + 4;
    const chu = dongChu(sec).map((el) => {
      const r = el.getBoundingClientRect();
      return Math.hypot(
        Math.max(r.left - wr.left - X, 0, X - (r.right - wr.left)),
        Math.max(r.top - wr.top - Y, 0, Y - (r.bottom - wr.top)),
      );
    });
    cacMat[ten] = { X, Y, R, rk: kr.width / 2, kl: kinh.offsetLeft, kt: kinh.offsetTop, kw: kinh.offsetWidth, kh: kinh.offsetHeight, chu };
    cacKinh[ten] = banSaoKinh(kinh);
  }
  const h = { W, H, mat: cacMat, kinh: cacKinh };
  hinhCua.set(w, h);
  return h;
}

/** Ban sao roi cua mot o kinh, san sang chen xuong duoi o kinh moi trong lan doi cho. */
function banSaoKinh(kinh: HTMLElement): HTMLElement {
  const kc = kinh.cloneNode(true) as HTMLElement;
  kc.classList.add("song-kinh-cu");
  return kc;
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
function songLan(w: HTMLElement, vao: HTMLElement, ra: HTMLElement, h: HinhDai): void {
  // Song lan tu tam o cua so cua chinh troi sap hien (vao): do la cho ngon tay vua cham vao.
  const g = h.mat[mat(vao)];
  const nut = vao.querySelector<HTMLElement>(".cua-so");
  const kinhCu = ra.querySelector<HTMLElement>(".cua-so__kinh");
  if (g === undefined || nut === null || kinhCu === null) return;
  const kinh = nut.querySelector<HTMLElement>(".cua-so__kinh");
  if (kinh === null) return;
  const { W, H } = h;
  const { X, Y, R, rk } = g;
  const r0 = Math.round(rk + 6);
  const s0 = (r0 / R).toFixed(4);
  const tam = ` at ${X}px ${Y}px)`;
  const don: HTMLElement[] = [];
  /** Hoat hinh cua RIENG vong song nay, de tra lai so chung khi no tan (xem ghi()). */
  const cua = new Set<Animation>();

  // Vong song truoc con sot hoat hinh chua chay xong (vd tab bi an dung luc no lan, trinh duyet khong bao finish): huy
  // va bo han truoc khi ghi vong moi. Cac xong() cu da chay roi va deu tu khoa lai, nen su kien cancel o day khong the
  // keo trang thai cu ve nua.
  const v = viec(w);
  for (const a of v.hoat) a.cancel();
  v.hoat.length = 0;

  // Troi moi lo ra theo mep song, bat dau ngay tu vien o cua so: khung hinh dau tien da thay doi.
  vao.classList.add("troi--dang-song");
  const song = vao.animate(
    [{ clipPath: `circle(${r0}px${tam}` }, { clipPath: `circle(${R}px${tam}` }],
    { duration: SONG_MS, easing: SONG_EASE },
  );
  ghi(w, cua, song);

  // Chu cua troi moi hien dan dung luc mep song di qua tung dong (khoang cach da do san).
  dongChu(vao).forEach((el, i) => {
    ghi(w, cua, el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: CHU_MS, delay: treChu(g.chu[i] ?? 0, r0, R), easing: "ease-out", fill: "backwards",
    }));
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
  ghi(w, cua, lup.animate(lan, { duration: SONG_MS, easing: SONG_EASE, fill: "both" }));
  ghi(w, cua, lup.animate([{ opacity: 0 }, { opacity: 1, offset: 0.04 }, { opacity: 0.8, offset: 0.5 }, { opacity: 0 }], { duration: SONG_MS, easing: "linear", fill: "both" }));
  // 2. Anh sang mong tren dinh song.
  const bong = tron("song-bong", R);
  ghi(w, cua, bong.animate(lan, { duration: SONG_MS, easing: SONG_EASE, fill: "both" }));
  ghi(w, cua, bong.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.05 }, { opacity: 0.6, offset: 0.42 }, { opacity: 0 }], { duration: SONG_MS, easing: "linear", fill: "both" }));
  // 3. Vong chinh o mep song va ba vong phu cham hon, tat dan nhu giot nuoc roi xuong ao.
  for (const [tre, dai, cuoi, dam] of VONG) {
    const o = tron("song-vong__o", R);
    ghi(w, cua, o.animate([{ transform: `scale(${s0})` }, { transform: `scale(${cuoi})` }], { duration: dai, delay: tre, easing: SONG_EASE, fill: "both" }));
    ghi(w, cua, o.animate([{ opacity: 0 }, { opacity: dam, offset: 0.06 }, { opacity: dam * 0.55, offset: 0.5 }, { opacity: 0 }], { duration: dai, delay: tre, easing: "linear", fill: "both" }));
  }
  // 4. Toe o tam: vai vong nho bat ra tu o cua so roi lang.
  const S2 = rk * 3;
  TOE.forEach(([tre, dam], i) => {
    const o = tron("song-giot", S2);
    ghi(w, cua, o.animate(
      [{ transform: `scale(${((rk + 5) / S2).toFixed(3)})`, opacity: 0 }, { opacity: dam, offset: 0.14 }, { transform: `scale(${(1 - i * 0.15).toFixed(2)})`, opacity: 0 }],
      { duration: TOE_MS, delay: tre, easing: "cubic-bezier(0.25, 0.6, 0.3, 1)", fill: "both" },
    ));
  });
  w.append(vong);
  don.push(vong);

  // O cua so nay nhe nhu mat nuoc vua bi cham (chi transform, khong doi bo cuc).
  nut.style.transformOrigin = `50% ${g.kt + g.kh / 2}px`;
  ghi(w, cua, nut.animate([...NUT_KHUNG], { duration: NUT_MS, easing: "ease-in-out" }));

  // Trong o cua so: kinh cu nam duoi, troi moi lan ra tu tam kem mot vong nuoc nho. Ban sao da lam san luc ranh; chi khi
  // kieu troi vua doi (lop CSS khong con khop) moi phai nhan ban tai cho.
  const san = h.kinh[mat(ra)];
  const kc = san !== undefined && san.className === `${kinhCu.className} song-kinh-cu` ? san : banSaoKinh(kinhCu);
  kc.style.left = `${g.kl}px`;
  kc.style.top = `${g.kt}px`;
  nut.insertBefore(kc, nut.firstChild);
  ghi(w, cua, kinh.animate([{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }], { duration: KINH_MS, delay: KINH_TRE_MS, easing: "cubic-bezier(0.3, 0.2, 0.25, 1)", fill: "backwards" }));
  // Vong nuoc nho trong o cua so mang mau troi vua lui ve o (dung troi trong kinh moi).
  const kv = lop(`song-kinh-vong troi--${ra.dataset.k ?? ""}`, g.kl, g.kt, g.kw, g.kh);
  nut.append(kv);
  don.push(kv);
  ghi(w, cua, kv.animate([{ transform: "scale(.25)", opacity: 0 }, { transform: "scale(.8)", opacity: 0.7, offset: 0.3 }, { transform: "scale(1.45)", opacity: 0 }], { duration: KINH_MS, delay: KINH_TRE_MS, easing: "cubic-bezier(0.3, 0.6, 0.35, 1)", fill: "both" }));
  ghi(w, cua, nut.querySelector(".cua-so__chu")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 200, easing: "ease-out", fill: "backwards" }));

  // Song phu kin dai troi: an troi cu, bo lop tam; cac vong tre hon tan het roi moi go. Chi lam DUNG MOT LAN: cai hen
  // SONG_HET goi lai de phong truong hop khong co su kien finish, va huy hoat hinh (luc roi trang, hay luc mot vong
  // song moi bat dau) lai ban ra su kien cancel - khong khoa lai thi mot vong song cu co the keo hai bau troi ve
  // trang thai cu ngay giua vong song moi.
  let daXong = false;
  const xong = () => {
    if (daXong) return;
    daXong = true;
    vao.classList.remove("troi--an", "troi--dang-song");
    ra.classList.add("troi--an");
    kc.remove();
    w.classList.remove("troi-cua-so--san");
  };
  song.addEventListener("finish", xong);
  song.addEventListener("cancel", xong);
  hen(w, () => {
    // Goi lai xong() o day chu khong chi tin vao su kien finish: neu trinh duyet khong bao finish (tab bi an ngay luc
    // song bat dau, hoat hinh bi thay the), dai troi se ket o nua chung voi hai troi cung hien.
    xong();
    for (const e of don) e.remove();
    nut.style.transformOrigin = "";
    // Vong song nay da tan: tra so chung ve dung nhung gi con chay that. Khong huy nhung cai con chay o day - dong chu
    // xa tam song nhat co the hien muon hon SONG_HET mot chut, huy la giat mat no; chung se bi huy o vong song ke tiep
    // hoac o ham go. Cac lop tam da roi khoi cay DOM ngay tren, nen khong con gi giu phan tu da go nua.
    viec(w).hoat = viec(w).hoat.filter((a) => !cua.has(a) || a.playState === "running");
    cua.clear();
  }, SONG_HET);
}

/** Troi dang hien va troi dang an cua mot dai. */
function haiMat(w: HTMLElement): { hien: HTMLElement; an: HTMLElement } | null {
  const hien = w.querySelector<HTMLElement>(".troi[data-mat]:not(.troi--an)");
  const an = w.querySelector<HTMLElement>(".troi[data-mat].troi--an");
  return hien !== null && an !== null ? { hien, an } : null;
}

/**
 * Doi cho hai bau troi. banPhim = true khi nguoi dung bam bang Enter hay dau cach: chi khi do vong focus moi hien
 * (bam chuot thi khong, dung luat :focus-visible cua ca web).
 */
export function doiTroi(w: HTMLElement, banPhim: boolean): void {
  // Dai nay dang co mot hieu ung chay - mot vong song truoc, hay mot lan loang khi thay tam trang - thi bo qua lan
  // bam: hai hieu ung ve chong len nhau la ca hai cung hong (phat hien N1).
  if (chuDai(w) !== undefined) return;
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
    w.classList.remove("troi-cua-so--san");
    baoMat.get(w)?.(mat(an));
    tiep();
    giuDai(w, SONG);
    hen(w, () => nhaDai(w, SONG), KHOA_TINH_MS);
    return;
  }

  const h = hinhSan(w);
  if (h.mat[mat(an)] === undefined) return;
  an.classList.remove("troi--an");
  baoMat.get(w)?.(mat(an));
  songLan(w, an, hien, h);
  const v = viec(w);
  const id = requestAnimationFrame(() => {
    v.khung.delete(id);
    hen(w, tiep, 0);
  });
  v.khung.add(id);
  giuDai(w, SONG);
  // Nha khoa dung luc cac lop tam cua vong song nay bi go (SONG_HET), khong phai luc song chinh vua xong: neu nha som
  // hon, mot vong song moi kip bat dau roi bi cai hen don dep cua vong cu xoa transformOrigin ngay giua chung.
  hen(w, () => nhaDai(w, SONG), SONG_HET);
}

/**
 * Gan cac tay nghe cua mot dai troi co o cua so. Tra ve ham go, de thanh phan React don sach khi roi trang.
 * Bam bang chuot hay cham: bat song ngay tu pointerdown, khong doi nha tay. Ban phim: su kien click (detail = 0).
 *
 * `baoDoiMat` nhan ten mat (data-mat) vua thanh troi lon, ngay o khung hinh dau cua lan doi cho: xem baoMat o tren.
 */
export function ganSong(w: HTMLElement, baoDoiMat: (ten: string) => void): () => void {
  baoMat.set(w, baoDoiMat);
  const doLaiKhiRanh = () => {
    if (!w.isConnected) return;
    const chay = () => {
      // Khong do lai giua luc mot hieu ung dang ve len dai: o kinh luc do dang bi mot vong song keo hay dang mang
      // lop loang, tuc so do lay ve khong phai so do luc nghi.
      if (w.isConnected && w.offsetWidth > 0 && chuDai(w) === undefined) doHinh(w);
    };
    if (typeof globalThis.requestIdleCallback === "function") {
      const v = viec(w);
      const id = globalThis.requestIdleCallback(() => {
        v.ranh.delete(id);
        chay();
      }, { timeout: 400 });
      v.ranh.add(id);
    } else hen(w, chay, 120);
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
  // Troi dang an tam dung net ve cho may do thong; chi khi con tro hay focus toi DUNG o cua so moi cho chay lai, va bo
  // ngay khi roi o: quet chuot ngang qua dai troi khong duoc de lai gan hai tram hoat hinh chay tiep suot doi trang.
  const trongO = (x: EventTarget | null) => x instanceof Element && w.contains(x) && x.closest(".cua-so") !== null;
  const lamNong = (ev: Event) => {
    if (trongO(ev.target)) w.classList.add("troi-cua-so--san");
  };
  const nguoi = (ev: PointerEvent | FocusEvent) => {
    // Van con trong o cua so (di giua cac phan tu con) thi giu nguyen; dang lan song thi de xong() go.
    if (trongO(ev.relatedTarget) || chuDai(w) === SONG) return;
    w.classList.remove("troi-cua-so--san");
  };
  // Trong luc song lan, Chromium do trung nham va bo focus khoi nut: cu bam roi xuong <main> vi dai troi moi dang chay
  // hoat hinh clip-path. Chan mousedown o ca hai cho (dai troi va <main>) de focus o yen tren o cua so.
  const giuFocus = (ev: MouseEvent) => {
    if (chuDai(w) !== SONG || !(ev.target instanceof Element)) return;
    if (ev.target.tagName === "MAIN" || ev.target.closest(".troi-cua-so") === w) ev.preventDefault();
  };
  // Dung ban phim tro lai thi vong focus xuat hien nhu thuong.
  const phim = () => {
    for (const n of w.querySelectorAll(".cua-so--im")) n.classList.remove("cua-so--im");
  };
  // Doi kich thuoc: do LAI luc ranh, KHONG xoa so do cu truoc. So do cu lech vai diem anh van dung duoc cho mot vong
  // song, con xoa no di thi lan bam ke tiep phai do bo cuc ngay trong tay nghe, dung dieu ma dai nay phai tranh.
  const doiKhung = () => doLaiKhiRanh();

  w.addEventListener("pointerdown", anXuong);
  w.addEventListener("click", bamPhim);
  w.addEventListener("pointerover", lamNong);
  w.addEventListener("pointerout", nguoi);
  w.addEventListener("focusin", lamNong);
  w.addEventListener("focusout", nguoi);
  document.addEventListener("mousedown", giuFocus);
  document.addEventListener("keydown", phim);
  globalThis.addEventListener("resize", doiKhung);
  doLaiKhiRanh();
  document.fonts?.ready.then(doLaiKhiRanh, () => undefined);

  return () => {
    w.removeEventListener("pointerdown", anXuong);
    w.removeEventListener("click", bamPhim);
    w.removeEventListener("pointerover", lamNong);
    w.removeEventListener("pointerout", nguoi);
    w.removeEventListener("focusin", lamNong);
    w.removeEventListener("focusout", nguoi);
    document.removeEventListener("mousedown", giuFocus);
    document.removeEventListener("keydown", phim);
    globalThis.removeEventListener("resize", doiKhung);
    // Roi trang giua luc song dang lan: huy moi hen gio, khung hinh, lan do bo cuc va hoat hinh dang cho, roi nha khoa.
    goViec(w);
    hinhCua.delete(w);
    baoMat.delete(w);
  };
}
