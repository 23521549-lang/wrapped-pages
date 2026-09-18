/*
 * Chuyen oklch sang sRGB de do tuong phan. Thuan, khong dependency, khong DOM.
 * Ma tran la cua khong gian Oklab: sai mot chu so van ra mot con so trong hop ly, nen dung sua tay.
 */

export type Srgb = readonly [number, number, number];

/** L trong [0,1] (khong phai phan tram), C la chroma, H la goc do. */
export function oklchToSrgb(L: number, C: number, H: number): Srgb {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const tuyenTinh = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, bl] = tuyenTinh.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  });
  return [r, g, bl] as const;
}

const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Doc mot gia tri CSS. Tra null cho moi thu khong phai oklch() nguyen ven (vd var(), hex, color-mix). */
export function parseOklch(value: string): Srgb | null {
  const m = OKLCH.exec(value.trim());
  if (m === null) return null;
  return oklchToSrgb(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
}
