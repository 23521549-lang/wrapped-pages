import { IMAGE_MAX_HEIGHT_PX, IMAGE_MAX_WIDTH_PX } from "./kinds";
import { UPLOAD_RETRY_MESSAGE } from "./messages";

/**
 * Tran tep anh goc chon tu may. Anh chup 48 MP hay anh chuyen qua ung dung chat co the toi vai chuc MB, nen tran rong;
 * tran byte gui len may chu (MEDIA_MAX_BYTES) khong doi vi anh da duoc ve lai nho o trinh duyet. Anh va bia dung chung.
 */
export const IMAGE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;

/**
 * Tran diem anh luc giai ma, bang tran dien tich canvas cua Safari tren iOS (4096 x 4096). Anh biet truoc lon hon thi
 * duoc thu nho ngay luc giai ma: giai ma nguyen co anh 48 MP can khoang 200 MB bo nho, du lam sap trang tren dien thoai.
 */
export const DECODE_MAX_PIXELS = 4096 * 4096;

/** Thu tu ma hoa canvas: WebP truoc, JPEG khi trinh duyet khong ma hoa duoc WebP. */
export const IMAGE_ENCODINGS = [
  { type: "image/webp", quality: 0.82 },
  { type: "image/jpeg", quality: 0.85 },
] as const;

/** Anh da thu nho van qua tran byte thi ha chat luong them hai bac, giu nguyen kieu da ma hoa duoc. */
export const IMAGE_LOWER_QUALITIES = [0.72, 0.6] as const;

/**
 * Anh khong dung duoc o trinh duyet: loai khong nhan, tep goc qua tran, hong (moi cach giai ma hay ma hoa deu that bai),
 * khong nap duoc bo doc HEIF, hoac da ha het bac chat luong ma van qua tran byte.
 */
export type ImageFailure = "unsupported" | "source-too-large" | "broken" | "heif-loader" | "too-large";
/** Them loi tai len (mat mang, may chu tu choi) cua luong them anh. */
export type ImageProblem = ImageFailure | "upload";

/** Cau bao loi cua anh trong trang va bia. */
export const IMAGE_ERRORS = {
  unsupported: "Chưa đọc được loại ảnh này.",
  "source-too-large": "Ảnh lớn quá (tối đa 40 MB), chọn ảnh khác.",
  broken: "Ảnh này bị hỏng hoặc không mở được, thử ảnh khác.",
  "heif-loader": "Chưa tải được bộ đọc ảnh iPhone, thử lại.",
  "too-large": "Ảnh lớn quá, chọn ảnh khác.",
  upload: UPLOAD_RETRY_MESSAGE,
} as const satisfies Record<ImageProblem, string>;

/** Dong goi y hien duoi cau loi: noi nguoi dung nen lam gi tiep. */
export const IMAGE_HINTS: Readonly<Partial<Record<ImageProblem, string>>> = {
  unsupported: "Hãy chọn ảnh JPG, PNG, HEIC hoặc WebP.",
};

/** Thuoc tinh accept cua o chon anh: image/* kem duoi tep ma mot so he dieu hanh khong xep vao image/* (HEIC tren Windows). */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.avif";

/**
 * Loai loi duy nhat con thu lai duoc bang cach nap lai bo doc anh iPhone roi doc lai chinh tep do (khac loi "upload",
 * thu lai bang cach gui lai anh da xu ly san co). Xuat rieng de moi noi so voi loai loi nay (CoverPicker chon duong thu
 * lai) deu di qua cung mot hang so, khong so chuoi tay.
 */
export const HEIF_LOADER_FAILURE: ImageFailure = "heif-loader";

/** Loi thu lai duoc voi chinh du lieu dang co: gui lai anh da xu ly, hoac nap lai bo doc anh iPhone roi doc lai tep. */
export function imageRetryable(problem: ImageProblem): boolean {
  return problem === HEIF_LOADER_FAILURE || problem === "upload";
}

/** Cau vung doc doc khi loi: cau loi kem dong goi y (neu co), dung bo chu nguoi nhin thay tren man. */
export function imageErrorText(problem: ImageProblem): string {
  const hint = IMAGE_HINTS[problem];
  return hint ? `${IMAGE_ERRORS[problem]} ${hint}` : IMAGE_ERRORS[problem];
}

/** Tep goc vuot tran thi lon qua, khong can doc tiep. */
export function checkImageSource(file: { size: number }): ImageFailure | null {
  return file.size > IMAGE_SOURCE_MAX_BYTES ? "source-too-large" : null;
}

/**
 * resizeWidth cho createImageBitmap: null khi khong biet kich thuoc hay anh chua qua DECODE_MAX_PIXELS; con lai la rong
 * sau khi thu dien tich ve dung tran, giu ti le (trinh duyet tu tinh cao). size la kich thuoc da xoay theo huong chup.
 */
export function decodeResizeWidth(size: { width: number; height: number } | null): number | null {
  if (!size || size.width * size.height <= DECODE_MAX_PIXELS) return null;
  const k = Math.sqrt(DECODE_MAX_PIXELS / (size.width * size.height));
  return Math.max(1, Math.floor(size.width * k));
}

/**
 * Kich thuoc ve lai cua anh trong trang: giu ti le, thu nho cho vua ca IMAGE_MAX_WIDTH_PX lan IMAGE_MAX_HEIGHT_PX (may chu
 * kiem lai ca hai), khong bao gio phong to, it nhat mot diem anh moi chieu.
 */
export function fitImage(width: number, height: number): { width: number; height: number } {
  const k = Math.min(1, IMAGE_MAX_WIDTH_PX / width, IMAGE_MAX_HEIGHT_PX / height);
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Mot lan thu ma hoa: kieu thu format trong IMAGE_ENCODINGS, da ha lowered bac chat luong. */
export type EncodeAttempt = { format: number; lowered: number };
export const FIRST_ENCODE: EncodeAttempt = { format: 0, lowered: 0 };

/** Kieu va chat luong cua mot lan thu. */
export function encodingOf(attempt: EncodeAttempt): { type: string; quality: number } {
  const format = IMAGE_ENCODINGS[attempt.format];
  return { type: format.type, quality: attempt.lowered === 0 ? format.quality : IMAGE_LOWER_QUALITIES[attempt.lowered - 1] };
}

export type EncodeStep<T> = { kind: "ok"; blob: T } | { kind: "retry"; next: EncodeAttempt } | { kind: "error"; problem: ImageFailure };

/**
 * Buoc tiep theo sau mot lan toBlob. Ra dung kieu va trong maxBytes (tran may chu cua loai media) thi xong; dung kieu ma
 * qua tran thi ha chat luong mot bac, het bac thi lon qua. Trinh duyet khong ma hoa duoc kieu da xin (tra null, hoac
 * kieu khac nhu Safari cu tra PNG cho WebP) thi thu kieu sau; het kieu thi anh hong.
 */
export function chooseEncoded<T extends { type: string; size: number }>(attempt: EncodeAttempt, blob: T | null, maxBytes: number): EncodeStep<T> {
  if (blob && blob.type === IMAGE_ENCODINGS[attempt.format].type) {
    if (blob.size <= maxBytes) return { kind: "ok", blob };
    return attempt.lowered < IMAGE_LOWER_QUALITIES.length
      ? { kind: "retry", next: { format: attempt.format, lowered: attempt.lowered + 1 } }
      : { kind: "error", problem: "too-large" };
  }
  return attempt.format + 1 < IMAGE_ENCODINGS.length
    ? { kind: "retry", next: { format: attempt.format + 1, lowered: 0 } }
    : { kind: "error", problem: "broken" };
}
