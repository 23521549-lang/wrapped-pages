import { checkImageSource, chooseEncoded, encodingOf, FIRST_ENCODE, type EncodeAttempt, type ImageFailure } from "@/lib/media/image";

/*
 * Xu ly anh bang canvas o trinh duyet, dung chung cho anh trong trang (processImage) va bia (coverFile). Canvas ve
 * lai diem anh, nen EXIF va GPS bi bo. May chu khong xu ly anh, chi kiem lai byte.
 */

/**
 * Giai ma tep anh goc, xoay theo EXIF (imageOrientation from-image). Tep qua IMAGE_SOURCE_MAX_BYTES thi lon qua ma khong
 * giai ma; trinh duyet khong giai ma duoc (HEIC tren Windows, tep hong, khong phai anh) thi hong. Noi goi dong bitmap
 * khi xong.
 */
export async function decodeImage(file: File): Promise<ImageBitmap | ImageFailure> {
  const problem = checkImageSource(file);
  if (problem) return problem;
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return "broken";
  }
}

/**
 * Canvas width x height da ve xong bang draw, ve dong bo. null khi trinh duyet khong cap context 2d, thuong vi het bo nho
 * cho co do: noi goi coi la anh lon qua.
 */
export function paintCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  draw(ctx);
  return canvas;
}

/** toBlob cua canvas duoi dang Promise; null khi trinh duyet khong ma hoa duoc. */
export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeFrom(canvas: HTMLCanvasElement, maxBytes: number, attempt: EncodeAttempt): Promise<Blob | ImageFailure> {
  const { type, quality } = encodingOf(attempt);
  const step = chooseEncoded(attempt, await canvasBlob(canvas, type, quality), maxBytes);
  if (step.kind === "retry") return encodeFrom(canvas, maxBytes, step.next);
  return step.kind === "ok" ? step.blob : step.problem;
}

/**
 * Ma hoa canvas theo IMAGE_ENCODINGS (WebP, roi JPEG), qua tran thi ha chat luong hai bac (IMAGE_LOWER_QUALITIES);
 * chooseEncoded quyet tung buoc. maxBytes la tran may chu nhan cua loai. Lay byte xong thi tra bo dem cua canvas lai
 * ngay (width = height = 0): mot canvas anh trong trang toi 1200x1600 giu khoang 7.7 MB, ma Safari tren iOS khong thu
 * hoi bo dem canvas som va co han cung cho moi trang - them vai anh trong mot luot la du cham tran, va nguoi dung chi
 * thay "anh lang le khong ma hoa duoc". Blob da tra ve doc lap voi canvas, nen khong ai con can doc canvas sau khi ham
 * nay xong.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob | ImageFailure> {
  try {
    return await encodeFrom(canvas, maxBytes, FIRST_ENCODE);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
