import { heicTo } from "heic-to/csp";

/**
 * Giai ma HEIC bang heic-to (libheif dich sang JavaScript thuan). Chi dung ban /csp: khong WebAssembly, khong eval hay
 * new Function, nen chay duoi CSP co nonce ma khong mo 'unsafe-eval'. Bitmap tra ve da xoay theo irot va EXIF. Thu vien
 * tao mot Worker tu blob: o lan giai ma dau va giu lai (CSP mo worker-src blob: cho no). Chi nap qua loadHeif: thu
 * vien nang khoang 3 MB, khong duoc nam trong goi ma cua trang.
 */
export function decodeHeif(file: Blob): Promise<ImageBitmap> {
  return heicTo({ blob: file, type: "bitmap" });
}
