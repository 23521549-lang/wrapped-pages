/*
 * Nhip cua hieu ung C ("giay tham nuoc") khi THAY mot tam trang. Ham thuan, khong cham DOM: chi cac con so, hai day
 * khung hinh dung chung cho moi vet nuoc, va luoi vet. So lieu chep dung ban mau da duyet (mockup-c-khap-noi phan I),
 * khong tu che lai cai nao - tru dung mot cho da ghi ro ly do o `hatTu`.
 *
 * Vi sao moi vet la mot the deo san mot mat na radial-gradient TINH va chi chay transform + opacity: mat na SVG gan
 * len mot the HTML thi Safari khong cat hinh duoc (ban duyet vong mot co san hai o nhin bang mat de chung minh), va
 * gia neu lam sai la tren iPhone ca dai troi bien thanh may chuc hinh vuong dac - tuc hong han voi dung mot nua so
 * may cua hai nguoi dung.
 */

/** Nhip chot cua chu du an: 2,9 giay. Khong duoc lui ve cach A. */
export const LOANG_MS = 2900;
/** Don sau khi song lang han, de vet ngoai cung kip tan. */
export const DON_MS = 140;
export const LOANG_HET_MS = LOANG_MS + DON_MS;

/** Khoang cach giua hai tam vet o dai lon, diem anh. */
export const MAT_DO = 128;
/** Trong o cua so, khoang cach tam vet co theo canh ngan cua o: min(rong, cao) / O_HE. */
export const O_HE = 2.6;
/** San cua khoang cach tam vet trong o cua so, diem anh. Xem `khuonO`. */
export const O_SAN = 12;
/** Ban kinh khuon cua mot vet: du de loi dac phu kin khe giua bon vet ke nhau. */
export const RV_HE = 1.32;
/**
 * Loi dac cua mat na. Mep mem rong (1 - LOI) * rv = 0,18 * 169 = khoang 30px, dung bang be rong chuyen tiep cua
 * feGaussianBlur stdDeviation 11 o ban da duyet. De LOI thap hon thi may chuc vet nhoe vao nhau thanh mot mang bet,
 * khong con ra tung vet nuoc nua. Con so nay con duoc viet trong tam-trang.css; bai kiem giu hai cho khop nhau.
 */
export const LOI = 0.82;
/** Xo lech luoi mot chut de luoi khong lo ra thanh hang loi. */
export const JIT_HE = 0.15;
/** Ban kinh long song luc bat dau, tinh theo ban kinh khuon. */
export const R0_HE = 0.42;
/** Ti le luc mot vet vua sinh. */
export const S0 = 0.3;
/** So moc lay mau cua hai day khung hinh. */
export const MAU = 40;

/** Mot vet no trong bao lau, va cua so de rai chan vet tu trong ra. */
export const DV_MS = Math.round(LOANG_MS * 0.46);
export const CUA_MS = LOANG_MS - DV_MS;
/** Nhieu cong vao do tre cua tung vet: cong tru mot nua con so nay. */
export const NHIEU_MS = 110;
/** Chu cua troi moi hien trong bao lau, va tre them bao lau sau khi mep loang di qua dong do. */
export const CHU_MS = Math.round(LOANG_MS * 0.24);
export const CHU_TRE_MS = Math.round(DV_MS * 0.3);
/** Chu cua troi cu tan trong bao lau (phan quyet 23: tan dung luc mep loang di qua). */
export const CU_MS = Math.round(LOANG_MS * 0.2);
/** Net ve cua troi moi hien lai: thoi luong va do tre. */
export const NEN_MS = Math.round(LOANG_MS * 0.34);
export const NEN_TRE_MS = Math.round(LOANG_MS * 0.44);

/**
 * Doc mot cubic-bezier thanh ham so. Can that: phep bu ti le cua nuoc ben trong vet phai biet ti le cua khuon o
 * dung tung moc, chu khong chi biet ten duong cong. Newton tam vong roi chia doi cho chac.
 */
/*
 * Ba he so cua da thuc Bezier bac ba khi hai dau mut la 0 va 1: B(t) = heA*t^3 + heB*t^2 + heC*t. Dat o muc mo dun
 * chu khong long trong `bezier`: chung khong doc mot bien nao cua ham cha, ma long vao thi moi lan goi `bezier` lai
 * dung lai ba ham y het nhau.
 */
const heA = (a: number, b: number) => 1 - 3 * b + 3 * a;
const heB = (a: number, b: number) => 3 * b - 6 * a;
const heC = (a: number) => 3 * a;
/** Gia tri va dao ham cua da thuc tren, theo mot truc (truc x lay a = x1, b = x2; truc y lay a = y1, b = y2). */
const tinh = (t: number, a: number, b: number) => ((heA(a, b) * t + heB(a, b)) * t + heC(a)) * t;
const doc = (t: number, a: number, b: number) => 3 * heA(a, b) * t * t + 2 * heB(a, b) * t + heC(a);

export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = doc(t, x1, x2);
      if (d === 0) break;
      t -= (tinh(t, x1, x2) - x) / d;
      t = Math.min(1, Math.max(0, t));
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const v = tinh(t, x1, x2);
      if (v > x - 1e-6 && v < x + 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return tinh(t, y1, y2);
  };
}

/** Nhip no cua MOT vet. */
export const songF = bezier(0.33, 0.02, 0.3, 1);
/** Nhip mep loang chay tu tam ra ngoai. */
export const lanF = bezier(0.3, 0, 0.35, 1);

/**
 * Hai day khung hinh dung chung cho MOI vet nuoc.
 * Ngoai: scale(S0 -> 1) theo nhip songF, kem mo vao o mot phan tu dau.
 * Trong: scale(1/s) tai dung tung moc, nen tich cua hai phep luon bang 1 va manh nen troi khong bi keo gian.
 * Lay mau day roi noi thang giua hai mau: sai so ti le lon nhat duoi 0,6 phan tram, mat khong thay duoc.
 */
export const KHUNG_NGOAI: Keyframe[] = [];
export const KHUNG_TRONG: Keyframe[] = [];
for (let i = 0; i < MAU; i++) {
  const t = i / (MAU - 1);
  const s = S0 + (1 - S0) * songF(t);
  const o = t < 0.24 ? t / 0.24 : 1;
  KHUNG_NGOAI.push({ offset: t, transform: `scale(${s.toFixed(5)})`, opacity: o.toFixed(4), easing: "linear" });
  KHUNG_TRONG.push({ offset: t, transform: `scale(${(1 / s).toFixed(5)})`, easing: "linear" });
}

/** Bo sinh so ngau nhien co hat giong, de mot kieu troi luon ra dung mot hinh loang. */
export function rng(hat: number): () => number {
  let s = hat >>> 0;
  return (): number => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Hat giong cua mot lan loang: theo kieu troi va theo khoang cach vet, nen dai lon va o cua so ra hai hinh khac nhau.
 *
 * MOT CHO CO Y KHAC BAN MAU: ban mau lay `kieu.length` (do dai ten kieu troi), o day lay tong code point. Ban mau
 * nhu vay thi "mua-rao" va "nang-am" cung dai bay ky tu, tuc cung mot hat giong, tuc hai kieu troi khac han nhau lai
 * loang ra dung mot hinh. Tong code point tach duoc chung ra ma khong doi gi khac trong cong thuc luoi.
 */
export function hatTu(kieu: string, b: number): number {
  let tong = 0;
  for (const c of kieu) tong += c.codePointAt(0) ?? 0;
  return tong * 613 + Math.round(b) * 7 + 5;
}

/** Tien do (0..1) cua mot diem cach tam loang kc diem anh, tren mot khung rong W cao H voi ban kinh khuon rv. */
export function tien(kc: number, W: number, H: number, rv: number): number {
  const r0 = rv * R0_HE;
  const Rmax = Math.hypot(W / 2, H / 2);
  const p = (kc - r0) / (Rmax + rv - r0);
  return Math.min(1, Math.max(0, p));
}

/**
 * Khoang cach giua hai tam vet cua mot lan loang. Dai lon luon lay MAT_DO; o cua so co khuon lai theo canh NGAN cua
 * o, vi o vuong be ma van rai vet cach nhau 128px thi ca o chi duoc mot vet duy nhat, tuc khong con thay nuoc loang.
 *
 * San O_SAN chan dau kia: mot o ti hon (20px) cho khoang cach 7,7px, tuc gan mot tram vet trong mot o bang dau ngon
 * tay - toan chi phi dung the, khong ai nhin ra. Cong thuc nam o mo dun thuan nay chu khong nam trong `loangTroi`,
 * de ca cong thuc lan cai san deu co bai kiem (phat hien N13 cua ban soat truoc thi cong).
 */
export function khuonO(W: number, H: number, nho: boolean): number {
  return nho ? Math.max(O_SAN, Math.min(W, H) / O_HE) : MAT_DO;
}

/** Mot vet nuoc: goc tren trai cua khuon, ban kinh khuon, do tre va thoi luong no. */
export type Giot = { x: number; y: number; r: number; tre: number; dai: number };

/**
 * Luoi vet phu kin mot khung W x H, loang tu giua ra. Luoi tran ra ngoai moi be mot o, nen bon goc cung duoc phu.
 */
export function luoiGiot(W: number, H: number, b: number, hat: number): Giot[] {
  const R = rng(hat);
  const rv = b * RV_HE;
  const jit = b * JIT_HE;
  const X = W / 2;
  const Y = H / 2;
  const cot = Math.ceil(W / b) + 2;
  const hang = Math.ceil(H / b) + 2;
  const ra: Giot[] = [];
  for (let cy = 0; cy < hang; cy++) {
    for (let cx = 0; cx < cot; cx++) {
      const px = (cx - 0.5) * b + (R() - 0.5) * 2 * jit;
      const py = (cy - 0.5) * b + (R() - 0.5) * 2 * jit;
      const r = rv * (0.9 + R() * 0.2);
      const p = tien(Math.hypot(px - X, py - Y), W, H, rv);
      const tre = Math.max(0, Math.round(lanF(p) * CUA_MS + (R() - 0.5) * NHIEU_MS));
      const dai = Math.round(DV_MS * (0.88 + R() * 0.24));
      ra.push({ x: px - r, y: py - r, r, tre, dai });
    }
  }
  return ra;
}
