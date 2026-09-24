import { readFileSync } from "node:fs";
import { parseOklch, type Srgb } from "@/lib/mau/oklch";

/*
 * Doc bang token mau tu tokens.css, dung chung cho cong tuong phan (tests/unit/tuong-phan.test.ts) va bai kiem
 * bang tuong phan co dinh (tests/unit/mau.test.ts): hai bai cung doc mot nguon, khong co ban sao bo doc thu hai.
 */

export const THU_MUC_CSS = "src/styles";

export function boComment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Bang ten token sang mau, suy tu moi `--x: oklch(...)` trong tokens.css. Bo qua token khong phai mau
 *  phang (vd --shadow-rest ghep nhieu oklch() trong mot chuoi box-shadow: khong khop nguyen ven oklch()). */
export function docBangToken(): Record<string, Srgb> {
  const css = boComment(readFileSync(`${THU_MUC_CSS}/tokens.css`, "utf8"));
  const bang: Record<string, Srgb> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const m of css.matchAll(re)) {
    const mau = parseOklch(m[2].trim());
    if (mau !== null) bang[m[1]] = mau;
  }
  return bang;
}

/** Mot token mau doc o dang ba so goc cua no: do sang phan tram, chroma, goc mau do. */
export type Oklch = { l: number; c: number; h: number };

/** Bang ten token sang ba so oklch, cho bai kiem nao can tinh tren chinh khong gian mau chu khong chi do
 *  tuong phan cua mau da ra sRGB (vd tron hai token de suy mau that cua mot color-mix trong CSS). */
export function docBangOklch(): Record<string, Oklch> {
  const css = boComment(readFileSync(`${THU_MUC_CSS}/tokens.css`, "utf8"));
  const bang: Record<string, Oklch> = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g)) {
    bang[m[1]] = { l: Number(m[2]), c: Number(m[3]), h: Number(m[4]) };
  }
  return bang;
}
