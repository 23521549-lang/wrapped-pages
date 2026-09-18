import type { Srgb } from "./oklch";

/** sRGB tuyen tinh hoa mot kenh mau, buoc trung gian cua do sang tuong doi WCAG. */
function tuyenTinhHoa(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Do sang tuong doi theo WCAG 2.x. */
export function relativeLuminance([r, g, b]: Srgb): number {
  return 0.2126 * tuyenTinhHoa(r) + 0.7152 * tuyenTinhHoa(g) + 0.0722 * tuyenTinhHoa(b);
}

/** Ty le tuong phan WCAG: tu 1 (giong het) toi 21 (trang tren den). Doi cho hai mau khong doi ket qua. */
export function contrastRatio(a: Srgb, b: Srgb): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
