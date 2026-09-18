import { IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX } from "./kinds";
import { UPLOAD_RETRY_MESSAGE } from "./messages";

/** Tran tep anh goc chon tu may: trinh duyet phai giai ma ca tep, nen tep lon hon bi tu choi ngay. Anh va bia dung chung. */
export const IMAGE_SOURCE_MAX_BYTES = 25 * 1024 * 1024;

/** Thu tu ma hoa canvas: WebP truoc, JPEG khi trinh duyet khong ma hoa duoc WebP. */
export const IMAGE_ENCODINGS = [
  { type: "image/webp", quality: 0.82 },
  { type: "image/jpeg", quality: 0.85 },
] as const;

/** Anh khong dung duoc o trinh duyet: khong giai ma hay ma hoa duoc, hoac qua tran byte. */
export type ImageFailure = "unreadable" | "too-large";
/** Them loi tai len (mat mang, may chu tu choi) cua luong them anh. */
export type ImageProblem = ImageFailure | "upload";

/** Cau bao loi cua anh trong trang va bia. */
export const IMAGE_ERRORS = {
  unreadable: "Ảnh này không đọc được.",
  "too-large": "Ảnh lớn quá, chọn ảnh khác.",
  upload: UPLOAD_RETRY_MESSAGE,
} as const satisfies Record<ImageProblem, string>;

/** Dong goi y di kem loi unreadable. */
export const IMAGE_UNREADABLE_HINT = "Chọn ảnh JPG, PNG hoặc WebP.";

/** Tep goc vuot tran thi lon qua, khong can giai ma. Tep khong phai anh do createImageBitmap bao, khong doan theo mime. */
export function checkImageSource(file: { size: number }): ImageFailure | null {
  return file.size > IMAGE_SOURCE_MAX_BYTES ? "too-large" : null;
}

/**
 * Kich thuoc ve lai cua anh trong trang: giu ti le, thu nho cho vua ca IMAGE_MAX_WIDTH_PX lan IMAGE_MAX_HEIGHT_PX (may chu
 * kiem lai ca hai), khong bao gio phong to, it nhat mot diem anh moi chieu.
 */
export function fitImage(width: number, height: number): { width: number; height: number } {
  const k = Math.min(1, IMAGE_MAX_WIDTH_PX / width, IMAGE_MAX_HEIGHT_PX / height);
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export type EncodeStep<T> = { kind: "ok"; blob: T } | { kind: "retry"; next: number } | { kind: "error"; problem: ImageFailure };

/**
 * Buoc tiep theo sau lan toBlob thu attempt (chi so trong IMAGE_ENCODINGS). Trinh duyet khong ma hoa duoc kieu da xin thi
 * tra null hoac mot kieu khac (Safari cu tra PNG cho WebP): thu kieu sau, het kieu thi anh khong doc duoc. Ra dung kieu ma
 * vuot maxBytes, tran may chu nhan cua loai media (MEDIA_MAX_BYTES), thi lon qua.
 */
export function chooseEncoded<T extends { type: string; size: number }>(attempt: number, blob: T | null, maxBytes: number): EncodeStep<T> {
  if (blob && blob.type === IMAGE_ENCODINGS[attempt].type) {
    return blob.size <= maxBytes ? { kind: "ok", blob } : { kind: "error", problem: "too-large" };
  }
  return attempt + 1 < IMAGE_ENCODINGS.length ? { kind: "retry", next: attempt + 1 } : { kind: "error", problem: "unreadable" };
}
