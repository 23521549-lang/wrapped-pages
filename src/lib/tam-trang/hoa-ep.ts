import { FLOWERS, type FlowerKey } from "./troi";

/*
 * Net ve chin bong hoa ep, chep dung thuat toan cua ban mau da duyet: ve tay bang nhieu lop cung mot mau (currentColor)
 * dam nhat khac nhau, nhu tranh bia thuy mac, roi qua bo loc muc (#muc-hoa) cho mep net xo nhe. Do lech ngau nhien den
 * tu bo so gia ngau nhien mulberry32 co hat giong theo ten hoa, nen moi lan ve ra y nhu nhau, tren may chu va trong
 * test. Ham thuan: chi tra ve mo ta hinh, thanh phan React ve chung thanh SVG.
 */

/** Id bo loc muc cua hoa, khai trong HoaDefs. */
export const MUC_HOA = "muc-hoa";

type Net =
  /** Mang to mau (canh hoa, la). tf la transform cua mot canh xoay quanh tam hoa. */
  | { k: "to"; d: string; o: number; tf?: string }
  /** Net ve khong to (cuong, tia). */
  | { k: "net"; d: string; o: number; w: number }
  /** Cham tron to mau (nhuy, hat). */
  | { k: "cham"; x: number; y: number; r: number; o: number }
  /** Vong tron chi vien (quanh nhuy luu ly). */
  | { k: "vong"; x: number; y: number; r: number; o: number }
  /** Hinh bau xoay (canh hoa buom). */
  | { k: "bau"; x: number; y: number; rx: number; ry: number; a: number; o: number };

/** Mot net kem khoa React on dinh (thu tu net khong bao gio doi vi thuat toan tat dinh). */
export type NetHoa = Net & { key: string };

/** mulberry32: bo so gia ngau nhien 32 bit nho, du deu cho net ve tay. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Dang mot canh hoa ve quanh goc toa do, dinh canh huong len (y am). */
const CANH = {
  cuc: "M0 0 C-1.9 -4.5 -1.7 -11.5 0 -14 C1.7 -11.5 1.9 -4.5 0 0Z",
  tron: "M0 0 C-3.6 -1.4 -3.8 -6.4 0 -6.8 C3.8 -6.4 3.6 -1.4 0 0Z",
  hue: "M0 0 C-2.7 -4.5 -2.3 -11 0 -15 C2.3 -11 2.7 -4.5 0 0Z",
  nhan: "M0 0 L-.6 -4 C-4.6 -4.6 -6.2 -8.6 -4.7 -11.3 Q-3.6 -10 -2.6 -12.5 Q-1.2 -11.2 -.2 -12.9 Q1 -11.4 2.2 -12.7 Q3.4 -10.9 4.7 -11.4 C6.1 -8.6 4.7 -4.6 .6 -4 Z",
  tu: "M0 0 C-2.5 -1.2 -2.9 -4.1 0 -4.9 C2.9 -4.1 2.5 -1.2 0 0Z",
} as const;

function veHoa(ten: FlowerKey): Net[] {
  const R = rng(ten.length * 97 + (ten.codePointAt(0) ?? 0));
  const o: Net[] = [];
  const P = (d: string, op: number, tf?: string) => {
    o.push(tf === undefined ? { k: "to", d, o: op } : { k: "to", d, o: op, tf });
  };
  const S = (d: string, op: number, w: number) => {
    o.push({ k: "net", d, o: op, w });
  };
  const C = (x: number, y: number, r: number, op: number) => {
    o.push({ k: "cham", x: r2(x), y: r2(y), r: r2(r), o: op });
  };
  const E = (x: number, y: number, rx: number, ry: number, a: number, op: number) => {
    o.push({ k: "bau", x, y, rx, ry, a, o: op });
  };
  /** n canh quanh (x, y), lech goc va co ngau nhien nhe nhu hoa ep bang tay. */
  const vong = (d: string, x: number, y: number, n: number, goc0: number, op: number, s: number, lech: number) => {
    for (let i = 0; i < n; i++) {
      const a = goc0 + i * 360 / n + (R() - 0.5) * lech;
      const sc = s * (0.9 + R() * 0.16);
      P(d, op, `translate(${x} ${y}) rotate(${r2(a)}) scale(${r2(sc)})`);
    }
  };

  switch (ten) {
    case "cuc": {
      S("M22 24 C23 31 25 38 29 46", 0.4, 1.1);
      P("M25.5 36.5 C29 33 33.5 32.6 36 33.8 C33 37 29 38.4 25.5 36.5Z", 0.26);
      S("M25.5 36.5 C29 35.4 32 34.6 35 34", 0.3, 0.5);
      vong(CANH.cuc, 22, 20, 13, 14, 0.2, 1, 10);
      vong(CANH.cuc, 22, 20, 13, 0, 0.3, 0.95, 8);
      C(22, 20, 3.6, 0.5);
      C(22, 20, 2, 0.35);
      for (let i = 0; i < 9; i++) {
        const a = i * 40 * Math.PI / 180;
        C(22 + Math.cos(a) * 2.8, 20 + Math.sin(a) * 2.8, 0.45, 0.55);
      }
      break;
    }
    case "luu-ly": {
      S("M21 31 C22 37 22 42 21 47", 0.36, 0.9);
      S("M29.5 27 C29 33 26 38 22 41", 0.3, 0.8);
      S("M17 22 C18 26 20 29 21 31", 0.3, 0.7);
      P("M22 40 C18 38 14 39 12 41 C15 43 19 43 22 40Z", 0.22);
      for (const [x, y, s] of [[17, 17, 1.05], [30, 22, 0.95], [22, 29, 0.8], [11, 27, 0.5], [36, 13, 0.45]]) {
        vong(CANH.tron, x, y, 5, R() * 70, 0.3, s, 10);
        C(x, y, 1.3 * s, 0.55);
        o.push({ k: "vong", x, y, r: r2(2.3 * s), o: 0.35 });
      }
      break;
    }
    case "bo-cong-anh": {
      S("M24 21 C24.6 30 23 38 25.5 47", 0.4, 1);
      P("M24.6 38 C21 36 17.5 37 15.5 39.5 C19 40.6 22 40.4 24.6 38Z", 0.2);
      C(24, 19, 13, 0.06);
      for (let j = 0; j < 30; j++) {
        const g = (j * 12 + (R() - 0.5) * 7) * Math.PI / 180;
        const L = 10.5 + R() * 2.4;
        const x1 = 24 + Math.cos(g) * 2.2;
        const y1 = 19 + Math.sin(g) * 2.2;
        const x2 = 24 + Math.cos(g) * L;
        const y2 = 19 + Math.sin(g) * L;
        S(`M${r2(x1)} ${r2(y1)} L${r2(x2)} ${r2(y2)}`, 0.38, 0.45);
        C(x2, y2, 0.9, 0.28);
      }
      C(24, 19, 2.4, 0.55);
      S("M39 9 L42.5 6.5", 0.35, 0.45);
      C(43, 6.2, 1, 0.3);
      S("M42 15 L45.5 13.6", 0.3, 0.45);
      C(46, 13.4, 0.9, 0.26);
      break;
    }
    case "bong-lau": {
      S("M13 47 C15 37 18 28 23 20 C26 15 30 10.5 37 7", 0.42, 1.1);
      P("M14 45 C17 38 22 34 29 32 C24 36 19 40 14 45Z", 0.2);
      P("M18 30 C22 22 28 13 37 7 C38 11 36 16 32 20 C28 25 23 29 18 30Z", 0.12);
      const pts = [[18, 29], [19.5, 26.5], [21, 24], [22.5, 21.5], [24, 19], [26, 16.5], [28, 14], [30.5, 11.6], [33, 9.8], [35.5, 8.2]];
      pts.forEach(([x, y], i) => {
        for (let k = 0; k < 3; k++) {
          const a2 = (8 + k * 14 + R() * 10) * Math.PI / 180;
          const L2 = 4.5 + R() * 3 - i * 0.12;
          S(`M${x} ${y} l${r2(Math.cos(a2) * L2)} ${r2(Math.sin(a2) * L2)}`, 0.3, 0.55);
        }
        const a3 = (-60 + R() * 20) * Math.PI / 180;
        S(`M${x} ${y} l${r2(Math.cos(a3) * 2.6)} ${r2(Math.sin(a3) * 2.6)}`, 0.24, 0.5);
      });
      break;
    }
    case "hue-mua": {
      S("M24 23 C24 31 23 39 24 47", 0.36, 1);
      S("M23.5 47 C21 38 17 32 11 28", 0.28, 1.3);
      vong(CANH.hue, 24, 20, 6, 8, 0.3, 1, 9);
      vong(CANH.hue, 24, 20, 6, 38, 0.15, 0.6, 9);
      for (let h = 0; h < 6; h++) {
        const gg = (h * 60 + 20) * Math.PI / 180;
        S(`M24 20 L${r2(24 + Math.cos(gg) * 5)} ${r2(20 + Math.sin(gg) * 5)}`, 0.45, 0.5);
        C(24 + Math.cos(gg) * 5.4, 20 + Math.sin(gg) * 5.4, 0.8, 0.55);
      }
      C(24, 20, 1.4, 0.5);
      break;
    }
    case "cam-tu-cau": {
      P("M22.5 33 C16 34.5 11 40 9 46 C15.5 45 21 41 22.5 33Z", 0.2);
      S("M22.5 33 C18 37 13 42 9.5 45.5", 0.26, 0.5);
      P("M26 33 C31.5 34 37 38.5 40 44 C33.5 44.5 28 41 26 33Z", 0.2);
      S("M26 33 C30 36.5 35 40.5 39.5 43.5", 0.26, 0.5);
      const cum = [[24, 12], [17, 16], [31, 16], [12.5, 23], [20.5, 21.5], [28, 22], [35.5, 23], [17, 28.5], [25, 29], [32, 29.5], [24, 18.5]];
      for (const [x, y] of cum) {
        vong(CANH.tu, x, y, 4, 45 + R() * 40, 0.3, 1.1, 12);
        C(x, y, 0.75, 0.55);
      }
      break;
    }
    case "bang-lang": {
      S("M22 24 C26 30 31 33 36 34", 0.34, 0.9);
      S("M27.5 29.6 C28.5 36 28.5 42 30 47", 0.36, 1);
      P("M29 40 C33 37.5 37.5 38 40 40 C36.5 42.4 32.5 42.4 29 40Z", 0.2);
      vong(CANH.nhan, 21, 19, 6, 12, 0.26, 1, 10);
      for (let s2 = 0; s2 < 11; s2++) {
        const gs = (s2 * 33) * Math.PI / 180;
        const ls = 3 + R() * 2.2;
        S(`M21 19 q${r2(Math.cos(gs) * ls * 0.5 + 1)} ${r2(Math.sin(gs) * ls * 0.5 - 1)} ${r2(Math.cos(gs) * ls)} ${r2(Math.sin(gs) * ls)}`, 0.45, 0.45);
        C(21 + Math.cos(gs) * ls, 19 + Math.sin(gs) * ls, 0.55, 0.55);
      }
      C(21, 19, 1.3, 0.5);
      C(37, 34.2, 3, 0.3);
      S("M34.5 32.5 L37 34.2 L39.5 32.5 M37 34.2 L37 37.4", 0.35, 0.5);
      break;
    }
    case "hoa-baby": {
      S("M24 47 C24 39 23.5 31 22 22", 0.34, 0.75);
      const nhanh: [string, number, number][] = [
        ["M23.4 34 C20 30 16 26 13 22", 13, 22], ["M23.2 30 C27 26 30 22 33.5 18", 33.5, 18],
        ["M22 22 C20.5 18 19 15 18 11.5", 18, 11.5], ["M22 22 C24.5 17 26.5 13 28.5 10", 28.5, 10],
        ["M13 22 C11.5 19 10 17 8.5 15", 8.5, 15], ["M33.5 18 C35.5 15.5 37 13.5 38.5 12", 38.5, 12],
        ["M18 26 C15.5 27 13 29 10 30", 10, 30], ["M29 22.5 C32 24 35 25 38 25.5", 38, 25.5],
      ];
      for (const [d, x, y] of nhanh) {
        S(d, 0.3, 0.5);
        for (let q = 0; q < 5; q++) {
          const gq = (q * 72 + R() * 30) * Math.PI / 180;
          C(x + Math.cos(gq) * 1.5, y + Math.sin(gq) * 1.5, 1.05 + R() * 0.35, 0.3);
        }
        C(x, y, 0.6, 0.55);
      }
      for (const [x, y] of [[20, 17], [26.5, 14], [15.5, 24.5], [31, 21]]) {
        C(x, y, 1.1, 0.28);
        C(x + 1.3, y - 0.8, 0.9, 0.26);
      }
      break;
    }
    case "hoa-buom": {
      S("M24 32 C25 38 26 43 28.5 47", 0.36, 1);
      P("M26.5 40 C30 37.6 34 38 36 40 C32.6 42 29.4 42 26.5 40Z", 0.2);
      E(18.6, 13.2, 6.6, 8.2, -24, 0.22);
      E(29.4, 13.2, 6.6, 8.2, 24, 0.22);
      E(15.6, 21.6, 6.4, 5.4, -12, 0.28);
      E(32.4, 21.6, 6.4, 5.4, 12, 0.28);
      E(24, 27.6, 7.8, 6.6, 0, 0.32);
      E(24, 25.6, 3.8, 2.8, 0, 0.22);
      S("M24 21.5 L21 29.5 M24 21.5 L24 31.5 M24 21.5 L27 29.5 M24 21 L17.5 21.8 M24 21 L30.5 21.8 M24 20.5 L20.5 13 M24 20.5 L27.5 13", 0.42, 0.45);
      C(24, 21, 1.4, 0.6);
      break;
    }
  }
  return o;
}

function tinhHoa(): Record<FlowerKey, readonly NetHoa[]> {
  const ra = {} as Record<FlowerKey, readonly NetHoa[]>;
  for (const k of FLOWERS) ra[k] = veHoa(k).map((n, i) => Object.assign(n, { key: `${k}-${i}` }));
  return ra;
}

/** Net ve cua chin bong hoa, tinh mot lan luc nap mo dun. */
export const HOA_EP = tinhHoa();
