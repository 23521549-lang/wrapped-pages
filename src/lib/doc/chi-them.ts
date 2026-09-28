import { mediaIdsOf } from "@/lib/media/node";
import type { DocJson } from "./types";

/*
 * Luat sua mot luot da dang (chu du an 28/09): chi duoc VIET THEM va SUA CHINH TA, khong duoc xoa. Mo dun thuan, dung
 * chung o may chu (editRound tu choi ban sua vi pham) va o trinh duyet (trinh sua to mau chu them, chu sua va hien lai
 * chu cu bi mat). Chu la moi doan chu cai hay chu so lien nhau; dau cau, khoang trang, dinh dang, xuong dong, tach hay
 * gop doan deu tu do.
 */

/** Mot chu: noi dung, khoi van ban chua no (thu tu doan trong tai lieu) va vi tri ky tu trong chuoi cua khoi do. */
export type Tu = { chu: string; khoi: number; dau: number; cuoi: number };

/** Ket qua so sanh cho giao dien: cap [chu cu, chu moi, muc giong], chu cu khong khop, chu moi khong khop. */
export type SoSanh = { cap: [number, number, 1 | 2][]; mat: number[]; them: number[] };

type Nut = { type?: unknown; text?: unknown; content?: readonly unknown[] };

const CHU = /[\p{L}\p{N}]+/gu;

/**
 * Chuoi cua tung doan theo thu tu tai lieu, ke ca doan trong muc danh sach va trich dan; xuong dong trong doan thanh
 * "\n". Doan la khoi van ban duy nhat cua so do, nen hai doan khong bao gio dinh chu vao nhau.
 */
export function vanBanKhoi(doc: { content?: readonly unknown[] }): string[] {
  const out: string[] = [];
  const di = (n: Nut) => {
    if (n.type === "paragraph") {
      out.push((n.content ?? []).map((c) => {
        const x = c as Nut;
        if (x.type === "text" && typeof x.text === "string") return x.text;
        return x.type === "hardBreak" ? "\n" : "";
      }).join(""));
      return;
    }
    for (const c of n.content ?? []) di(c as Nut);
  };
  di(doc as Nut);
  return out;
}

/** Cac chu cua moi khoi, theo thu tu. */
export function tachTu(khoi: readonly string[]): Tu[] {
  const out: Tu[] = [];
  khoi.forEach((s, k) => {
    for (const m of s.matchAll(CHU)) out.push({ chu: m[0], khoi: k, dau: m.index, cuoi: m.index + m[0].length });
  });
  return out;
}

/** Bo dau tieng Viet va viet thuong: "Người" va "nguoi" thanh mot. */
const boDau = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Khoang cach Levenshtein theo ky tu (code point), hai hang. */
function khoang(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let truoc = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const nay = [i];
    for (let j = 1; j <= y.length; j++) {
      nay[j] = Math.min(truoc[j] + 1, nay[j - 1] + 1, truoc[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    truoc = nay;
  }
  return truoc[y.length];
}

/**
 * Hai chu giong nhau toi dau: 2 la y het; 1 la sua chinh ta (chi khac dau, chu d hay hoa thuong, hoac lech it ky tu:
 * toi da 1 voi chu dai toi da 4 ky tu, toi da 2 voi chu dai hon); 0 la hai chu khac nhau.
 */
export function giong(a: string, b: string): 0 | 1 | 2 {
  if (a === b) return 2;
  if (boDau(a) === boDau(b)) return 1;
  const dai = Math.max([...a].length, [...b].length);
  return khoang(a.toLowerCase(), b.toLowerCase()) <= (dai <= 4 ? 1 : 2) ? 1 : 0;
}

/**
 * Moi chu cu khop duoc, dung thu tu, vao mot chu moi giong no. Ghep tham lam (moi chu cu lay chu moi giong no som nhat
 * con lai) la dung cho cau hoi co/khong nay: neu co mot cach ghep thi cach tham lam cung ghep duoc, vi no luon dung o
 * vi tri khong muon hon bat ky cach ghep nao. Chay gan tuyen tinh voi ban sua that (chu cu phan lon con nguyen).
 */
function laDayCon(cu: readonly Tu[], moi: readonly Tu[]): boolean {
  let j = 0;
  for (const t of cu) {
    while (j < moi.length && giong(t.chu, moi[j].chu) === 0) j++;
    if (j === moi.length) return false;
    j++;
  }
  return true;
}

/** Ban moi cua mot luot chi viet them va sua chinh ta so voi ban cu: moi chu cu con (dung thu tu), moi media cu con. */
export function hopLeChiThem(cu: DocJson, moi: DocJson): boolean {
  const con = new Set(mediaIdsOf(moi));
  if (mediaIdsOf(cu).some((id) => !con.has(id))) return false;
  return laDayCon(tachTu(vanBanKhoi(cu)), tachTu(vanBanKhoi(moi)));
}

/** Diem cua mot cap trong quy hoach dong: chu y het hon chu sua chinh ta mot diem. */
const diem = (g: number) => (g === 2 ? 11 : 10);

/** So buoc sua toi da cua phep so y het (Myers): qua muc nay thi coi nhu viet lai ca doan, bo qua buoc neo. */
const MYERS_TOI_DA = 400;
/** Kich thuoc toi da cua mot khe cho quy hoach dong (so chu cu x so chu moi). */
const KHE_TOI_DA = 250_000;

/**
 * Cac cap vi tri chu y het giua hai day (mot day con chung dai nhat), bang thuat toan diff cua Myers: O((N + M) D) voi D
 * la so chu them hay bot, nen voi ban sua that (vai cho) gan nhu tuyen tinh. null khi D vuot `toiDa`.
 */
function khopYHet(a: readonly string[], b: readonly string[], toiDa: number): [number, number][] | null {
  const n = a.length;
  const m = b.length;
  const lech = n + m + 1;
  const v = new Int32Array(2 * lech + 1);
  const vet: Int32Array[] = [];
  for (let d = 0; d <= Math.min(n + m, toiDa); d++) {
    vet.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[lech + k - 1] < v[lech + k + 1]) ? v[lech + k + 1] : v[lech + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[lech + k] = x;
      if (x >= n && y >= m) return truyVet(vet, lech, n, m);
    }
  }
  return null;
}

function truyVet(vet: readonly Int32Array[], lech: number, n: number, m: number): [number, number][] {
  const cap: [number, number][] = [];
  let x = n;
  let y = m;
  for (let d = vet.length - 1; d >= 0; d--) {
    const v = vet[d];
    const k = x - y;
    const kTruoc = k === -d || (k !== d && v[lech + k - 1] < v[lech + k + 1]) ? k + 1 : k - 1;
    const xTruoc = v[lech + kTruoc];
    const yTruoc = xTruoc - kTruoc;
    while (x > xTruoc && y > yTruoc) {
      cap.push([x - 1, y - 1]);
      x--;
      y--;
    }
    x = xTruoc;
    y = yTruoc;
  }
  // Truy vet di tu cuoi ve dau: dao lai thu tu vao mot mang moi (lib ES2022 chua co toReversed).
  const xuoi: [number, number][] = [];
  for (let k = cap.length - 1; k >= 0; k--) xuoi.push(cap[k]);
  return xuoi;
}

/**
 * Quy hoach dong tren mot khe [i0, i1) x [j0, j1): giu duoc nhieu chu cu nhat, uu tien chu y het (11 diem) hon chu sua
 * chinh ta (10 diem). Khe qua lon (viet lai han mot doan dai) thi ghep tham lam de khong treo trinh duyet.
 */
function ghepKhe(cu: readonly Tu[], moi: readonly Tu[], i0: number, i1: number, j0: number, j1: number, cap: [number, number, 1 | 2][]) {
  const n = i1 - i0;
  const m = j1 - j0;
  if (n === 0 || m === 0) return;
  if (n * m > KHE_TOI_DA) {
    let j = j0;
    for (let i = i0; i < i1 && j < j1; i++) {
      let k = j;
      while (k < j1 && giong(cu[i].chu, moi[k].chu) === 0) k++;
      if (k === j1) continue;
      cap.push([i, k, giong(cu[i].chu, moi[k].chu) as 1 | 2]);
      j = k + 1;
    }
    return;
  }
  const S = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  const G = Array.from({ length: n }, () => new Int8Array(m));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const g = giong(cu[i0 + i].chu, moi[j0 + j].chu);
      G[i][j] = g;
      let t = Math.max(S[i + 1][j], S[i][j + 1]);
      if (g !== 0) t = Math.max(t, S[i + 1][j + 1] + diem(g));
      S[i][j] = t;
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const g = G[i][j];
    if (g !== 0 && S[i][j] === S[i + 1][j + 1] + diem(g)) {
      cap.push([i0 + i, j0 + j, g as 1 | 2]);
      i++;
      j++;
    } else if (S[i][j] === S[i + 1][j]) i++;
    else j++;
  }
}

/**
 * Ghep chu cu voi chu moi cho giao dien. Neo cac chu y het bang diff Myers, roi quy hoach dong trong tung khe giua hai
 * neo de bat chu sua chinh ta va chu cu bi mat. Ban sua that chi cham vai cho nen cac khe nho, moi lan go van nhe du
 * luot dai hang nghin chu.
 */
export function soSanh(cu: readonly Tu[], moi: readonly Tu[]): SoSanh {
  const cap: [number, number, 1 | 2][] = [];
  const neo = khopYHet(cu.map((t) => t.chu), moi.map((t) => t.chu), MYERS_TOI_DA) ?? [];
  let i = 0;
  let j = 0;
  for (const [a, b] of neo) {
    ghepKhe(cu, moi, i, a, j, b, cap);
    cap.push([a, b, 2]);
    i = a + 1;
    j = b + 1;
  }
  ghepKhe(cu, moi, i, cu.length, j, moi.length, cap);
  const coCu = new Set(cap.map(([a]) => a));
  const coMoi = new Set(cap.map(([, b]) => b));
  return {
    cap,
    mat: cu.map((_, k) => k).filter((k) => !coCu.has(k)),
    them: moi.map((_, k) => k).filter((k) => !coMoi.has(k)),
  };
}
